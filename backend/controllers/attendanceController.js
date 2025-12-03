const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Center = require('../models/Center');
const { calculateDistance } = require('../utils/haversine');
const { logAuditAction } = require('../utils/auditLogger');
const moment = require('moment-timezone');
const { getCurrentEgyptTime, getEgyptTimeDifferenceMinutes } = require('../utils/timezone');
const { logError } = require('../utils/errorLogger');

/**
 * Record attendance with GPS validation
 * POST /api/attendance/record
 */
const recordAttendance = async (req, res) => {
    try {
        const { session_id, latitude, longitude, notes } = req.body;
        const assistantId = req.user.id;

        // Validation
        if (!session_id || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Session ID, latitude, and longitude are required'
            });
        }

        // Get session details with populated center
        const session = await Session.findById(session_id)
            .populate('center_id')
            .lean();

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Verify session belongs to assistant (if assigned)
        if (session.assistant_id && session.assistant_id.toString() !== assistantId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'This session is not assigned to you'
            });
        }

        // Check if already attended
        // For weekly sessions, check by session_id AND date (to allow multiple occurrences)
        // For one-time sessions, check by session_id only
        let existingAttendance;
        if (session.recurrence_type === 'weekly') {
            // Use Egypt timezone for date calculation
            const today = getCurrentEgyptTime();
            const todayMoment = moment.tz(today, 'Africa/Cairo').startOf('day');
            const tomorrowMoment = todayMoment.clone().add(1, 'day');
            const todayStart = todayMoment.toDate();
            const tomorrow = tomorrowMoment.toDate();
            
            existingAttendance = await Attendance.findOne({
                session_id,
                assistant_id: assistantId,
                time_recorded: {
                    $gte: todayStart,
                    $lt: tomorrow
                }
            });
        } else {
            existingAttendance = await Attendance.findOne({
                session_id,
                assistant_id: assistantId
            });
        }

        if (existingAttendance) {
            return res.status(409).json({
                success: false,
                message: 'Attendance already recorded for this session'
            });
        }

        const center = session.center_id;

        // Calculate distance from center
        const distance = calculateDistance(
            center.latitude,
            center.longitude,
            latitude,
            longitude
        );

        // Check if within radius
        if (distance > center.radius_m) {
            return res.status(400).json({
                success: false,
                message: `You are ${Math.round(distance)}m away from ${center.name}. You must be within ${center.radius_m}m to mark attendance.`,
                data: {
                    distance: Math.round(distance),
                    required_radius: center.radius_m
                }
            });
        }

        // Calculate delay using Egypt timezone
        const now = getCurrentEgyptTime();
        
        // Parse session start time in Egypt timezone
        let sessionTime;
        if (session.recurrence_type === 'weekly') {
            // For weekly sessions, set the time to today in Egypt timezone
            const today = getCurrentEgyptTime();
            const sessionMoment = moment.tz(session.start_time, 'Africa/Cairo');
            const todayMoment = moment.tz(today, 'Africa/Cairo');
            sessionTime = todayMoment.clone()
                .hours(sessionMoment.hours())
                .minutes(sessionMoment.minutes())
                .seconds(0)
                .milliseconds(0)
                .toDate();
        } else {
            // For one-time sessions, use the actual session start time (already in Egypt timezone)
            sessionTime = new Date(session.start_time);
        }

        const delayMinutes = getEgyptTimeDifferenceMinutes(now, sessionTime); // Can be negative if early

        // Round to nearest whole minute and normalize
        const roundedDelay = Math.round(delayMinutes);

        // Check if attendance is being marked within the allowed time window
        // Allow 30 minutes before and 45 minutes after session start
        const maxEarlyMinutes = 30;
        const maxLateMinutes = 45;

        if (delayMinutes < -maxEarlyMinutes) {
            return res.status(400).json({
                success: false,
                message: `You are too early. You can mark attendance starting from ${maxEarlyMinutes} minutes before the session.`,
                data: {
                    session_start_time: sessionTime.toISOString(),
                    minutes_until_window_opens: Math.abs(delayMinutes) - maxEarlyMinutes
                }
            });
        }

        if (delayMinutes > maxLateMinutes) {
            return res.status(400).json({
                success: false,
                message: `Attendance window has closed. You can only mark attendance within ${maxLateMinutes} minutes after the session start time.`,
                data: {
                    session_start_time: sessionTime.toISOString(),
                    current_delay_minutes: delayMinutes,
                    max_allowed_minutes: maxLateMinutes
                }
            });
        }

        // Calculate actual delay
        // If marked early or on time, delay = 0
        // Otherwise, delay = full minutes late
        const actualDelayMinutes = roundedDelay <= 0 ? 0 : roundedDelay;

        // Record attendance
        const newAttendance = new Attendance({
            assistant_id: assistantId,
            session_id,
            session_subject: session.subject, // Store session subject for preservation
            center_id: session.center_id._id,
            latitude,
            longitude,
            time_recorded: now, // now is already Egypt time
            delay_minutes: actualDelayMinutes,
            notes: notes || ''
        });

        await newAttendance.save();

        const arrivalTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Extract time from start_time in Egypt timezone
        const sessionMoment = moment.tz(sessionTime, 'Africa/Cairo');
        const hours = sessionMoment.hours().toString().padStart(2, '0');
        const minutes = sessionMoment.minutes().toString().padStart(2, '0');
        const startTime = `${hours}:${minutes}`;

        // Log the action
        await logAuditAction(assistantId, 'RECORD_ATTENDANCE', {
            attendance_id: newAttendance._id.toString(),
            session_id,
            center_id: session.center_id._id.toString(),
            subject: session.subject,
            delay_minutes: actualDelayMinutes,
            distance: Math.round(distance)
        });

        res.json({
            success: true,
            message: `Attendance recorded for ${session.subject} — ${startTime}. Arrival time: ${arrivalTime}. ${delayMinutes > 0 ? `Delay: ${delayMinutes} minutes.` : 'No delay.'}`,
            data: {
                attendance_id: newAttendance._id,
                session: session.subject,
                center: center.name,
                arrival_time: arrivalTime,
                delay_minutes: delayMinutes,
                distance: Math.round(distance)
            }
        });

    } catch (error) {
        console.error('Record attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording attendance'
        });
    }
};

/**
 * Get assistant's attendance history
 * GET /api/attendance/my-history
 */
const getMyAttendance = async (req, res) => {
    try {
        const assistantId = req.user.id;

        const records = await Attendance.find({
            assistant_id: assistantId,
            $or: [
                { is_deleted: false },
                { is_deleted: true }
            ]
        })
            .populate({
                path: 'session_id',
                select: 'subject start_time'
            })
            .populate({
                path: 'call_session_id',
                select: 'name date start_time end_time'
            })
            .populate({
                path: 'center_id',
                select: 'name'
            })
            .populate({
                path: 'deleted_by',
                select: 'name'
            })
            .sort({ time_recorded: -1 })
            .limit(50)
            .lean();

        // Format records for frontend
        const formattedRecords = records.map(record => {
            const session = record.session_id;
            const center = record.center_id;

            // Use session_subject if available (preserved from deleted sessions), otherwise use populated session or call_session
            const callSession = record.call_session_id;
            const sessionSubject = record.session_subject || 
                (session ? session.subject : null) || 
                (callSession ? callSession.name : null);
            
            // Handle missing session or center (e.g. deleted)
            if (!session && !callSession && !sessionSubject) {
                return {
                    id: record._id,
                    time_recorded: record.time_recorded,
                    delay_minutes: record.delay_minutes,
                    subject: 'Unknown Session (Deleted)',
                    date: new Date(record.time_recorded).toISOString().split('T')[0],
                    start_time: '00:00:00',
                    end_time: '00:00:00',
                    center_name: center ? center.name : 'Unknown Center',
                    is_deleted: record.is_deleted,
                    deleted_by: record.is_deleted ? (record.deleted_by?.name || 'Unknown Admin') : null,
                    deleted_at: record.deleted_at,
                    deletion_reason: record.deletion_reason
                };
            }

            // Get session date and time - use session if available, otherwise use call_session or time_recorded
            // All times should be in Egypt timezone
            let sessionDate;
            let endTime;
            
            if (session && session.start_time) {
                // Regular session
                sessionDate = moment.tz(session.start_time, 'Africa/Cairo');
                // Regular sessions are 2 hours long
                const endMoment = sessionDate.clone().add(2, 'hours');
                const endHour = endMoment.hours().toString().padStart(2, '0');
                const endMinutes = endMoment.minutes().toString().padStart(2, '0');
                endTime = `${endHour}:${endMinutes}:00`;
            } else if (callSession && callSession.date && callSession.start_time) {
                // For call sessions, combine date and start_time
                const callDate = moment.tz(callSession.date, 'Africa/Cairo');
                const [hours, minutes] = callSession.start_time.split(':');
                callDate.hours(parseInt(hours));
                callDate.minutes(parseInt(minutes));
                sessionDate = callDate;
                
                // Use call session end_time if available, otherwise calculate from activity log or use default
                if (callSession.end_time) {
                    const endMoment = moment.tz(callSession.end_time, 'Africa/Cairo');
                    const endHour = endMoment.hours().toString().padStart(2, '0');
                    const endMinutes = endMoment.minutes().toString().padStart(2, '0');
                    endTime = `${endHour}:${endMinutes}:00`;
                } else {
                    // Fallback: try to get from activity log, or use 2 hours default
                    // For now, use 2 hours as default (could be improved by querying activity log)
                    const endMoment = sessionDate.clone().add(2, 'hours');
                    const endHour = endMoment.hours().toString().padStart(2, '0');
                    const endMinutes = endMoment.minutes().toString().padStart(2, '0');
                    endTime = `${endHour}:${endMinutes}:00`;
                }
            } else {
                // Fallback to time_recorded if session is deleted (already in Egypt timezone)
                sessionDate = moment.tz(record.time_recorded, 'Africa/Cairo');
                // Default 2 hours for deleted sessions
                const endMoment = sessionDate.clone().add(2, 'hours');
                const endHour = endMoment.hours().toString().padStart(2, '0');
                const endMinutes = endMoment.minutes().toString().padStart(2, '0');
                endTime = `${endHour}:${endMinutes}:00`;
            }

            const dateStr = sessionDate.format('YYYY-MM-DD');
            const hours = sessionDate.hours().toString().padStart(2, '0');
            const minutes = sessionDate.minutes().toString().padStart(2, '0');
            const startTime = `${hours}:${minutes}:00`;

            const result = {
                id: record._id,
                time_recorded: record.time_recorded,
                delay_minutes: record.delay_minutes,
                subject: sessionSubject || 'Unknown Session',
                date: dateStr,
                start_time: startTime,
                end_time: endTime,
                center_name: center ? center.name : 'Unknown Center'
            };

            // Add deletion information if record is deleted
            if (record.is_deleted) {
                result.is_deleted = true;
                result.deleted_by = record.deleted_by?.name || 'Unknown Admin';
                result.deleted_at = record.deleted_at;
                result.deletion_reason = record.deletion_reason || 'No reason provided';
            }

            return result;
        });

        res.json({
            success: true,
            data: formattedRecords
        });

    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance history'
        });
    }
};

module.exports = { recordAttendance, getMyAttendance };

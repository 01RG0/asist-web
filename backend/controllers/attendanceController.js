const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Center = require('../models/Center');
const { calculateDistance } = require('../utils/haversine');
const { logAuditAction } = require('../utils/auditLogger');

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
        const existingAttendance = await Attendance.findOne({
            session_id,
            assistant_id: assistantId
        });

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

        // Calculate delay
        const now = new Date();
        const sessionTime = new Date(session.start_time);

        // For weekly sessions, set the time to today
        if (session.recurrence_type === 'weekly') {
            const today = new Date();
            today.setHours(sessionTime.getHours(), sessionTime.getMinutes(), 0, 0);
            sessionTime.setTime(today.getTime());
        }

        const delayMs = now - sessionTime;
        const delayMinutes = Math.max(0, Math.floor(delayMs / 60000));

        // Record attendance
        const newAttendance = new Attendance({
            assistant_id: assistantId,
            session_id,
            center_id: session.center_id._id,
            latitude,
            longitude,
            time_recorded: now,
            delay_minutes: delayMinutes,
            notes: notes || ''
        });

        await newAttendance.save();

        const arrivalTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Extract time from start_time
        const hours = sessionTime.getHours().toString().padStart(2, '0');
        const minutes = sessionTime.getMinutes().toString().padStart(2, '0');
        const startTime = `${hours}:${minutes}`;

        // Log the action
        await logAuditAction(assistantId, 'RECORD_ATTENDANCE', {
            attendance_id: newAttendance._id.toString(),
            session_id,
            center_id: session.center_id._id.toString(),
            subject: session.subject,
            delay_minutes: delayMinutes,
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

        const records = await Attendance.find({ assistant_id: assistantId })
            .populate({
                path: 'session_id',
                select: 'subject start_time'
            })
            .populate({
                path: 'center_id',
                select: 'name'
            })
            .sort({ time_recorded: -1 })
            .limit(50)
            .lean();

        // Format records for frontend
        const formattedRecords = records.map(record => {
            const session = record.session_id;
            const sessionDate = new Date(session.start_time);

            const dateStr = sessionDate.toISOString().split('T')[0];
            const hours = sessionDate.getHours().toString().padStart(2, '0');
            const minutes = sessionDate.getMinutes().toString().padStart(2, '0');
            const startTime = `${hours}:${minutes}:00`;

            // Calculate end time (2 hours later)
            const endHour = (sessionDate.getHours() + 2).toString().padStart(2, '0');
            const endTime = `${endHour}:${minutes}:00`;

            return {
                id: record._id,
                time_recorded: record.time_recorded,
                delay_minutes: record.delay_minutes,
                subject: session.subject,
                date: dateStr,
                start_time: startTime,
                end_time: endTime,
                center_name: record.center_id.name
            };
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

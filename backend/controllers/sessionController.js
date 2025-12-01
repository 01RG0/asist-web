const Session = require('../models/Session');
const Center = require('../models/Center');
const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { getCurrentEgyptTime, getEgyptTimeDifferenceMinutes } = require('../utils/timezone');
const { logError } = require('../utils/errorLogger');

/**
 * Get assistant's sessions for today
 * GET /api/sessions/today
 */
const getTodaySessions = async (req, res) => {
    try {
        const assistantId = req.user.id;
        const now = getCurrentEgyptTime();
        
        // Get today's date in Egypt timezone (start of day) using moment
        const nowMoment = moment.tz(now, 'Africa/Cairo');
        const todayMoment = nowMoment.clone().startOf('day');
        const today = todayMoment.toDate();
        const tomorrowMoment = todayMoment.clone().add(1, 'day');
        const tomorrow = tomorrowMoment.toDate();

        // Get current day of week in Egypt timezone (1 = Monday, 7 = Sunday)
        // moment.day(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
        // Convert to our format: 1 = Monday, 7 = Sunday
        const jsDay = nowMoment.day();
        const ourDayOfWeek = jsDay === 0 ? 7 : jsDay;

        // Find sessions for today (one-time or weekly recurring)
        const sessions = await Session.find({
            $and: [
                {
                    $or: [
                        // One-time sessions scheduled for today
                        {
                            recurrence_type: 'one_time',
                            start_time: {
                                $gte: today,
                                $lt: tomorrow
                            }
                        },
                        // Weekly sessions for today's day of week
                        {
                            recurrence_type: 'weekly',
                            day_of_week: ourDayOfWeek,
                            is_active: true
                        }
                    ]
                },
                // Session must be assigned to this assistant or unassigned
                {
                    $or: [
                        { assistant_id: assistantId },
                        { assistant_id: null }
                    ]
                }
            ]
        })
            .populate('center_id', 'name latitude longitude radius_m')
            .sort({ start_time: 1 })
            .lean();

        // Format sessions and check attendance
        const formattedSessions = await Promise.all(sessions.map(async (session) => {
            // Extract time from start_time using Egypt timezone
            const sessionTime = moment.tz(session.start_time, 'Africa/Cairo');
            const hours = sessionTime.hours().toString().padStart(2, '0');
            const minutes = sessionTime.minutes().toString().padStart(2, '0');
            const startTime = `${hours}:${minutes}:00`;

            // Calculate end time (2 hours later) in Egypt timezone
            const endTimeMoment = sessionTime.clone().add(2, 'hours');
            const endHour = endTimeMoment.hours().toString().padStart(2, '0');
            const endMinutes = endTimeMoment.minutes().toString().padStart(2, '0');
            const endTime = `${endHour}:${endMinutes}:00`;

            const center = session.center_id;

            // For weekly sessions, check attendance by session_id AND today's date
            // For one-time sessions, check attendance by session_id only
            let attendance;
            if (session.recurrence_type === 'weekly') {
                // For weekly sessions, check if attendance exists for this session on today's date
                attendance = await Attendance.findOne({
                    session_id: session._id,
                    assistant_id: assistantId,
                    time_recorded: {
                        $gte: today,
                        $lt: tomorrow
                    }
                }).lean();
            } else {
                // For one-time sessions, check by session_id only
                attendance = await Attendance.findOne({
                    session_id: session._id,
                    assistant_id: assistantId
                }).lean();
            }

            // Calculate today's session start time in Egypt timezone
            let sessionStartTime;
            if (session.recurrence_type === 'weekly') {
                // For weekly sessions, use today's date with the session's time in Egypt timezone
                sessionStartTime = todayMoment.clone()
                    .hours(sessionTime.hours())
                    .minutes(sessionTime.minutes())
                    .seconds(0)
                    .milliseconds(0)
                    .toDate();
            } else {
                // For one-time sessions, use the actual session start time (already in Egypt timezone)
                sessionStartTime = new Date(session.start_time);
            }

            // Check if session is within attendance marking window
            // Allow 30 minutes before and 45 minutes after session start
            const timeDiffMinutes = getEgyptTimeDifferenceMinutes(now, sessionStartTime);
            const canMarkAttendance = !attendance && timeDiffMinutes >= -30 && timeDiffMinutes <= 45;

            return {
                id: session._id,
                subject: session.subject,
                date: todayMoment.format('YYYY-MM-DD'),
                start_time: startTime,
                end_time: endTime,
                center_id: center._id,
                center_name: center.name,
                latitude: center.latitude,
                longitude: center.longitude,
                radius_m: center.radius_m,
                attendance_id: attendance ? attendance._id : null,
                recurrence_type: session.recurrence_type,
                attended: attendance !== null,
                can_mark_attendance: canMarkAttendance
            };
        }));

        res.json({
            success: true,
            data: formattedSessions
        });

    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching sessions'
        });
    }
};

/**
 * Get specific session details
 * GET /api/sessions/:id
 */
const getSessionById = async (req, res) => {
    try {
        const { id } = req.params;
        const assistantId = req.user.id;

        const session = await Session.findOne({
            _id: id,
            $or: [
                { assistant_id: assistantId },
                { assistant_id: null }
            ]
        })
            .populate('center_id', 'name latitude longitude radius_m')
            .lean();

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found or not assigned to you'
            });
        }

        // Extract time from start_time using Egypt timezone
        const sessionTime = moment.tz(session.start_time, 'Africa/Cairo');
        const hours = sessionTime.hours().toString().padStart(2, '0');
        const minutes = sessionTime.minutes().toString().padStart(2, '0');
        const startTime = `${hours}:${minutes}:00`;

        // Calculate end time (2 hours later) in Egypt timezone
        const endTimeMoment = sessionTime.clone().add(2, 'hours');
        const endHour = endTimeMoment.hours().toString().padStart(2, '0');
        const endMinutes = endTimeMoment.minutes().toString().padStart(2, '0');
        const endTime = `${endHour}:${endMinutes}:00`;

        const center = session.center_id;
        // Get today's date in Egypt timezone
        const now = getCurrentEgyptTime();
        const todayMoment = moment.tz(now, 'Africa/Cairo').startOf('day');

        const formattedSession = {
            id: session._id,
            subject: session.subject,
            date: todayMoment.format('YYYY-MM-DD'),
            start_time: startTime,
            end_time: endTime,
            center_id: center._id,
            center_name: center.name,
            latitude: center.latitude,
            longitude: center.longitude,
            radius_m: center.radius_m
        };

        res.json({
            success: true,
            data: formattedSession
        });

    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching session'
        });
    }
};

module.exports = { getTodaySessions, getSessionById };

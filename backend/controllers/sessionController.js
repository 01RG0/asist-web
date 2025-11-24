const Session = require('../models/Session');
const Center = require('../models/Center');
const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');

/**
 * Get assistant's sessions for today
 * GET /api/sessions/today
 */
const getTodaySessions = async (req, res) => {
    try {
        const assistantId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get current day of week (1 = Monday, 7 = Sunday)
        // JavaScript getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
        // Convert to our format: 1 = Monday, 7 = Sunday
        const jsDay = today.getDay();
        const ourDayOfWeek = jsDay === 0 ? 7 : jsDay;

        // Find sessions for today (one-time or weekly recurring)
        const sessions = await Session.find({
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
            ],
            // Session must be assigned to this assistant or unassigned
            $or: [
                { assistant_id: assistantId },
                { assistant_id: null }
            ]
        })
            .populate('center_id', 'name latitude longitude radius_m')
            .sort({ start_time: 1 })
            .lean();

        // Format sessions and check attendance
        const formattedSessions = await Promise.all(sessions.map(async (session) => {
            // Check if attendance exists for this session
            const attendance = await Attendance.findOne({
                session_id: session._id,
                assistant_id: assistantId
            }).lean();

            // Extract time from start_time
            const sessionTime = new Date(session.start_time);
            const hours = sessionTime.getHours().toString().padStart(2, '0');
            const minutes = sessionTime.getMinutes().toString().padStart(2, '0');
            const startTime = `${hours}:${minutes}:00`;

            // Calculate end time (2 hours later)
            const endHour = (sessionTime.getHours() + 2).toString().padStart(2, '0');
            const endTime = `${endHour}:${minutes}:00`;

            const center = session.center_id;

            // Check if session is within attendance marking window
            // Allow 45 minutes before and 45 minutes after session start (90-minute window)
            const now = new Date();
            const sessionStartTime = new Date(session.start_time);

            // For weekly sessions, adjust to today's time
            if (session.recurrence_type === 'weekly') {
                const todayDate = new Date();
                todayDate.setHours(sessionStartTime.getHours(), sessionStartTime.getMinutes(), 0, 0);
                sessionStartTime.setTime(todayDate.getTime());
            }

            const timeDiffMs = now - sessionStartTime;
            const timeDiffMinutes = Math.floor(timeDiffMs / 60000);
            const canMarkAttendance = !attendance && timeDiffMinutes >= -45 && timeDiffMinutes <= 45;

            return {
                id: session._id,
                subject: session.subject,
                date: today.toISOString().split('T')[0],
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

        // Extract time from start_time
        const sessionTime = new Date(session.start_time);
        const hours = sessionTime.getHours().toString().padStart(2, '0');
        const minutes = sessionTime.getMinutes().toString().padStart(2, '0');
        const startTime = `${hours}:${minutes}:00`;

        // Calculate end time (2 hours later)
        const endHour = (sessionTime.getHours() + 2).toString().padStart(2, '0');
        const endTime = `${endHour}:${minutes}:00`;

        const center = session.center_id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const formattedSession = {
            id: session._id,
            subject: session.subject,
            date: today.toISOString().split('T')[0],
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

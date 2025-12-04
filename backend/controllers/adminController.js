const User = require('../models/User');
const Center = require('../models/Center');
const Session = require('../models/Session');
const CallSession = require('../models/CallSession');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const ErrorLog = require('../models/ErrorLog');
const bcrypt = require('bcryptjs');
const moment = require('moment-timezone');
const { logAuditAction } = require('../utils/auditLogger');
const { logError } = require('../utils/errorLogger');
const { parseAsEgyptTime, getCurrentEgyptTime, getEgyptTimeDifferenceMinutes } = require('../utils/timezone');
const { createDeletionBackup } = require('../utils/backupHelper');

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res) => {
    try {
        // Get today's date in Egypt timezone using moment
        const now = getCurrentEgyptTime();
        const todayMoment = moment.tz(now, 'Africa/Cairo').startOf('day');
        const today = todayMoment.toDate();
        const tomorrowMoment = todayMoment.clone().add(1, 'day');
        const tomorrow = tomorrowMoment.toDate();

        // Today's attendance count
        const totalAttendanceToday = await Attendance.countDocuments({
            time_recorded: {
                $gte: today,
                $lt: tomorrow
            }
        });

        // Late arrivals today
        const lateArrivals = await Attendance.countDocuments({
            time_recorded: {
                $gte: today,
                $lt: tomorrow
            },
            delay_minutes: { $gt: 0 }
        });

        // Total centers
        const totalCenters = await Center.countDocuments();

        // Active sessions today (one-time and weekly) - get day of week in Egypt timezone
        const jsDay = todayMoment.day();
        const ourDayOfWeek = jsDay === 0 ? 7 : jsDay;

        const activeSessions = await Session.countDocuments({
            $or: [
                {
                    recurrence_type: 'one_time',
                    start_time: {
                        $gte: today,
                        $lt: tomorrow
                    }
                },
                {
                    recurrence_type: 'weekly',
                    day_of_week: ourDayOfWeek,
                    is_active: true
                }
            ]
        });

        // Recent attendance today with details
        const recentAttendance = await Attendance.find({
            time_recorded: {
                $gte: today,
                $lt: tomorrow
            }
        })
            .populate('assistant_id', 'name')
            .populate('center_id', 'name')
            .populate('session_id', 'subject')
            .populate('call_session_id', 'name')
            .sort({ time_recorded: -1 })
            .limit(10)
            .lean();

        const formattedRecentAttendance = recentAttendance.map(a => ({
            id: a._id,
            time_recorded: a.time_recorded,
            delay_minutes: a.delay_minutes,
            assistant_name: a.assistant_id?.name || 'Unknown',
            center_name: a.center_id?.name || 'Unknown',
            subject: a.session_id?.subject || 'Unknown'
        }));

        res.json({
            success: true,
            data: {
                totalAttendanceToday,
                lateArrivals,
                totalCenters,
                activeSessions,
                recentAttendance: formattedRecentAttendance
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics'
        });
    }
};

/**
 * Get all assistants
 * GET /api/admin/assistants
 */
const getAllAssistants = async (req, res) => {
    try {
        const assistants = await User.find({ role: 'assistant' })
            .populate('assignedCenters', 'name')
            .sort({ name: 1 })
            .lean();

        const formattedAssistants = assistants.map(assistant => ({
            id: assistant._id,
            name: assistant.name,
            email: assistant.email,
            created_at: assistant.createdAt,
            centers: assistant.assignedCenters?.map(c => c.name).join(', ') || ''
        }));

        res.json({
            success: true,
            data: formattedAssistants
        });
    } catch (error) {
        console.error('Get assistants error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assistants'
        });
    }
};

/**
 * Create assistant
 * POST /api/admin/assistants
 */
const createAssistant = async (req, res) => {
    try {
        const { name, email, password, center_ids = [] } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        // Check if email exists
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create assistant
        const newAssistant = new User({
            name,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            role: 'assistant',
            assignedCenters: center_ids
        });

        await newAssistant.save();

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_ASSISTANT', {
            assistant_id: newAssistant._id.toString(),
            name,
            email,
            center_ids
        });

        res.status(201).json({
            success: true,
            message: 'Assistant created successfully',
            data: { id: newAssistant._id, name, email }
        });
    } catch (error) {
        console.error('Create assistant error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating assistant'
        });
    }
};

/**
 * Update assistant
 * PUT /api/admin/assistants/:id
 */
const updateAssistant = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, center_ids } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email.toLowerCase();
        if (center_ids !== undefined) updateData.assignedCenters = center_ids;

        const updatedAssistant = await User.findOneAndUpdate(
            { _id: id, role: 'assistant' },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedAssistant) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'UPDATE_ASSISTANT', {
            assistant_id: id,
            ...updateData
        });

        res.json({
            success: true,
            message: 'Assistant updated successfully'
        });
    } catch (error) {
        console.error('Update assistant error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating assistant'
        });
    }
};

/**
 * Delete assistant
 * DELETE /api/admin/assistants/:id
 */
const deleteAssistant = async (req, res) => {
    try {
        const { id } = req.params;

        // Get assistant data before deletion for backup
        const assistant = await User.findOne({
            _id: id,
            role: 'assistant'
        });

        if (!assistant) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        // Create backup before deletion
        await createDeletionBackup('assistant', assistant.toObject(), req.user.id);

        // Now delete the assistant
        await User.findOneAndDelete({
            _id: id,
            role: 'assistant'
        });

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_ASSISTANT', {
            assistant_id: id
        });

        res.json({
            success: true,
            message: 'Assistant deleted successfully (backup created)'
        });
    } catch (error) {
        console.error('Delete assistant error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting assistant'
        });
    }
};

/**
 * Get all sessions with filters
 * GET /api/admin/sessions
 */
const getAllSessions = async (req, res) => {
    try {
        const { date, center_id, assistant_id, recurrence_type } = req.query;

        const query = { is_active: true };

        if (date) {
            const targetDateMoment = moment.tz(date, 'Africa/Cairo').startOf('day');
            const targetDate = targetDateMoment.toDate();
            const nextDayMoment = targetDateMoment.clone().add(1, 'day');
            const nextDay = nextDayMoment.toDate();

            query.start_time = {
                $gte: targetDate,
                $lt: nextDay
            };
        }

        if (center_id) query.center_id = center_id;
        if (assistant_id) query.assistant_id = assistant_id;
        if (recurrence_type) query.recurrence_type = recurrence_type;

        const sessions = await Session.find(query)
            .populate('assistant_id', 'name')
            .populate('center_id', 'name')
            .sort({ start_time: -1 })
            .lean();

        const formattedSessions = sessions.map(s => ({
            id: s._id,
            subject: s.subject,
            start_time: s.start_time,
            recurrence_type: s.recurrence_type,
            day_of_week: s.day_of_week,
            is_active: s.is_active,
            assistant_name: s.assistant_id?.name || null,
            center_name: s.center_id?.name || 'Unknown',
            assistant_id: s.assistant_id?._id || null,
            center_id: s.center_id?._id
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
 * Get single session by ID
 * GET /api/admin/sessions/:id
 */
const getSessionById = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await Session.findById(id)
            .populate('assistant_id', 'name')
            .populate('center_id', 'name')
            .lean();

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        const formattedSession = {
            id: session._id,
            subject: session.subject,
            start_time: session.start_time,
            recurrence_type: session.recurrence_type,
            day_of_week: session.day_of_week,
            is_active: session.is_active,
            assistant_name: session.assistant_id?.name || null,
            center_name: session.center_id?.name || 'Unknown',
            assistant_id: session.assistant_id?._id || null,
            center_id: session.center_id?._id
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

/**
 * Create session
 * POST /api/admin/sessions
 */
const createSession = async (req, res) => {
    try {
        const {
            assistant_id = null,
            center_id,
            subject,
            start_time,
            recurrence_type = 'one_time',
            day_of_week = null
        } = req.body;

        if (!center_id || !subject || !start_time) {
            return res.status(400).json({
                success: false,
                message: 'Center, subject, and start time are required'
            });
        }

        // Validate weekly sessions have day_of_week
        if (recurrence_type === 'weekly' && !day_of_week) {
            return res.status(400).json({
                success: false,
                message: 'Day of week is required for weekly sessions'
            });
        }

        const newSession = new Session({
            assistant_id,
            center_id,
            subject,
            start_time: parseAsEgyptTime(start_time),
            recurrence_type,
            day_of_week
        });

        await newSession.save();

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_SESSION', {
            session_id: newSession._id.toString(),
            assistant_id,
            center_id,
            subject,
            start_time,
            recurrence_type,
            day_of_week
        });

        res.status(201).json({
            success: true,
            message: 'Session created successfully',
            data: { id: newSession._id }
        });
    } catch (error) {
        console.error('Create session error:', error);

        // Return detailed validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating session',
            error: error.message
        });
    }
};

/**
 * Update session
 * PUT /api/admin/sessions/:id
 */
const updateSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { assistant_id, center_id, subject, start_time, recurrence_type, day_of_week, is_active } = req.body;

        // Validate weekly sessions have day_of_week
        if (recurrence_type === 'weekly' && day_of_week === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Day of week is required for weekly sessions'
            });
        }

        const updateData = {};
        if (assistant_id !== undefined) updateData.assistant_id = assistant_id;
        if (center_id) updateData.center_id = center_id;
        if (subject) updateData.subject = subject;
        if (start_time) updateData.start_time = parseAsEgyptTime(start_time);
        if (recurrence_type) updateData.recurrence_type = recurrence_type;
        if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
        if (is_active !== undefined) updateData.is_active = is_active;

        const updatedSession = await Session.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedSession) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'UPDATE_SESSION', {
            session_id: id,
            ...updateData
        });

        res.json({
            success: true,
            message: 'Session updated successfully'
        });
    } catch (error) {
        console.error('Update session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating session'
        });
    }
};

/**
 * Delete session
 * DELETE /api/admin/sessions/:id
 */
const deleteSession = async (req, res) => {
    try {
        const { id } = req.params;

        // Get session before deletion to preserve subject
        const sessionToDelete = await Session.findById(id);

        if (!sessionToDelete) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Create backup before deletion
        await createDeletionBackup('session', sessionToDelete.toObject(), req.user.id);

        // Preserve session subject in all related attendance records before deletion
        // This ensures attendance records retain the session name even after deletion
        await Attendance.updateMany(
            { session_id: id },
            {
                $set: {
                    session_subject: sessionToDelete.subject
                }
            }
        );

        // Now delete the session
        await Session.findByIdAndDelete(id);

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_SESSION', {
            session_id: id,
            session_subject: sessionToDelete.subject
        });

        res.json({
            success: true,
            message: 'Session deleted successfully (backup created)'
        });
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting session'
        });
    }
};

/**
 * Get attendance records with filters
 * GET /api/admin/attendance
 */
const getAttendanceRecords = async (req, res) => {
    try {
        const { start_date, end_date, center_id, assistant_id, subject, page = 1, limit = 50 } = req.query;

        const query = {};

        if (start_date || end_date) {
            query.time_recorded = {};
            if (start_date) {
                const startDateMoment = moment.tz(start_date, 'Africa/Cairo').startOf('day');
                query.time_recorded.$gte = startDateMoment.toDate();
            }
            if (end_date) {
                const endDateMoment = moment.tz(end_date, 'Africa/Cairo').endOf('day');
                query.time_recorded.$lte = endDateMoment.toDate();
            }
        }

        if (center_id) query.center_id = center_id;
        if (assistant_id) query.assistant_id = assistant_id;

        // Get total count for pagination
        const total = await Attendance.countDocuments(query);

        // Get records (exclude soft-deleted by default)
        let attendanceQuery = Attendance.find({
            ...query,
            is_deleted: { $ne: true }
        })
            .populate('assistant_id', 'name')
            .populate('center_id', 'name')
            .populate('session_id', 'subject start_time')
            .populate('call_session_id', 'name date start_time')
            .sort({ time_recorded: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const records = await attendanceQuery;

        // Filter by subject if provided (done after populate)
        // Check both session_subject (for deleted sessions), populated session_id.subject, and call_session_id.name
        let filteredRecords = records;
        if (subject) {
            const subjectLower = subject.toLowerCase();
            filteredRecords = records.filter(r => {
                const sessionSubject = r.session_subject || 
                    r.session_id?.subject || 
                    r.call_session_id?.name || 
                    '';
                return sessionSubject.toLowerCase().includes(subjectLower);
            });
        }

        const formattedRecords = filteredRecords.map(r => {
            // Determine subject from session, call_session, or session_subject
            const subject = r.session_subject || 
                r.session_id?.subject || 
                r.call_session_id?.name || 
                'Unknown';
            
            // Determine start_time from session or call_session
            let start_time = r.session_id?.start_time;
            if (!start_time && r.call_session_id) {
                // For call sessions, combine date and start_time
                const callDate = moment.tz(r.call_session_id.date, 'Africa/Cairo');
                const [hours, minutes] = r.call_session_id.start_time.split(':');
                callDate.hours(parseInt(hours));
                callDate.minutes(parseInt(minutes));
                start_time = callDate.toDate();
            }
            
            return {
                id: r._id,
                time_recorded: r.time_recorded,
                delay_minutes: r.delay_minutes,
                notes: r.notes,
                assistant_name: r.assistant_id?.name || 'Unknown',
                center_name: r.center_id?.name || 'Unknown',
                subject: subject,
                start_time: start_time,
                latitude: r.latitude,
                longitude: r.longitude,
                is_call_session: !!r.call_session_id
            };
        });

        res.json({
            success: true,
            data: formattedRecords,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get attendance records error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance records'
        });
    }
};

/**
 * Record attendance manually (admin only) - Flexible version
 * POST /api/admin/attendance/manual
 */
const recordAttendanceManually = async (req, res) => {
    try {
        const { assistant_id, session_id, call_session_id, session_subject, time_recorded, delay_minutes = 0, notes = '' } = req.body;

        if (!assistant_id || !time_recorded) {
            return res.status(400).json({
                success: false,
                message: 'Assistant and time recorded are required'
            });
        }

        // Cannot have both session_id and call_session_id
        if (session_id && call_session_id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot specify both session and call session'
            });
        }

        // If session_id is provided, validate it exists
        let session = null;
        let callSession = null;
        let center_id = null;
        let latitude = null;
        let longitude = null;
        let finalSessionSubject = session_subject;

        if (session_id) {
            session = await Session.findById(session_id).lean();
            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }
            center_id = session.center_id;
            finalSessionSubject = session_subject || session.subject;

            // Get center coordinates for the attendance record
            const center = await Center.findById(center_id);
            if (!center) {
                return res.status(404).json({
                    success: false,
                    message: 'Center not found'
                });
            }
            latitude = center.latitude;
            longitude = center.longitude;
        } else if (call_session_id) {
            callSession = await CallSession.findById(call_session_id).lean();
            if (!callSession) {
                return res.status(404).json({
                    success: false,
                    message: 'Call session not found'
                });
            }
            finalSessionSubject = session_subject || callSession.name;

            // For call sessions, get assistant's first assigned center
            const assistant = await User.findById(assistant_id).select('assignedCenters').lean();
            if (assistant?.assignedCenters && assistant.assignedCenters.length > 0) {
                center_id = assistant.assignedCenters[0];
            }
            // GPS not required for call sessions
        } else {
            // For non-session attendance (WhatsApp, etc.), get assistant's first assigned center
            const assistant = await User.findById(assistant_id).select('assignedCenters').lean();
            if (assistant?.assignedCenters && assistant.assignedCenters.length > 0) {
                center_id = assistant.assignedCenters[0];
            }
            // GPS not required for non-session attendance
        }

        if (!session_subject && !session && !callSession) {
            return res.status(400).json({
                success: false,
                message: 'Session subject is required when no session is selected'
            });
        }

        // Parse time_recorded as Egypt timezone (same as normal attendance)
        const recordedTime = parseAsEgyptTime(time_recorded);

        // Check if attendance already exists
        let existing;
        if (session_id) {
            // For sessions, check by session_id and assistant
            if (session.recurrence_type === 'weekly') {
                const recordDateMoment = moment.tz(recordedTime, 'Africa/Cairo').startOf('day');
                const recordDate = recordDateMoment.toDate();
                const nextDayMoment = recordDateMoment.clone().add(1, 'day');
                const nextDay = nextDayMoment.toDate();

                existing = await Attendance.findOne({
                    session_id,
                    assistant_id,
                    time_recorded: {
                        $gte: recordDate,
                        $lt: nextDay
                    }
                });
            } else {
                existing = await Attendance.findOne({
                    session_id,
                    assistant_id
                });
            }
        } else if (call_session_id) {
            // For call sessions, check by call_session_id and assistant
            existing = await Attendance.findOne({
                call_session_id,
                assistant_id
            });
        } else {
            // For non-session attendance, check by time and subject
            const recordDateMoment = moment.tz(recordedTime, 'Africa/Cairo').startOf('day');
            const recordDate = recordDateMoment.toDate();
            const nextDayMoment = recordDateMoment.clone().add(1, 'day');
            const nextDay = nextDayMoment.toDate();

            existing = await Attendance.findOne({
                assistant_id,
                session_id: null,
                call_session_id: null,
                session_subject: finalSessionSubject,
                time_recorded: {
                    $gte: recordDate,
                    $lt: nextDay
                }
            });
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Attendance record already exists for this assistant'
            });
        }

        // Calculate delay if session or call_session is provided (same logic as normal attendance)
        let actualDelayMinutes = parseInt(delay_minutes) || 0;
        if (session_id && session) {
            // Parse session start time in Egypt timezone (same as normal attendance)
            let sessionTime;
            if (session.recurrence_type === 'weekly') {
                // For weekly sessions, set the time to the recorded date in Egypt timezone
                const recordedMoment = moment.tz(recordedTime, 'Africa/Cairo');
                const sessionMoment = moment.tz(session.start_time, 'Africa/Cairo');
                sessionTime = recordedMoment.clone()
                    .hours(sessionMoment.hours())
                    .minutes(sessionMoment.minutes())
                    .seconds(0)
                    .milliseconds(0)
                    .toDate();
            } else {
                // For one-time sessions, use the actual session start time (already in Egypt timezone)
                sessionTime = new Date(session.start_time);
            }

            // Calculate delay using Egypt timezone (same as normal attendance)
            const calculatedDelay = getEgyptTimeDifferenceMinutes(recordedTime, sessionTime);

            // Round to nearest whole minute and normalize (same as normal attendance)
            const roundedDelay = Math.round(calculatedDelay);
            // If marked early or on time, delay = 0, otherwise delay = full minutes late
            actualDelayMinutes = roundedDelay <= 0 ? 0 : roundedDelay;
        } else if (call_session_id && callSession) {
            // For call sessions, calculate delay based on call session start time
            const callDate = moment.tz(callSession.date, 'Africa/Cairo');
            const [hours, minutes] = callSession.start_time.split(':');
            callDate.hours(parseInt(hours));
            callDate.minutes(parseInt(minutes));
            callDate.seconds(0);
            callDate.milliseconds(0);
            const sessionTime = callDate.toDate();

            // Calculate delay using Egypt timezone
            const calculatedDelay = getEgyptTimeDifferenceMinutes(recordedTime, sessionTime);
            const roundedDelay = Math.round(calculatedDelay);
            actualDelayMinutes = roundedDelay <= 0 ? 0 : roundedDelay;
        }

        const newAttendance = new Attendance({
            assistant_id,
            session_id: session_id || null,
            call_session_id: call_session_id || null,
            session_subject: finalSessionSubject,
            center_id: center_id || null,
            latitude: latitude,
            longitude: longitude,
            time_recorded: recordedTime,
            delay_minutes: actualDelayMinutes,
            notes: notes || 'Manually recorded by admin'
        });

        try {
            await newAttendance.save();
        } catch (saveError) {
            // Handle E11000 duplicate key error with better message
            if (saveError.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'Attendance record already exists for this assistant and session'
                });
            }
            throw saveError;
        }

        // Log the action
        await logAuditAction(req.user.id, 'MANUAL_ATTENDANCE', {
            attendance_id: newAttendance._id.toString(),
            assistant_id,
            session_id,
            center_id,
            delay_minutes: actualDelayMinutes
        });

        res.status(201).json({
            success: true,
            message: 'Attendance recorded successfully',
            data: { id: newAttendance._id }
        });
    } catch (error) {
        console.error('Record attendance manually error:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording attendance'
        });
    }
};

/**
 * Clear/delete attendance record (soft delete)
 * DELETE /api/admin/attendance/:id
 */
const clearAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Require deletion reason
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Deletion reason is required'
            });
        }

        if (reason.trim().length > 200) {
            return res.status(400).json({
                success: false,
                message: 'Deletion reason cannot exceed 200 characters'
            });
        }

        const attendance = await Attendance.findById(id);

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        // Soft delete the record
        attendance.is_deleted = true;
        attendance.deleted_by = req.user.id;
        attendance.deleted_at = getCurrentEgyptTime();
        attendance.deletion_reason = reason.trim();

        await attendance.save();

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_ATTENDANCE', {
            attendance_id: id,
            reason: attendance.deletion_reason
        });

        res.json({
            success: true,
            message: 'Attendance record marked as deleted successfully'
        });
    } catch (error) {
        console.error('Clear attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking attendance record as deleted'
        });
    }
};

/**
 * Get single attendance record by ID
 * GET /api/admin/attendance/:id
 */
const getAttendanceById = async (req, res) => {
    try {
        const { id } = req.params;

        const attendance = await Attendance.findById(id)
            .populate('assistant_id', 'name email')
            .populate('session_id', 'subject start_time')
            .populate('call_session_id', 'name date start_time')
            .populate('center_id', 'name')
            .lean();

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        const formattedAttendance = {
            id: attendance._id,
            assistant_id: attendance.assistant_id?._id,
            assistant_name: attendance.assistant_id?.name || 'Unknown',
            session_id: attendance.session_id?._id,
            call_session_id: attendance.call_session_id?._id,
            session_subject: attendance.session_subject || 
                attendance.session_id?.subject || 
                attendance.call_session_id?.name || 
                'Unknown',
            center_id: attendance.center_id?._id,
            center_name: attendance.center_id?.name || 'Unknown',
            time_recorded: attendance.time_recorded,
            delay_minutes: attendance.delay_minutes,
            latitude: attendance.latitude,
            longitude: attendance.longitude,
            is_call_session: !!attendance.call_session_id,
            notes: attendance.notes || ''
        };

        res.json({
            success: true,
            data: formattedAttendance
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance record'
        });
    }
};

/**
 * Update attendance record
 * PUT /api/admin/attendance/:id
 */
const updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { assistant_id, session_id, center_id, time_recorded, delay_minutes, notes } = req.body;

        const updateData = {};
        if (assistant_id) updateData.assistant_id = assistant_id;
        if (session_id) updateData.session_id = session_id;
        if (center_id) updateData.center_id = center_id;
        if (time_recorded) updateData.time_recorded = parseAsEgyptTime(time_recorded);
        if (delay_minutes !== undefined) updateData.delay_minutes = parseInt(delay_minutes);
        if (notes !== undefined) updateData.notes = notes;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const updatedAttendance = await Attendance.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedAttendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'UPDATE_ATTENDANCE', {
            attendance_id: id,
            ...updateData
        });

        res.json({
            success: true,
            message: 'Attendance record updated successfully'
        });
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating attendance record'
        });
    }
};

/**
 * Get all users (assistants and admins)
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('_id name email role createdAt')
            .sort({ name: 1 })
            .lean();

        const formattedUsers = users.map(u => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            created_at: u.createdAt
        }));

        res.json({
            success: true,
            data: formattedUsers
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users'
        });
    }
};

/**
 * Get single user by ID
 * GET /api/admin/users/:id
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select('_id name email role createdAt')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                created_at: user.createdAt
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user'
        });
    }
};

/**
 * Create user (assistant or admin)
 * POST /api/admin/users
 */
const createUser = async (req, res) => {
    try {
        const { name, email, password, role = 'assistant' } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        // Check if email exists
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            role
        });

        await newUser.save();

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_USER', {
            user_id: newUser._id.toString(),
            name,
            email,
            role
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: { id: newUser._id, name, email, role }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user'
        });
    }
};

/**
 * Update user
 * PUT /api/admin/users/:id
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, password } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email.toLowerCase();
        if (role) updateData.role = role;
        if (password) {
            updateData.password_hash = await bcrypt.hash(password, 10);
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'UPDATE_USER', {
            user_id: id,
            name,
            email,
            role
        });

        res.json({
            success: true,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user'
        });
    }
};

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_USER', {
            user_id: id
        });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user'
        });
    }
};

/**
 * Change user password
 * POST /api/admin/users/:id/password
 */
const changeUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        // Accept either `new_password` (older API) or `password` (frontend)
        const newPassword = req.body.new_password || req.body.password || req.body.newPassword || req.body.newpassword;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { password_hash: passwordHash },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'CHANGE_PASSWORD', {
            user_id: id
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password'
        });
    }
};

/**
 * Get audit logs
 * GET /api/admin/audit-logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const { user_id, action, start_date, end_date, page = 1, limit = 50 } = req.query;

        const query = {};

        if (user_id) query.user_id = user_id;
        if (action) query.action = action;

        if (start_date || end_date) {
            query.timestamp = {};
            if (start_date) {
                const startDateMoment = moment.tz(start_date, 'Africa/Cairo').startOf('day');
                query.timestamp.$gte = startDateMoment.toDate();
            }
            if (end_date) {
                const endDateMoment = moment.tz(end_date, 'Africa/Cairo').endOf('day');
                query.timestamp.$lte = endDateMoment.toDate();
            }
        }

        const total = await AuditLog.countDocuments(query);

        const logs = await AuditLog.find(query)
            .populate('user_id', 'name email')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const formattedLogs = logs.map(log => ({
            id: log._id,
            user_id: log.user_id?._id,
            user_name: log.user_id?.name || 'Unknown',
            user_email: log.user_id?.email,
            action: log.action,
            details: log.details,
            timestamp: log.timestamp,
            ip_address: log.ip_address
        }));

        res.json({
            success: true,
            data: formattedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching audit logs'
        });
    }
};

/**
 * Get error logs
 * GET /api/admin/error-logs
 */
const getErrorLogs = async (req, res) => {
    try {
        const { level, resolved, start_date, end_date, page = 1, limit = 50 } = req.query;

        const query = {};

        if (level) query.level = level;
        if (resolved !== undefined) query.resolved = resolved === 'true';

        if (start_date || end_date) {
            query.timestamp = {};
            if (start_date) {
                const startDateMoment = moment.tz(start_date, 'Africa/Cairo').startOf('day');
                query.timestamp.$gte = startDateMoment.toDate();
            }
            if (end_date) {
                const endDateMoment = moment.tz(end_date, 'Africa/Cairo').endOf('day');
                query.timestamp.$lte = endDateMoment.toDate();
            }
        }

        const total = await ErrorLog.countDocuments(query);

        const logs = await ErrorLog.find(query)
            .populate('user_id', 'name email')
            .populate('resolved_by', 'name email')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const formattedLogs = logs.map(log => ({
            id: log._id,
            level: log.level,
            message: log.message,
            stack: log.stack,
            context: log.context,
            user_id: log.user_id?._id,
            user_name: log.user_id?.name || null,
            user_email: log.user_id?.email || null,
            endpoint: log.endpoint,
            method: log.method,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            resolved: log.resolved,
            resolved_by: log.resolved_by?._id,
            resolved_by_name: log.resolved_by?.name || null,
            resolved_at: log.resolved_at,
            resolution_notes: log.resolution_notes,
            timestamp: log.timestamp
        }));

        res.json({
            success: true,
            data: formattedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get error logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching error logs'
        });
    }
};

/**
 * Get single error log by ID
 * GET /api/admin/error-logs/:id
 */
const getErrorLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const log = await ErrorLog.findById(id)
            .populate('user_id', 'name email')
            .populate('resolved_by', 'name email')
            .lean();

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Error log not found'
            });
        }

        const formattedLog = {
            id: log._id,
            level: log.level,
            message: log.message,
            stack: log.stack,
            context: log.context,
            user_id: log.user_id?._id,
            user_name: log.user_id?.name || null,
            user_email: log.user_id?.email || null,
            endpoint: log.endpoint,
            method: log.method,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            resolved: log.resolved,
            resolved_by: log.resolved_by?._id,
            resolved_by_name: log.resolved_by?.name || null,
            resolved_at: log.resolved_at,
            resolution_notes: log.resolution_notes,
            timestamp: log.timestamp
        };

        res.json({
            success: true,
            data: formattedLog
        });
    } catch (error) {
        console.error('Get error log by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching error log'
        });
    }
};

/**
 * Mark error log as resolved
 * PUT /api/admin/error-logs/:id/resolve
 */
const markErrorResolved = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_notes } = req.body;
        const userId = req.user.id;

        const log = await ErrorLog.findById(id);

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Error log not found'
            });
        }

        await log.markResolved(userId, resolution_notes);

        res.json({
            success: true,
            message: 'Error log marked as resolved',
            data: {
                id: log._id,
                resolved: log.resolved,
                resolved_by: log.resolved_by,
                resolved_at: log.resolved_at
            }
        });
    } catch (error) {
        console.error('Mark error resolved error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking error log as resolved'
        });
    }
};

/**
 * Clear all error logs
 * DELETE /api/admin/error-logs
 */
const clearErrorLogs = async (req, res) => {
    try {
        const { resolved_only, older_than_days } = req.body;

        const query = {};

        if (resolved_only) {
            query.resolved = true;
        }

        if (older_than_days) {
            const date = new Date();
            date.setDate(date.getDate() - parseInt(older_than_days));
            query.timestamp = { $lt: date };
        }

        const result = await ErrorLog.deleteMany(query);

        // Log the action
        await logAuditAction(req.user.id, 'CLEAR_ERROR_LOGS', {
            count: result.deletedCount,
            filters: { resolved_only, older_than_days }
        });

        res.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} error logs`
        });
    } catch (error) {
        console.error('Clear error logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error clearing error logs'
        });
    }
};

/**
 * Delete error log
 * DELETE /api/admin/error-logs/:id
 */
const deleteErrorLog = async (req, res) => {
    try {
        const { id } = req.params;

        const log = await ErrorLog.findByIdAndDelete(id);

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Error log not found'
            });
        }

        res.json({
            success: true,
            message: 'Error log deleted successfully'
        });
    } catch (error) {
        console.error('Delete error log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting error log'
        });
    }
};

module.exports = {
    getDashboardStats,
    getAllAssistants,
    createAssistant,
    updateAssistant,
    deleteAssistant,
    getAllSessions,
    getSessionById,
    createSession,
    updateSession,
    deleteSession,
    getAttendanceRecords,
    getAttendanceById,
    recordAttendanceManually,
    updateAttendance,
    clearAttendance,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    changeUserPassword,
    getAuditLogs,
    getErrorLogs,
    getErrorLogById,
    markErrorResolved,
    deleteErrorLog,
    clearErrorLogs
};

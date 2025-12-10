const WhatsAppSchedule = require('../models/WhatsAppSchedule');
const CallSession = require('../models/CallSession');
const CallSessionStudent = require('../models/CallSessionStudent');
const ActivityLog = require('../models/ActivityLog');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const moment = require('moment-timezone');
const { getCurrentEgyptTime, parseAsEgyptTime, getEgyptTimeDifferenceMinutes } = require('../utils/timezone');
const { logAuditAction } = require('../utils/auditLogger');
const { logError } = require('../utils/errorLogger');

// ============================================
// WhatsApp Schedule CRUD
// ============================================

/**
 * Create WhatsApp Schedule
 * POST /api/activities/whatsapp-schedules
 */
const createWhatsAppSchedule = async (req, res) => {
    try {
        const { user_id, day_of_week, start_time, end_time, is_active = true } = req.body;

        if (!user_id || !day_of_week || !start_time || !end_time) {
            return res.status(400).json({
                success: false,
                message: 'User, day of week, start time, and end time are required'
            });
        }

        // Validate day of week
        if (day_of_week < 1 || day_of_week > 7) {
            return res.status(400).json({
                success: false,
                message: 'Day of week must be between 1 (Monday) and 7 (Sunday)'
            });
        }

        // Check if schedule already exists for this user and day
        const existingSchedule = await WhatsAppSchedule.findOne({
            user_id,
            day_of_week,
            is_active: true
        });

        if (existingSchedule) {
            return res.status(409).json({
                success: false,
                message: 'An active schedule already exists for this user on this day'
            });
        }

        const newSchedule = new WhatsAppSchedule({
            user_id,
            day_of_week,
            start_time,
            end_time,
            is_active
        });

        await newSchedule.save();

        await logAuditAction(req.user.id, 'CREATE_WHATSAPP_SCHEDULE', {
            schedule_id: newSchedule._id.toString(),
            user_id,
            day_of_week,
            start_time,
            end_time
        });

        res.status(201).json({
            success: true,
            message: 'WhatsApp schedule created successfully',
            data: { id: newSchedule._id }
        });
    } catch (error) {
        console.error('Create WhatsApp schedule error:', error);
        await logError(req.user.id, 'CREATE_WHATSAPP_SCHEDULE', error);
        res.status(500).json({
            success: false,
            message: 'Error creating WhatsApp schedule',
            error: error.message
        });
    }
};

/**
 * Get WhatsApp Schedules
 * GET /api/activities/whatsapp-schedules
 */
const getWhatsAppSchedules = async (req, res) => {
    try {
        const { user_id, day_of_week, is_active } = req.query;

        const query = {};
        if (user_id) query.user_id = user_id;
        if (day_of_week) query.day_of_week = parseInt(day_of_week);
        if (is_active !== undefined) query.is_active = is_active === 'true';

        const schedules = await WhatsAppSchedule.find(query)
            .populate('user_id', 'name email')
            .sort({ day_of_week: 1, start_time: 1 })
            .lean();

        const formattedSchedules = schedules.map(schedule => ({
            id: schedule._id,
            user_id: schedule.user_id?._id,
            user_name: schedule.user_id?.name || 'Unknown',
            day_of_week: schedule.day_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            is_active: schedule.is_active,
            created_at: schedule.createdAt,
            updated_at: schedule.updatedAt
        }));

        res.json({
            success: true,
            data: formattedSchedules
        });
    } catch (error) {
        console.error('Get WhatsApp schedules error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching WhatsApp schedules'
        });
    }
};

/**
 * Update WhatsApp Schedule
 * PUT /api/activities/whatsapp-schedules/:id
 */
const updateWhatsAppSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, day_of_week, start_time, end_time, is_active } = req.body;

        const updateData = {};
        if (user_id) updateData.user_id = user_id;
        if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
        if (start_time) updateData.start_time = start_time;
        if (end_time) updateData.end_time = end_time;
        if (is_active !== undefined) updateData.is_active = is_active;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const updatedSchedule = await WhatsAppSchedule.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedSchedule) {
            return res.status(404).json({
                success: false,
                message: 'WhatsApp schedule not found'
            });
        }

        await logAuditAction(req.user.id, 'UPDATE_WHATSAPP_SCHEDULE', {
            schedule_id: id,
            ...updateData
        });

        res.json({
            success: true,
            message: 'WhatsApp schedule updated successfully'
        });
    } catch (error) {
        console.error('Update WhatsApp schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating WhatsApp schedule',
            error: error.message
        });
    }
};

/**
 * Delete WhatsApp Schedule
 * DELETE /api/activities/whatsapp-schedules/:id
 */
const deleteWhatsAppSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await WhatsAppSchedule.findByIdAndDelete(id);

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'WhatsApp schedule not found'
            });
        }

        await logAuditAction(req.user.id, 'DELETE_WHATSAPP_SCHEDULE', {
            schedule_id: id
        });

        res.json({
            success: true,
            message: 'WhatsApp schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete WhatsApp schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting WhatsApp schedule'
        });
    }
};

// ============================================
// Call Session CRUD
// ============================================

/**
 * Create Call Session
 * POST /api/activities/call-sessions
 */
const createCallSession = async (req, res) => {
    try {
        const { name, date, start_time } = req.body;

        if (!name || !date || !start_time) {
            return res.status(400).json({
                success: false,
                message: 'Name, date, and start time are required'
            });
        }

        const newSession = new CallSession({
            name,
            date: parseAsEgyptTime(date),
            start_time,
            status: 'pending'
        });

        await newSession.save();

        await logAuditAction(req.user.id, 'CREATE_CALL_SESSION', {
            session_id: newSession._id.toString(),
            name,
            date,
            start_time
        });

        res.status(201).json({
            success: true,
            message: 'Call session created successfully',
            data: { id: newSession._id }
        });
    } catch (error) {
        console.error('Create call session error:', error);
        await logError(req.user.id, 'CREATE_CALL_SESSION', error);
        res.status(500).json({
            success: false,
            message: 'Error creating call session',
            error: error.message
        });
    }
};

/**
 * Get Call Sessions
 * GET /api/activities/call-sessions
 */
const getCallSessions = async (req, res) => {
    try {
        const { date, status, assistant_id } = req.query;
        const currentUserId = req.user?.id;

        const query = {};
        if (date) {
            const dateMoment = moment.tz(date, 'Africa/Cairo').startOf('day');
            const startOfDay = dateMoment.toDate();
            const endOfDay = dateMoment.clone().add(1, 'day').toDate();
            query.date = { $gte: startOfDay, $lt: endOfDay };
        }
        if (status) {
            if (status.includes(',')) {
                query.status = { $in: status.split(',') };
            } else {
                query.status = status;
            }
        }
        if (assistant_id) query.assistant_id = assistant_id;

        const sessions = await CallSession.find(query)
            .populate('assistant_id', 'name email')
            .populate('assistants', 'name email')
            .sort({ date: -1, start_time: 1 })
            .lean();

        // Get all activity logs for current user for these sessions
        const sessionIds = sessions.map(s => s._id);
        let userActivityLogs = [];
        if (currentUserId && sessionIds.length > 0) {
            userActivityLogs = await ActivityLog.find({
                user_id: currentUserId,
                call_session_id: { $in: sessionIds },
                type: 'call'
            }).lean();
        }

        const formattedSessions = sessions.map(session => {
            const dateMoment = moment.tz(session.date, 'Africa/Cairo');
            const assistants = session.assistants || [];
            const assistantNames = assistants.map(a => a.name || 'Unknown').filter(Boolean);

            // Check if current user has an activity log for this session
            const userLog = userActivityLogs.find(
                log => log.call_session_id.toString() === session._id.toString()
            );
            // Has completed participation if log exists AND has end_time
            const hasCompletedParticipation = userLog && userLog.end_time != null;
            // Is currently active in session if log exists but no end_time
            const isCurrentlyActive = userLog && userLog.end_time == null;

            return {
                id: session._id,
                name: session.name,
                date: dateMoment.format('YYYY-MM-DD'),
                start_time: session.start_time,
                status: session.status,
                assistant_id: session.assistant_id?._id || null,
                assistant_name: session.assistant_id?.name || null,
                assistants: assistants.map(a => ({ id: a._id, name: a.name || 'Unknown' })),
                assistant_names: assistantNames,
                end_time: session.end_time,
                hasCompletedParticipation,
                isCurrentlyActive,
                created_at: session.createdAt,
                updated_at: session.updatedAt
            };
        });

        res.json({
            success: true,
            data: formattedSessions
        });
    } catch (error) {
        console.error('Get call sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching call sessions'
        });
    }
};


/**
 * Get Call Session by ID
 * GET /api/activities/call-sessions/:id
 */
const getCallSessionById = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await CallSession.findById(id)
            .populate('assistant_id', 'name email')
            .populate('assistants', 'name email')
            .lean();

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Call session not found'
            });
        }

        const dateMoment = moment.tz(session.date, 'Africa/Cairo');
        const assistants = session.assistants || [];
        const assistantNames = assistants.map(a => a.name || 'Unknown').filter(Boolean);

        // Calculate stats
        const totalStudents = await CallSessionStudent.countDocuments({ call_session_id: id });
        const globalCompleted = await CallSessionStudent.countDocuments({
            call_session_id: id,
            filter_status: { $ne: '' }
        });
        const remainingStudents = totalStudents - globalCompleted;

        // Calculate user-specific completed count
        const userCompleted = await CallSessionStudent.countDocuments({
            call_session_id: id,
            filter_status: { $ne: '' },
            assigned_to: req.user.id
        });

        const formattedSession = {
            id: session._id,
            name: session.name,
            date: dateMoment.format('YYYY-MM-DD'),
            start_time: session.start_time,
            status: session.status,
            assistant_id: session.assistant_id?._id || null,
            assistant_name: session.assistant_id?.name || null,
            assistants: assistants.map(a => ({ id: a._id, name: a.name || 'Unknown' })),
            assistant_names: assistantNames,
            end_time: session.end_time,
            created_at: session.createdAt,
            updated_at: session.updatedAt,
            stats: {
                total: totalStudents,
                completed: userCompleted,
                remaining: remainingStudents
            }
        };

        res.json({
            success: true,
            data: formattedSession
        });
    } catch (error) {
        console.error('Get call session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching call session'
        });
    }
};

/**
 * Update Call Session
 * PUT /api/activities/call-sessions/:id
 */
const updateCallSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, date, start_time, status, assistant_id, end_time } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (date) updateData.date = parseAsEgyptTime(date);
        if (start_time) updateData.start_time = start_time;
        if (status) updateData.status = status;
        if (assistant_id !== undefined) updateData.assistant_id = assistant_id;
        if (end_time !== undefined) {
            // If end_time is provided, parse it as a datetime
            if (end_time) {
                updateData.end_time = parseAsEgyptTime(end_time);
            } else {
                updateData.end_time = null;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const updatedSession = await CallSession.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedSession) {
            return res.status(404).json({
                success: false,
                message: 'Call session not found'
            });
        }

        // If end_time was set and session is active, check if we need to auto-end it
        if (updateData.end_time && updatedSession.status === 'active') {
            const now = getCurrentEgyptTime();
            const endTimeMoment = moment.tz(updatedSession.end_time, 'Africa/Cairo');
            const nowMoment = moment.tz(now, 'Africa/Cairo');

            // If end_time has passed, auto-end the session
            if (endTimeMoment.isSameOrBefore(nowMoment)) {
                updatedSession.status = 'completed';
                // Use the set end_time, not current time
                updatedSession.end_time = updatedSession.end_time;
                await updatedSession.save();

                // Update all related activity logs with end_time and calculate duration
                const activityLogs = await ActivityLog.find({
                    call_session_id: id,
                    end_time: null
                });

                for (const log of activityLogs) {
                    log.end_time = updatedSession.end_time;
                    // Calculate duration
                    if (log.start_time) {
                        const durationMs = updatedSession.end_time.getTime() - log.start_time.getTime();
                        log.duration_minutes = Math.round(durationMs / (1000 * 60));
                    }
                    await log.save();
                }
            }
        }

        await logAuditAction(req.user.id, 'UPDATE_CALL_SESSION', {
            session_id: id,
            ...updateData
        });

        res.json({
            success: true,
            message: 'Call session updated successfully'
        });
    } catch (error) {
        console.error('Update call session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating call session',
            error: error.message
        });
    }
};

/**
 * Delete Call Session
 * DELETE /api/activities/call-sessions/:id
 */
const deleteCallSession = async (req, res) => {
    try {
        const { id } = req.params;

        // Get call session before deletion to preserve name in attendance records
        const sessionToDelete = await CallSession.findById(id);

        if (!sessionToDelete) {
            return res.status(404).json({
                success: false,
                message: 'Call session not found'
            });
        }

        // Preserve call session name in all related attendance records before deletion
        // This ensures attendance records retain the call session name even after deletion
        await Attendance.updateMany(
            { call_session_id: id },
            {
                $set: {
                    session_subject: sessionToDelete.name
                }
            }
        );

        // Now delete the call session
        await CallSession.findByIdAndDelete(id);

        // Also delete related activity logs
        await ActivityLog.deleteMany({ call_session_id: id });

        await logAuditAction(req.user.id, 'DELETE_CALL_SESSION', {
            session_id: id,
            session_name: sessionToDelete.name
        });

        res.json({
            success: true,
            message: 'Call session deleted successfully'
        });
    } catch (error) {
        console.error('Delete call session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting call session'
        });
    }
};

/**
 * Start Call Session (Assistant)
 * POST /api/activities/call-sessions/:id/start
 */
const startCallSession = async (req, res) => {
    try {
        const { id } = req.params;
        const assistantId = req.user.id;

        const session = await CallSession.findById(id);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Call session not found'
            });
        }

        if (session.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Call session is already completed'
            });
        }

        // Check if assistant is already in the session
        const assistants = session.assistants || [];
        const assistantIdStr = assistantId.toString();
        const isAlreadyJoined = assistants.some(aid => {
            const aidStr = aid.toString ? aid.toString() : String(aid);
            return aidStr === assistantIdStr;
        });
        const isFirstAssistant = session.assistant_id && session.assistant_id.toString() === assistantIdStr;

        if (isAlreadyJoined || isFirstAssistant) {
            return res.status(400).json({
                success: false,
                message: 'You have already joined this call session'
            });
        }

        // Check if date is today
        const now = getCurrentEgyptTime();
        const sessionDate = moment.tz(session.date, 'Africa/Cairo').startOf('day');
        const today = moment.tz(now, 'Africa/Cairo').startOf('day');

        if (!sessionDate.isSame(today)) {
            return res.status(400).json({
                success: false,
                message: 'Call session is not scheduled for today'
            });
        }

        // Update session status and add assistant to array
        if (session.status === 'pending') {
            session.status = 'active';
        }

        // Add assistant to assistants array if not already present
        if (!session.assistants) {
            session.assistants = [];
        }
        // assistantIdStr is already declared above, reuse it
        const isAlreadyInArray = session.assistants.some(aid => {
            const aidStr = aid.toString ? aid.toString() : String(aid);
            return aidStr === assistantIdStr;
        });
        if (!isAlreadyInArray) {
            session.assistants.push(assistantId);
        }

        // Keep assistant_id for backward compatibility (first assistant)
        if (!session.assistant_id) {
            session.assistant_id = assistantId;
        }

        await session.save();

        // Create activity log
        const sessionDateTime = moment.tz(session.date, 'Africa/Cairo');
        const [hours, minutes] = session.start_time.split(':');
        sessionDateTime.hours(parseInt(hours));
        sessionDateTime.minutes(parseInt(minutes));
        sessionDateTime.seconds(0);
        sessionDateTime.milliseconds(0);

        const activityLog = new ActivityLog({
            user_id: assistantId,
            type: 'call',
            start_time: sessionDateTime.toDate(),
            call_session_id: session._id
        });

        await activityLog.save();

        // Note: Call sessions do NOT create attendance records
        // They only create activity logs which appear in Activity Records page

        await logAuditAction(assistantId, 'START_CALL_SESSION', {
            session_id: id,
            activity_log_id: activityLog._id.toString()
        });

        res.json({
            success: true,
            message: 'Call session started successfully',
            data: {
                session_id: session._id,
                activity_log_id: activityLog._id
            }
        });
    } catch (error) {
        console.error('Start call session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting call session',
            error: error.message
        });
    }
};

/**
 * Stop Call Session (Admin or Assistant)
 * POST /api/activities/call-sessions/:id/stop
 */
const stopCallSession = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const session = await CallSession.findById(id);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Call session not found'
            });
        }

        // Only check if session is active when admin is trying to end the entire session
        // Assistants can end their participation anytime
        if (isAdmin && session.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Call session is not active (current status: ${session.status})`
            });
        }

        // If end_time is set by admin, assistants cannot manually end the session
        // Only admin can override the scheduled end_time
        if (!isAdmin && session.end_time) {
            return res.status(403).json({
                success: false,
                message: 'This call session has a scheduled end time set by admin. It will end automatically at the scheduled time.'
            });
        }

        // Check if assistant is authorized (must be in the assistants array, or admin)
        if (!isAdmin) {
            const assistants = session.assistants || [];
            const isInAssistants = assistants.some(aid => aid.toString() === userId.toString());
            const isFirstAssistant = session.assistant_id && session.assistant_id.toString() === userId.toString();

            if (!isInAssistants && !isFirstAssistant) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only stop call sessions that you joined'
                });
            }
        }

        const now = getCurrentEgyptTime();

        // Find activity log for THIS user and THIS session that is open
        const activityLog = await ActivityLog.findOne({
            call_session_id: id,
            user_id: userId,
            end_time: null
        });

        let durationMinutes = 0;

        if (activityLog) {
            activityLog.end_time = now;
            // Calculate duration
            if (activityLog.start_time) {
                const durationMs = now.getTime() - activityLog.start_time.getTime();
                durationMinutes = Math.round(durationMs / (1000 * 60));
                activityLog.duration_minutes = durationMinutes;
            }

            // Calculate completed students count for this assistant in this session
            const completedCount = await CallSessionStudent.countDocuments({
                call_session_id: id,
                assigned_to: userId,
                filter_status: { $ne: '' } // Only count students with a status (completed)
            });
            activityLog.completed_count = completedCount;

            await activityLog.save();
        } else {
            // If no log found, maybe just return success? Or handled?
            // It's possible they didn't start one or it was already closed.
        }

        // Remove assistant from the active assistants list
        // filtering out the current user ID
        if (session.assistants && session.assistants.length > 0) {
            session.assistants = session.assistants.filter(aid => aid.toString() !== userId.toString());
            await session.save();
        }

        await logAuditAction(userId, 'STOP_CALL_SESSION', {
            session_id: id,
            activity_log_id: activityLog?._id || null
        });

        res.json({
            success: true,
            message: 'Your session ended successfully',
            data: {
                session_id: session._id,
                duration_minutes: durationMinutes
            }
        });
    } catch (error) {
        console.error('Stop call session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error stopping call session',
            error: error.message
        });
    }
};

// ============================================
// Call Session Student CRUD
// ============================================

/**
 * Assign Next Available Student
 * POST /api/activities/call-sessions/:id/assign
 */
/**
 * Assign Next Available Student
 * POST /api/activities/call-sessions/:id/assign
 */
const assignNextStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const LOCK_TIMEOUT_MINUTES = 15;

        const session = await CallSession.findById(id);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // 1. Check if user already has an assigned, unfinished student
        const currentAssignment = await CallSessionStudent.findOne({
            call_session_id: id,
            assigned_to: userId,
            filter_status: '' // Not completed
        });

        const sendResponse = async (student, msg = 'New student assigned') => {
            // Calculate stats
            const totalStudents = await CallSessionStudent.countDocuments({ call_session_id: id });
            const globalCompleted = await CallSessionStudent.countDocuments({
                call_session_id: id,
                filter_status: { $ne: '' }
            });
            const remainingStudents = totalStudents - globalCompleted;

            // Calculate user-specific completed count
            const userCompleted = await CallSessionStudent.countDocuments({
                call_session_id: id,
                filter_status: { $ne: '' },
                assigned_to: req.user.id
            });

            const formattedStudent = {
                id: student._id,
                name: student.name,
                studentPhone: student.student_phone,
                parentPhone: student.parent_phone,
                studentId: student.student_id || '',
                center: student.center || '',
                examMark: student.exam_mark !== undefined && student.exam_mark !== null ? student.exam_mark : '',
                attendanceStatus: student.attendance_status || '',
                homeworkStatus: student.homework_status || '',
                filterStatus: student.filter_status,
                comments: student.comments,
                howMany: student.how_many,
                totalTest: student.total_test
            };

            res.json({
                success: true,
                data: formattedStudent,
                stats: {
                    total: totalStudents,
                    completed: userCompleted,
                    remaining: remainingStudents
                },
                message: msg
            });
        };

        if (currentAssignment) {
            // Refresh lock
            currentAssignment.assigned_at = new Date();
            await currentAssignment.save();
            return await sendResponse(currentAssignment, 'Continued with currently assigned student');
        }

        // 2. Find next available student
        // Criteria: Not completed (filter_status empty) AND (Unassigned OR Lock expired)
        const lockThreshold = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60000);

        const baseQuery = {
            call_session_id: id,
            filter_status: '',
            $or: [
                { assigned_to: null },
                { assigned_at: { $lt: lockThreshold } }
            ]
        };

        // Helper to try assigning a student with specific criteria
        const tryAssign = async (criteria) => {
            return await CallSessionStudent.findOneAndUpdate(
                { ...baseQuery, ...criteria },
                {
                    $set: {
                        assigned_to: userId,
                        assigned_at: new Date()
                    }
                },
                { new: true, sort: { name: 1 } }
            );
        };

        let nextStudent = null;

        // PRIORITY 1: Absent
        nextStudent = await tryAssign({ attendance_status: { $regex: /absent/i } });
        if (nextStudent) return await sendResponse(nextStudent);

        // PRIORITY 2: Exam Mark 1-3 (Present)
        // Matches number 1-3 OR string "1", "2.5" etc.
        nextStudent = await tryAssign({
            $or: [
                { exam_mark: { $gte: 1, $lte: 3 } },
                { exam_mark: { $regex: /^[1-3](\.[0-9]*)?$/ } }
            ]
        });
        if (nextStudent) return await sendResponse(nextStudent);

        // PRIORITY 3: HW Not Done / No
        nextStudent = await tryAssign({ homework_status: { $regex: /not done|no/i } });
        if (nextStudent) return await sendResponse(nextStudent);

        // PRIORITY 4: HW Not Evaluated / Pending
        nextStudent = await tryAssign({ homework_status: { $regex: /not evaluated|pending/i } });
        if (nextStudent) return await sendResponse(nextStudent);

        // PRIORITY 5: HW Not Complete / Incomplete
        nextStudent = await tryAssign({ homework_status: { $regex: /not complete|incomplete/i } });
        if (nextStudent) return await sendResponse(nextStudent);

        // PRIORITY 6: HW Empty (No Data)
        // Explicitly check for empty string or null, BUT technically "unassigned" falls into Rest.
        // The user asked specifically for "Empty" as a category before "Everything OK".
        // Let's explicitly look for empty HW status students who might have skipped previous regexes.
        nextStudent = await tryAssign({
            $or: [
                { homework_status: '' },
                { homework_status: null },
                { homework_status: { $exists: false } }
            ]
        });
        if (nextStudent) return await sendResponse(nextStudent);


        // PRIORITY 7: Rest (Everything Else that matches baseQuery)
        // e.g. "Done", "Completed", or high marks
        nextStudent = await tryAssign({}); // No extra criteria
        if (nextStudent) return await sendResponse(nextStudent);


        // If we reach here, no students left
        return res.json({
            success: true,
            data: null,
            message: 'No more students available'
        });

    } catch (error) {
        console.error('Assign student error:', error);
        await logError(error, {
            action: 'assignNextStudent',
            sessionId: req.params.id
        }, req);

        res.status(500).json({ success: false, message: 'Error assigning student' });
    }
};

/**
 * Import Call Session Students
 * POST /api/activities/call-sessions/:id/students
 */
const importCallSessionStudents = async (req, res) => {
    try {
        const { id } = req.params;
        const { students } = req.body; // Expecting array of { name, studentPhone, parentPhone }

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No students provided'
            });
        }

        const session = await CallSession.findById(id);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Call session not found'
            });
        }

        // Update or Insert student records (Upsert) to prevent duplicates and allow updates
        // We check by Phone (if valid) OR Name
        const bulkOps = students.map(student => {
            let filter = { call_session_id: id };

            // Priority 1: Match by Phone
            if (student.studentPhone && student.studentPhone.length > 7) {
                filter.student_phone = student.studentPhone;
            } else {
                // Priority 2: Match by Name (case insensitive regex to be safe? No, let's strictly match name for bulkOp performance)
                // Note: Ideally we should use _id if provided, but import usually implies generic data
                filter.name = student.name;
            }

            // If the frontend provided an ID (existing student), use that as the most reliable filter!
            if (student.id || student._id) {
                filter = { _id: student.id || student._id };
            }

            return {
                updateOne: {
                    filter: filter,
                    update: {
                        $set: {
                            call_session_id: id, // Ensure session ID set
                            name: student.name,
                            student_phone: student.studentPhone || '',
                            parent_phone: student.parentPhone || '',
                            student_id: student.studentId || '',
                            center: student.center || '',
                            exam_mark: student.examMark !== undefined && student.examMark !== null ? student.examMark : null,
                            attendance_status: student.attendanceStatus || '',
                            homework_status: student.homeworkStatus || ''
                        }
                    },
                    upsert: true
                }
            };
        });

        if (bulkOps.length > 0) {
            await CallSessionStudent.bulkWrite(bulkOps);
        }

        await logAuditAction(req.user.id, 'IMPORT_CALL_SESSION_STUDENTS', {
            session_id: id,
            count: students.length
        });

        res.status(200).json({
            success: true,
            message: `${students.length} students processed (merged/imported) successfully`
        });
    } catch (error) {
        console.error('Import students error:', error);
        await logError(error, {
            action: 'importCallSessionStudents',
            sessionId: req.params.id,
            data: req.body
        }, req);

        res.status(500).json({
            success: false,
            message: 'Error importing students',
            error: error.message
        });
    }
};

/**
 * Get Call Session Students
 * GET /api/activities/call-sessions/:id/students
 */
const getCallSessionStudents = async (req, res) => {
    try {
        const { id } = req.params;
        const { assigned_to, has_status, limit, offset } = req.query;

        let query = { call_session_id: id };

        // Filter by assigned user
        if (assigned_to === 'me') {
            query.assigned_to = req.user.id;
        } else if (assigned_to) {
            query.assigned_to = assigned_to;
        }

        // Filter by status (completed/processed)
        if (has_status === 'true') {
            query.filter_status = { $ne: '' };
        }

        // Build Query
        let dbQuery = CallSessionStudent.find(query)
            .populate('last_called_by', 'name')
            .populate('assigned_to', 'name')
            // Sort by updated time desc for history (most recent first)
            // If just listing all, maybe name asc? Let's check context.
            // If history mode (has_status=true), we usually want most recent first.
            .sort(has_status === 'true' ? { updatedAt: -1 } : { name: 1 });

        if (limit) dbQuery = dbQuery.limit(parseInt(limit));
        if (offset) dbQuery = dbQuery.skip(parseInt(offset));

        const students = await dbQuery.lean();

        const formattedStudents = students.map(s => ({
            id: s._id,
            name: s.name,
            studentPhone: s.student_phone,
            parentPhone: s.parent_phone,
            studentId: s.student_id || '',
            center: s.center || '',
            examMark: s.exam_mark !== undefined && s.exam_mark !== null ? s.exam_mark : '',
            attendanceStatus: s.attendance_status || '',
            homeworkStatus: s.homework_status || '',
            filterStatus: s.filter_status,
            comments: s.comments,
            howMany: s.how_many,
            totalTest: s.total_test,
            lastCalledBy: s.last_called_by?.name || null,
            assignedTo: s.assigned_to?.name || null,
            assignedAt: s.assigned_at
        }));

        res.json({
            success: true,
            data: formattedStudents
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching students'
        });
    }
};

/**
 * Update Call Session Student
 * PUT /api/activities/call-sessions/students/:studentId
 */
const updateCallSessionStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { filterStatus, comment, howMany, totalTest } = req.body;
        const userId = req.user.id; // Get current user ID

        const student = await CallSessionStudent.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Track who updated this student last
        student.last_called_by = userId;

        if (filterStatus !== undefined) student.filter_status = filterStatus;
        if (howMany !== undefined) student.how_many = howMany;
        if (totalTest !== undefined) student.total_test = totalTest;

        if (comment) {
            student.comments.push({
                text: comment,
                timestamp: new Date(),
                author: req.user.name || 'Assistant' // Optional: store name directly for easier display
            });
        }

        await student.save();

        res.json({
            success: true,
            message: 'Student updated successfully'
        });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating student'
        });
    }
};

// ============================================
// Activity Log CRUD
// ============================================

/**
 * Generate WhatsApp records for a specific date
 * Internal function for lazy-create
 */
const generateWhatsAppRecordsForDate = async (targetDate) => {
    const dateMoment = moment.tz(targetDate, 'Africa/Cairo').startOf('day');
    // moment.day(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
    // Convert to our format: 1 = Monday, 7 = Sunday
    const jsDay = dateMoment.day();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    // Find all active schedules for this day of week
    const schedules = await WhatsAppSchedule.find({
        day_of_week: dayOfWeek,
        is_active: true
    }).lean();

    const generatedRecords = [];

    for (const schedule of schedules) {
        // Check if record already exists for this date
        const [startHour, startMin] = schedule.start_time.split(':').map(Number);
        const [endHour, endMin] = schedule.end_time.split(':').map(Number);

        const startDateTime = dateMoment.clone()
            .hours(startHour)
            .minutes(startMin)
            .seconds(0)
            .milliseconds(0);

        const endDateTime = dateMoment.clone()
            .hours(endHour)
            .minutes(endMin)
            .seconds(0)
            .milliseconds(0);

        const existingLog = await ActivityLog.findOne({
            user_id: schedule.user_id,
            type: 'whatsapp',
            whatsapp_schedule_id: schedule._id,
            start_time: {
                $gte: dateMoment.toDate(), // Search from start of day to avoid duplicates if time changes
                $lt: dateMoment.clone().add(1, 'day').toDate()
            },
            is_deleted: false
        });

        if (!existingLog) {
            const durationMs = endDateTime.toDate().getTime() - startDateTime.toDate().getTime();
            const durationMinutes = Math.round(durationMs / (1000 * 60));

            const newLog = new ActivityLog({
                user_id: schedule.user_id,
                type: 'whatsapp',
                start_time: startDateTime.toDate(),
                end_time: endDateTime.toDate(),
                duration_minutes: durationMinutes,
                whatsapp_schedule_id: schedule._id
            });

            await newLog.save();
            generatedRecords.push(newLog);

            // Also create attendance record for WhatsApp schedule
            try {
                // Get user's assigned centers
                const user = await User.findById(schedule.user_id).select('assignedCenters').lean();
                const firstCenter = user?.assignedCenters && user.assignedCenters.length > 0
                    ? user.assignedCenters[0]
                    : null;

                // Check if attendance already exists for this WhatsApp schedule on this date
                // Use a unique identifier in notes to prevent duplicates
                const existingAttendance = await Attendance.findOne({
                    assistant_id: schedule.user_id,
                    $or: [
                        { session_id: null, call_session_id: null },
                        { session_id: { $exists: false }, call_session_id: { $exists: false } }
                    ],
                    time_recorded: {
                        $gte: dateMoment.toDate(), // Search from start of day
                        $lt: dateMoment.clone().add(1, 'day').toDate()
                    },
                    notes: { $regex: `WhatsApp schedule.*${schedule._id}`, $options: 'i' }
                });

                if (!existingAttendance) {
                    const attendance = new Attendance({
                        assistant_id: schedule.user_id,
                        session_id: null,
                        call_session_id: null,
                        session_subject: `WhatsApp Schedule - ${schedule.start_time} to ${schedule.end_time}`,
                        center_id: firstCenter, // Use first assigned center or null
                        latitude: null, // No GPS required for WhatsApp (remote work)
                        longitude: null,
                        time_recorded: startDateTime.toDate(), // Use schedule start time
                        delay_minutes: 0, // Auto-generated, no delay
                        notes: `WhatsApp schedule (ID: ${schedule._id}) - Auto-generated`
                    });

                    await attendance.save();
                }
            } catch (attendanceError) {
                // Log error but don't fail the WhatsApp record generation
                console.error('Error creating attendance record for WhatsApp schedule:', attendanceError);
                await logError(schedule.user_id, 'CREATE_WHATSAPP_ATTENDANCE', attendanceError);
            }
        }
    }

    return generatedRecords;
};

/**
 * Get Activity Logs
 * GET /api/activities/logs
 */
const getActivityLogs = async (req, res) => {
    try {
        const { user_id, type, start_date, end_date, page = 1, limit = 50 } = req.query;

        // Lazy-create: Generate missing WhatsApp records for the date range
        if (start_date && end_date) {
            const startMoment = moment.tz(start_date, 'Africa/Cairo').startOf('day');
            const endMoment = moment.tz(end_date, 'Africa/Cairo').endOf('day');
            const currentDate = startMoment.clone();

            while (currentDate.isSameOrBefore(endMoment)) {
                await generateWhatsAppRecordsForDate(currentDate.toDate());
                currentDate.add(1, 'day');
            }
        }

        const query = { is_deleted: false };
        if (user_id) query.user_id = user_id;
        if (type) query.type = type;
        if (start_date || end_date) {
            query.start_time = {};
            if (start_date) {
                query.start_time.$gte = moment.tz(start_date, 'Africa/Cairo').startOf('day').toDate();
            }
            if (end_date) {
                query.start_time.$lte = moment.tz(end_date, 'Africa/Cairo').endOf('day').toDate();
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .populate('user_id', 'name email')
                .populate('call_session_id', 'name')
                .populate('whatsapp_schedule_id')
                .populate('deleted_by', 'name')
                .sort({ start_time: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ActivityLog.countDocuments(query)
        ]);

        const formattedLogs = logs.map(log => {
            const startMoment = moment.tz(log.start_time, 'Africa/Cairo');
            const endMoment = log.end_time ? moment.tz(log.end_time, 'Africa/Cairo') : null;

            return {
                id: log._id,
                user_id: log.user_id?._id,
                user_name: log.user_id?.name || 'Unknown',
                type: log.type,
                start_time: log.start_time,
                end_time: log.end_time,
                duration_minutes: log.duration_minutes || 0,
                call_session_id: log.call_session_id?._id || null,
                call_session_name: log.call_session_id?.name || null,
                whatsapp_schedule_id: log.whatsapp_schedule_id?._id || null,
                notes: log.notes || '',
                is_deleted: log.is_deleted || false,
                deleted_by: log.deleted_by?.name || null,
                deleted_at: log.deleted_at,
                deletion_reason: log.deletion_reason,
                created_at: log.createdAt,
                updated_at: log.updatedAt
            };
        });

        res.json({
            success: true,
            data: formattedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs'
        });
    }
};

/**
 * Get Activity Log by ID
 * GET /api/activities/logs/:id
 */
const getActivityLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const log = await ActivityLog.findById(id)
            .populate('user_id', 'name email')
            .populate('call_session_id', 'name')
            .populate('whatsapp_schedule_id')
            .populate('deleted_by', 'name')
            .lean();

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        const formattedLog = {
            id: log._id,
            user_id: log.user_id?._id,
            user_name: log.user_id?.name || 'Unknown',
            type: log.type,
            start_time: log.start_time,
            end_time: log.end_time,
            duration_minutes: log.duration_minutes || 0,
            call_session_id: log.call_session_id?._id || null,
            call_session_name: log.call_session_id?.name || null,
            whatsapp_schedule_id: log.whatsapp_schedule_id?._id || null,
            notes: log.notes || '',
            is_deleted: log.is_deleted || false,
            deleted_by: log.deleted_by?.name || null,
            deleted_at: log.deleted_at,
            deletion_reason: log.deletion_reason,
            created_at: log.createdAt,
            updated_at: log.updatedAt
        };

        res.json({
            success: true,
            data: formattedLog
        });
    } catch (error) {
        console.error('Get activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity log'
        });
    }
};

/**
 * Create Activity Log (Manual)
 * POST /api/activities/logs
 */
const createActivityLog = async (req, res) => {
    try {
        const { user_id, type, start_time, end_time, notes, call_session_id, whatsapp_schedule_id } = req.body;

        if (!user_id || !type || !start_time) {
            return res.status(400).json({
                success: false,
                message: 'User, type, and start time are required'
            });
        }

        if (!['whatsapp', 'call'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "whatsapp" or "call"'
            });
        }

        const newLog = new ActivityLog({
            user_id,
            type,
            start_time: parseAsEgyptTime(start_time),
            end_time: end_time ? parseAsEgyptTime(end_time) : null,
            notes: notes || '',
            call_session_id: call_session_id || null,
            whatsapp_schedule_id: whatsapp_schedule_id || null
        });

        // Calculate duration if end_time is provided
        if (newLog.end_time) {
            const diffMs = newLog.end_time - newLog.start_time;
            newLog.duration_minutes = Math.round(diffMs / (1000 * 60));
        }

        await newLog.save();

        // Create attendance record for the activity log
        try {
            // Get assistant's assigned centers
            const assistant = await User.findById(user_id).select('assignedCenters').lean();
            const firstCenter = assistant?.assignedCenters && assistant.assignedCenters.length > 0
                ? assistant.assignedCenters[0]
                : null;

            let sessionSubject = null;
            let callSessionId = null;
            let delayMinutes = 0;

            if (type === 'call' && call_session_id) {
                // For call sessions, get the call session name
                const callSession = await CallSession.findById(call_session_id).lean();
                if (callSession) {
                    sessionSubject = callSession.name;
                    callSessionId = call_session_id;

                    // Calculate delay based on call session start time
                    const callDate = moment.tz(callSession.date, 'Africa/Cairo');
                    const [hours, minutes] = callSession.start_time.split(':');
                    callDate.hours(parseInt(hours));
                    callDate.minutes(parseInt(minutes));
                    callDate.seconds(0);
                    callDate.milliseconds(0);
                    const sessionTime = callDate.toDate();

                    const calculatedDelay = getEgyptTimeDifferenceMinutes(newLog.start_time, sessionTime);
                    delayMinutes = calculatedDelay <= 0 ? 0 : Math.round(calculatedDelay);
                }
            } else if (type === 'whatsapp') {
                // For WhatsApp, create a descriptive subject
                const startTimeStr = moment.tz(newLog.start_time, 'Africa/Cairo').format('HH:mm');
                const endTimeStr = newLog.end_time
                    ? moment.tz(newLog.end_time, 'Africa/Cairo').format('HH:mm')
                    : 'Ongoing';
                sessionSubject = `WhatsApp Activity - ${startTimeStr} to ${endTimeStr}`;
                delayMinutes = 0; // Manual records, no delay calculation
            } else if (type === 'call') {
                // For manual call records without call_session_id
                const startTimeStr = moment.tz(newLog.start_time, 'Africa/Cairo').format('HH:mm');
                const endTimeStr = newLog.end_time
                    ? moment.tz(newLog.end_time, 'Africa/Cairo').format('HH:mm')
                    : 'Ongoing';
                sessionSubject = `Call Activity - ${startTimeStr} to ${endTimeStr}`;
                delayMinutes = 0; // Manual records, no delay calculation
            }

            // Check if attendance already exists
            const existingAttendance = await Attendance.findOne({
                assistant_id: user_id,
                ...(callSessionId ? { call_session_id: callSessionId } : {
                    session_id: null,
                    call_session_id: null,
                    session_subject: sessionSubject,
                    time_recorded: {
                        $gte: moment.tz(newLog.start_time, 'Africa/Cairo').startOf('day').toDate(),
                        $lt: moment.tz(newLog.start_time, 'Africa/Cairo').add(1, 'day').startOf('day').toDate()
                    }
                })
            });

            if (!existingAttendance && sessionSubject) {
                const attendance = new Attendance({
                    assistant_id: user_id,
                    session_id: null,
                    call_session_id: callSessionId || null,
                    session_subject: sessionSubject,
                    center_id: firstCenter,
                    latitude: null, // No GPS required for remote activities
                    longitude: null,
                    time_recorded: newLog.start_time,
                    delay_minutes: delayMinutes,
                    notes: notes || `Manual ${type} activity record`
                });

                await attendance.save();
            }
        } catch (attendanceError) {
            // Log error but don't fail the activity log creation
            console.error('Error creating attendance record for activity log:', attendanceError);
            await logError(req.user.id, 'CREATE_ACTIVITY_LOG_ATTENDANCE', attendanceError);
        }

        await logAuditAction(req.user.id, 'CREATE_ACTIVITY_LOG', {
            log_id: newLog._id.toString(),
            user_id,
            type,
            start_time: newLog.start_time
        });

        res.status(201).json({
            success: true,
            message: 'Activity log created successfully',
            data: { id: newLog._id }
        });
    } catch (error) {
        console.error('Create activity log error:', error);
        await logError(req.user.id, 'CREATE_ACTIVITY_LOG', error);
        res.status(500).json({
            success: false,
            message: 'Error creating activity log',
            error: error.message
        });
    }
};

/**
 * Update Activity Log
 * PUT /api/activities/logs/:id
 */
const updateActivityLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, type, start_time, end_time, notes, completed_count } = req.body;

        const updateData = {};
        if (user_id) updateData.user_id = user_id;
        if (type) updateData.type = type;
        if (start_time) updateData.start_time = parseAsEgyptTime(start_time);
        if (end_time) updateData.end_time = parseAsEgyptTime(end_time);
        if (notes !== undefined) updateData.notes = notes;
        if (completed_count !== undefined) updateData.completed_count = completed_count;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        // Calculate duration if start_time or end_time is being updated
        if (updateData.start_time || updateData.end_time) {
            const existingLog = await ActivityLog.findById(id);
            if (existingLog) {
                const startTime = updateData.start_time || existingLog.start_time;
                const endTime = updateData.end_time || existingLog.end_time;

                if (startTime && endTime) {
                    const diffMs = endTime - startTime;
                    updateData.duration_minutes = Math.round(diffMs / (1000 * 60));
                } else {
                    updateData.duration_minutes = 0;
                }
            }
        }

        const updatedLog = await ActivityLog.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedLog) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        await logAuditAction(req.user.id, 'UPDATE_ACTIVITY_LOG', {
            log_id: id,
            ...updateData
        });

        res.json({
            success: true,
            message: 'Activity log updated successfully'
        });
    } catch (error) {
        console.error('Update activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating activity log',
            error: error.message
        });
    }
};

/**
 * Delete Activity Log (Soft Delete)
 * DELETE /api/activities/logs/:id
 */
const deleteActivityLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const log = await ActivityLog.findById(id);

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        log.is_deleted = true;
        log.deleted_by = req.user.id;
        log.deleted_at = getCurrentEgyptTime();
        log.deletion_reason = reason || 'No reason provided';

        await log.save();

        // Also soft-delete related attendance records
        // For call sessions: delete attendance records linked to this call_session_id and user
        if (log.call_session_id && log.type === 'call') {
            await Attendance.updateMany(
                {
                    call_session_id: log.call_session_id,
                    assistant_id: log.user_id,
                    is_deleted: false
                },
                {
                    $set: {
                        is_deleted: true,
                        deleted_by: req.user.id,
                        deleted_at: getCurrentEgyptTime(),
                        deletion_reason: `Activity log deleted: ${log.deletion_reason}`
                    }
                }
            );
        }

        // For WhatsApp: delete attendance records linked to this user and matching time/subject
        if (log.type === 'whatsapp' && log.whatsapp_schedule_id) {
            // Find attendance records for this user on the same date with WhatsApp subject
            const logDate = moment.tz(log.start_time, 'Africa/Cairo').startOf('day');
            const nextDay = logDate.clone().add(1, 'day');

            await Attendance.updateMany(
                {
                    assistant_id: log.user_id,
                    session_id: null,
                    call_session_id: null,
                    time_recorded: {
                        $gte: logDate.toDate(),
                        $lt: nextDay.toDate()
                    },
                    session_subject: { $regex: 'WhatsApp', $options: 'i' },
                    is_deleted: false
                },
                {
                    $set: {
                        is_deleted: true,
                        deleted_by: req.user.id,
                        deleted_at: getCurrentEgyptTime(),
                        deletion_reason: `Activity log deleted: ${log.deletion_reason}`
                    }
                }
            );
        }

        await logAuditAction(req.user.id, 'DELETE_ACTIVITY_LOG', {
            log_id: id,
            reason: log.deletion_reason
        });

        res.json({
            success: true,
            message: 'Activity log deleted successfully'
        });
    } catch (error) {
        console.error('Delete activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting activity log'
        });
    }
};

module.exports = {
    // WhatsApp Schedule
    createWhatsAppSchedule,
    getWhatsAppSchedules,
    updateWhatsAppSchedule,
    deleteWhatsAppSchedule,
    // Call Session
    createCallSession,
    getCallSessions,
    getCallSessionById,
    updateCallSession,
    deleteCallSession,
    startCallSession,
    stopCallSession,
    // Call Session Students
    importCallSessionStudents,
    getCallSessionStudents,
    updateCallSessionStudent,
    assignNextStudent,
    // Activity Log
    createActivityLog,
    getActivityLogs,
    getActivityLogById,
    updateActivityLog,
    deleteActivityLog,
    // Internal functions
    generateWhatsAppRecordsForDate
};


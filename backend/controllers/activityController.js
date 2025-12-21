const mongoose = require('mongoose');
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
        const { name, date, start_time, session_type } = req.body;

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
            status: 'pending',
            session_type: session_type || 'normal'
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
            .sort({ date: -1, start_time: 1 })
            .lean();
        const assistantIds = new Set();
        const sessionIds = sessions.map(s => s._id);

        // Also get assistants who worked on sessions (from student call logs)
        const workingAssistantsMap = {};

        if (sessionIds.length > 0) {
            // Get all students for all sessions to find working assistants
            const allStudents = await CallSessionStudent.find({
                call_session_id: { $in: sessionIds }
            }, 'call_session_id last_called_by').lean();

            // Group working assistants by session
            allStudents.forEach(student => {
                if (student.last_called_by) {
                    const sessionIdStr = student.call_session_id.toString();
                    if (!workingAssistantsMap[sessionIdStr]) {
                        workingAssistantsMap[sessionIdStr] = new Set();
                    }
                    workingAssistantsMap[sessionIdStr].add(student.last_called_by.toString());
                }
            });

            // Collect all unique assistant IDs (both joined and working)
            sessions.forEach(session => {
                // Add joined assistants
                if (session.assistants && session.assistants.length > 0) {
                    session.assistants.forEach(assistantId => {
                        assistantIds.add(assistantId.toString());
                    });
                }

                // Add working assistants
                const sessionIdStr = session._id.toString();
                if (workingAssistantsMap[sessionIdStr]) {
                    workingAssistantsMap[sessionIdStr].forEach(assistantId => {
                        assistantIds.add(assistantId);
                    });
                }
            });
        }

        // Fetch all assistant names in one query
        const assistantMap = {};
        if (assistantIds.size > 0) {
            const assistants = await User.find({
                _id: { $in: Array.from(assistantIds) }
            }, 'name').lean();

            assistants.forEach(assistant => {
                assistantMap[assistant._id.toString()] = assistant.name;
            });
        }

        // Get all activity logs for current user for these sessions
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
            const sessionIdStr = session._id.toString();

            // Get joined assistant names
            const joinedAssistantNames = [];
            if (session.assistants && session.assistants.length > 0) {
                session.assistants.forEach(assistantId => {
                    const name = assistantMap[assistantId.toString()];
                    if (name) joinedAssistantNames.push(name);
                });
            }

            // Get working assistant names (from student call logs)
            const workingAssistantNames = [];
            if (workingAssistantsMap[sessionIdStr]) {
                workingAssistantsMap[sessionIdStr].forEach(assistantId => {
                    const name = assistantMap[assistantId];
                    if (name && !workingAssistantNames.includes(name)) {
                        workingAssistantNames.push(name);
                    }
                });
            }

            // Check if current user has an activity log for this session
            const userLog = userActivityLogs.find(
                log => log.call_session_id.toString() === session._id.toString()
            );
            // Has completed participation if log exists AND has end_time
            const hasCompletedParticipation = userLog && userLog.end_time != null;
            // Is currently active in session if log exists but no end_time
            const isCurrentlyActive = userLog && userLog.end_time == null;

            // Format assistant display - prioritize working assistants
            let assistantDisplay = 'Any';

            if (workingAssistantNames.length > 0) {
                // Show working assistants (those who actually called students)
                assistantDisplay = `Working: ${workingAssistantNames.join(', ')}`;
            } else if (joinedAssistantNames.length > 0) {
                // Fallback to joined assistants if no working data
                assistantDisplay = `Joined: ${joinedAssistantNames.join(', ')}`;
            } else {
                // Check for assigned assistant
                const assignedAssistant = session.assistant_id?.name;
                if (assignedAssistant) {
                    assistantDisplay = `Assigned: ${assignedAssistant}`;
                }
            }

            return {
                id: session._id,
                name: session.name,
                date: dateMoment.format('YYYY-MM-DD'),
                start_time: session.start_time,
                status: session.status,
                session_type: session.session_type || 'normal',
                assistant_id: session.assistant_id?._id || null,
                assistant_name: session.assistant_id?.name || null,
                assistants: session.assistants || [],
                assistant_names: joinedAssistantNames,
                assistant_display: assistantDisplay,
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
            session_type: session.session_type || 'normal',
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
        const { name, date, start_time, status, assistant_id, end_time, session_type } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (date) updateData.date = parseAsEgyptTime(date);
        if (start_time) updateData.start_time = start_time;
        if (status) updateData.status = status;
        if (assistant_id !== undefined) updateData.assistant_id = assistant_id;
        if (session_type) updateData.session_type = session_type;
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

        // If admin manually sets status to 'completed', force-end all active sessions
        if (updateData.status === 'completed' && updatedSession.status === 'completed') {
            const now = getCurrentEgyptTime();

            // Set end_time if not already set
            if (!updatedSession.end_time) {
                updatedSession.end_time = now;
                await updatedSession.save();
            }

            // Update all related activity logs with end_time and calculate duration
            const activityLogs = await ActivityLog.find({
                call_session_id: id,
                end_time: null
            });

            console.log(`Force-ending ${activityLogs.length} active sessions for call session ${id}`);

            for (const log of activityLogs) {
                log.end_time = updatedSession.end_time;
                // Calculate duration
                if (log.start_time) {
                    const durationMs = updatedSession.end_time.getTime() - log.start_time.getTime();
                    const durationMinutes = Math.round(durationMs / (1000 * 60));

                    // If start time is in the future (due to test data or timezone issues),
                    // set duration to 0 and log a warning
                    if (durationMinutes < 0) {
                        console.warn(`Activity log ${log._id} has future start_time, setting duration to 0`);
                        log.duration_minutes = 0;
                    } else {
                        log.duration_minutes = durationMinutes;
                    }
                }

                // Calculate completed students count for this assistant in this session
                const completedCount = await CallSessionStudent.countDocuments({
                    call_session_id: id,
                    assigned_to: log.user_id,
                    filter_status: { $ne: '' } // Only count students with a status (completed)
                });
                log.completed_count = completedCount;

                await log.save();

                await logAuditAction(req.user.id, 'FORCE_END_CALL_SESSION', {
                    session_id: id,
                    assistant_id: log.user_id.toString(),
                    reason: 'Admin ended call session'
                });
            }

            // Clear all assistants from the session
            updatedSession.assistants = [];
            await updatedSession.save();
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

        // Check if assistant is active in any other call sessions
        const activeSessions = await CallSession.find({
            assistants: assistantId,
            status: 'active',
            _id: { $ne: id } // Exclude the current session we're trying to join
        });

        // If assistant is active in other sessions, automatically end them
        if (activeSessions.length > 0) {
            console.log(`Auto-ending ${activeSessions.length} active sessions for assistant ${assistantId}`);
            for (const activeSession of activeSessions) {
                // Find and end the activity log for this assistant in the active session
                const activityLog = await ActivityLog.findOne({
                    call_session_id: activeSession._id,
                    user_id: assistantId,
                    end_time: null
                });

                if (activityLog) {
                    const now = getCurrentEgyptTime();
                    activityLog.end_time = now;
                    // Calculate duration (ensure it's never negative)
                    if (activityLog.start_time) {
                        const startTime = new Date(activityLog.start_time);
                        const durationMs = now.getTime() - startTime.getTime();
                        const durationMinutes = Math.round(durationMs / (1000 * 60));

                        // If start time is in the future (due to test data or timezone issues),
                        // set duration to 0 and log a warning
                        if (durationMinutes < 0) {
                            console.warn(`Activity log ${activityLog._id} has future start_time, setting duration to 0`);
                            activityLog.duration_minutes = 0;
                        } else {
                            activityLog.duration_minutes = durationMinutes;
                        }
                    }

                    // Calculate completed students count for this assistant in this session
                    const completedCount = await CallSessionStudent.countDocuments({
                        call_session_id: activeSession._id,
                        assigned_to: assistantId,
                        filter_status: { $ne: '' } // Only count students with a status (completed)
                    });
                    activityLog.completed_count = completedCount;

                    try {
                        await activityLog.save();
                    } catch (saveError) {
                        console.error('Error saving auto-ended activity log:', saveError);
                        // Continue anyway - don't fail the session start
                    }
                }

                // Remove assistant from the active assistants list
                if (activeSession.assistants && activeSession.assistants.length > 0) {
                    activeSession.assistants = activeSession.assistants.filter(aid => aid.toString() !== assistantIdStr);
                    await activeSession.save();
                }

                await logAuditAction(assistantId, 'AUTO_END_CALL_SESSION', {
                    session_id: activeSession._id.toString(),
                    reason: 'Assistant joined another session',
                    new_session_id: id
                });
            }
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
        const LOCK_TIMEOUT_MINUTES = 60; // Increased from 15 to 60 minutes to prevent reassignment

        const session = await CallSession.findById(id);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // 1. Check if user already has an assigned, unfinished student
        let currentAssignment = await CallSessionStudent.findOne({
            call_session_id: id,
            assigned_to: userId,
            filter_status: '' // Not completed
        });

        // If user has an assignment, verify the student still exists
        // (in case it was deleted by admin while assistant was working on it)
        if (currentAssignment) {
            const studentExists = await CallSessionStudent.findById(currentAssignment._id);
            if (!studentExists) {
                console.log(`[Student Assignment] Assigned student ${currentAssignment._id} was deleted, clearing assignment for user ${userId}`);
                // Clear the assignment since student no longer exists
                currentAssignment = null;
            }
        }

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
                adminComment: student.admin_comment || '',
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
            console.log(`[Student Assignment] User ${userId} continuing with assigned student ${currentAssignment._id} (${currentAssignment.name})`);
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
                { new: true, sort: { createdAt: 1 } } // Sort by creation time for consistent assignment order
            );
        };

        let nextStudent = null;

        // PRIORITY 1: Absent students
        console.log(`[Student Assignment] User ${userId} looking for absent students in session ${id}`);
        nextStudent = await tryAssign({ attendance_status: { $regex: /absent/i } });
        if (nextStudent) {
            console.log(`[Student Assignment] Assigned absent student ${nextStudent._id} (${nextStudent.name}) to user ${userId}`);
            return await sendResponse(nextStudent);
        }

        // PRIORITY 2: Exam marks 1-3
        console.log(`[Student Assignment] User ${userId} looking for students with exam marks 1-3`);
        nextStudent = await tryAssign({
            $or: [
                { exam_mark: { $gte: 1, $lte: 3 } },
                { exam_mark: { $regex: /^[1-3](\.[0-9]*)?$/ } }
            ]
        });
        if (nextStudent) {
            console.log(`[Student Assignment] Assigned low exam mark student ${nextStudent._id} (${nextStudent.name}) to user ${userId}`);
            return await sendResponse(nextStudent);
        }

        // PRIORITY 3: Not Done Homework (matches monitor priority 2)
        // Monitor checks: (hw.includes('not done') || hw === 'no')
        // Use atomic findOneAndUpdate to prevent race conditions
        console.log(`[Student Assignment] User ${userId} looking for students who haven't done homework`);
        // Try to find and assign atomically - this prevents two assistants from getting the same student
        // We use a broad regex and then verify in JavaScript to ensure exact match
        nextStudent = await CallSessionStudent.findOneAndUpdate(
            {
                ...baseQuery,
                homework_status: { 
                    $exists: true, 
                    $ne: null, 
                    $ne: '',
                    $regex: /(not done|^no$)/i
                }
            },
            {
                $set: {
                    assigned_to: userId,
                    assigned_at: new Date()
                }
            },
            { new: true, sort: { createdAt: 1 } }
        );
        if (nextStudent) {
            // Verify the homework status matches exactly (regex might match edge cases)
            const hw = (nextStudent.homework_status || '').toLowerCase().trim();
            if ((hw.includes('not done') || hw === 'no') && !hw.includes('not complete')) {
                console.log(`[Student Assignment] Assigned not done homework student ${nextStudent._id} (${nextStudent.name}) to user ${userId}`);
                return await sendResponse(nextStudent);
            }
            // If it doesn't match, unassign and continue (shouldn't happen, but safety check)
            nextStudent.assigned_to = null;
            nextStudent.assigned_at = null;
            await nextStudent.save();
            nextStudent = null;
        }

        // PRIORITY 4: Not Evaluated (matches monitor priority 3)
        // Monitor checks: hw.includes('not evaluated') || hw.includes('pending')
        console.log(`[Student Assignment] User ${userId} looking for students who haven't been evaluated`);
        nextStudent = await CallSessionStudent.findOneAndUpdate(
            {
                ...baseQuery,
                homework_status: {
                    $exists: true,
                    $ne: null,
                    $ne: '',
                    $regex: /(not evaluated|pending)/i
                }
            },
            {
                $set: {
                    assigned_to: userId,
                    assigned_at: new Date()
                }
            },
            { new: true, sort: { createdAt: 1 } }
        );
        if (nextStudent) {
            const hw = (nextStudent.homework_status || '').toLowerCase().trim();
            if (hw.includes('not evaluated') || hw.includes('pending')) {
                console.log(`[Student Assignment] Assigned not evaluated student ${nextStudent._id} (${nextStudent.name}) to user ${userId}`);
                return await sendResponse(nextStudent);
            }
            // If it doesn't match, unassign and continue
            nextStudent.assigned_to = null;
            nextStudent.assigned_at = null;
            await nextStudent.save();
            nextStudent = null;
        }

        // PRIORITY 5: Not Complete / Incomplete (matches monitor priority 4)
        // Monitor checks: hw.includes('not complete') || hw.includes('incomplete')
        console.log(`[Student Assignment] User ${userId} looking for students with incomplete homework`);
        nextStudent = await CallSessionStudent.findOneAndUpdate(
            {
                ...baseQuery,
                homework_status: {
                    $exists: true,
                    $ne: null,
                    $ne: '',
                    $regex: /(not complete|incomplete)/i
                }
            },
            {
                $set: {
                    assigned_to: userId,
                    assigned_at: new Date()
                }
            },
            { new: true, sort: { createdAt: 1 } }
        );
        if (nextStudent) {
            const hw = (nextStudent.homework_status || '').toLowerCase().trim();
            if (hw.includes('not complete') || hw.includes('incomplete')) {
                console.log(`[Student Assignment] Assigned incomplete homework student ${nextStudent._id} (${nextStudent.name}) to user ${userId}`);
                return await sendResponse(nextStudent);
            }
            // If it doesn't match, unassign and continue
            nextStudent.assigned_to = null;
            nextStudent.assigned_at = null;
            await nextStudent.save();
            nextStudent = null;
        }

        // PRIORITY 6: Empty Homework Status
        console.log(`[Student Assignment] User ${userId} looking for students with empty homework status`);
        nextStudent = await tryAssign({
            $or: [
                { homework_status: '' },
                { homework_status: null },
                { homework_status: { $exists: false } }
            ]
        });
        if (nextStudent) {
            console.log(`[Student Assignment] Assigned empty homework student ${nextStudent._id} (${nextStudent.name}) to user ${userId}`);
            return await sendResponse(nextStudent);
        }

        // PRIORITY 7: Rest of students
        console.log(`[Student Assignment] User ${userId} looking for remaining students`);
        nextStudent = await tryAssign({}); // No additional criteria - just baseQuery
        if (nextStudent) {
            console.log(`[Student Assignment] Assigned remaining student ${nextStudent._id} (${nextStudent.name}) to user ${userId}`);
            return await sendResponse(nextStudent);
        }


        // If we reach here, no students left
        console.log(`[Student Assignment] No more students available for user ${userId} in session ${id}`);
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

        // Create temp backup of current students before import
        const currentStudents = await CallSessionStudent.find({ call_session_id: id });
        const backupId = await createTempBackup(id, currentStudents);
        if (!backupId) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create backup for undo operation'
            });
        }

        // Capture timestamp before operations to track all modified students
        const importTimestamp = new Date();

        // Update or Insert student records (Upsert) to prevent duplicates and allow updates
        // We check by Phone (if valid) OR Name
        const bulkOps = students.map(student => {
            // Students are isolated per session - always scope to this session
            let filter = { call_session_id: id };

            // If the frontend provided a MongoDB _id (existing student record), use that
            // Note: student.id or student._id refers to the MongoDB document ID, not the CSV student ID
            if (student.id || student._id) {
                filter = { 
                    _id: student.id || student._id,
                    call_session_id: id  // Still ensure it's in the correct session
                };
            }
            // ONLY match by Student ID (from CSV) - no phone/name matching
            // This ensures each session's students are completely independent
            else if (student.studentId && String(student.studentId).trim()) {
                filter.student_id = String(student.studentId).trim();
                // call_session_id already in filter - ensures session isolation
            }
            // No Student ID provided - try to match by name + phone combination to avoid duplicates
            // If no match found, it will insert as new
            else {
                // Match by name and student phone (if provided) to prevent exact duplicates
                // This helps when manually adding students without studentId
                const nameMatch = student.name && String(student.name).trim();
                const phoneMatch = student.studentPhone && String(student.studentPhone).trim();
                
                if (nameMatch && phoneMatch) {
                    // Try to match by name + phone to avoid duplicates
                    filter.name = nameMatch;
                    filter.student_phone = phoneMatch;
                } else if (nameMatch) {
                    // If only name is provided, match by name only
                    filter.name = nameMatch;
                } else {
                    // If neither name nor phone, force new insert with unique filter
                    filter = {
                        call_session_id: id,
                        student_id: '', // Empty student_id
                        name: '', // Empty name - won't match existing
                        _forceNewInsert: true // Field that doesn't exist - forces new insert
                    };
                }
            }

            // Build update object - always set these fields
            const updateOperation = {
                $set: {
                    call_session_id: id, // Always ensure correct session
                    name: student.name,
                    student_phone: student.studentPhone || '',
                    parent_phone: student.parentPhone || '',
                    student_id: student.studentId || '', // Set Student ID (empty if not provided)
                    center: student.center || '',
                    exam_mark: student.examMark !== undefined && student.examMark !== null && student.examMark !== '' ? student.examMark : null,
                    attendance_status: student.attendanceStatus || '',
                    homework_status: student.homeworkStatus || '',
                    admin_comment: student.adminComment !== undefined && student.adminComment !== null ? String(student.adminComment) : '',
                    imported_at: importTimestamp // Track when imported
                },
                $setOnInsert: {},
                $currentDate: {
                    updatedAt: true // Always update timestamp
                }
            };

            // Handle filter_status: only set in one place to avoid MongoDB conflict
            // If filterStatus is explicitly provided and not empty, update it in $set (for both new and existing)
            // Otherwise, set it in $setOnInsert (only for new records)
            if (student.filterStatus !== undefined && student.filterStatus !== null && student.filterStatus !== '') {
                updateOperation.$set.filter_status = student.filterStatus;
            } else {
                // Only set in $setOnInsert if not setting in $set (to avoid conflict)
                updateOperation.$setOnInsert.filter_status = '';
            }

            return {
                updateOne: {
                    filter: filter,
                    update: updateOperation,
                    upsert: true // Insert if no match found
                }
            };
        });

        console.log('Starting bulk operations with timestamp:', importTimestamp);
        console.log('Number of bulk operations:', bulkOps.length);

        let importedCount = 0;
        let updatedCount = 0;

        let affectedStudentIds = [];

        if (bulkOps.length > 0) {
            const result = await CallSessionStudent.bulkWrite(bulkOps);
            // Count both new inserts and updates as "processed" for this import
            importedCount = result.upsertedCount || 0;
            updatedCount = result.modifiedCount || 0;
            const totalProcessed = importedCount + updatedCount;
            
            console.log(`Import summary: ${importedCount} inserted, ${updatedCount} updated, ${totalProcessed} total processed out of ${students.length} students in import`);

            // Find all students that were affected by this import (updated/created since importTimestamp)
            // This includes both newly inserted and updated existing students
            const affectedStudents = await CallSessionStudent.find({
                call_session_id: id,
                updatedAt: { $gte: importTimestamp }
            });

            affectedStudentIds = affectedStudents.map(student => student._id.toString());

            console.log('Bulk write result:', {
                upsertedCount: result.upsertedCount,
                modifiedCount: result.modifiedCount,
                matchedCount: result.matchedCount,
                affectedStudentsCount: affectedStudents.length,
                affectedStudentIds: affectedStudentIds
            });
        }

        // Verify that students were actually imported/updated
        const recentlyUpdated = await CallSessionStudent.find({
            call_session_id: id,
            $or: [
                { imported_at: { $gte: importTimestamp } },
                { updatedAt: { $gte: importTimestamp } }
            ]
        }).limit(5);

        console.log('Students found with imported_at or updatedAt >= importTimestamp after import:', recentlyUpdated.length);
        if (recentlyUpdated.length > 0) {
            console.log('Sample imported/updated students:');
            recentlyUpdated.forEach((s, idx) => {
                console.log(`  ${idx + 1}. ${s.name} (ID: ${s.student_id || 'N/A'}) - imported_at: ${s.imported_at}, updatedAt: ${s.updatedAt}`);
            });
        }
        
        // Count total students in session after import
        const totalStudentsInSession = await CallSessionStudent.countDocuments({ call_session_id: id });
        console.log(`Total students in session after import: ${totalStudentsInSession}`);

        await logAuditAction(req.user.id, 'IMPORT_CALL_SESSION_STUDENTS', {
            session_id: id,
            count: students.length,
            imported: importedCount,
            updated: updatedCount
        });

        // Generate an undo token that expires in 10 minutes
        // Use the same timestamp as imported_at for consistency
        const undoToken = `${id}_${importTimestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log('Sending response with backupId:', backupId);

        // Get final count of students in session
        const finalStudentCount = await CallSessionStudent.countDocuments({ call_session_id: id });
        
        res.status(200).json({
            success: true,
            message: `${students.length} students processed (${importedCount} inserted, ${updatedCount} updated). Total students in session: ${finalStudentCount}`,
            data: {
                total_in_import: students.length,
                imported: importedCount,
                updated: updatedCount,
                total_processed: importedCount + updatedCount,
                total_students_in_session: finalStudentCount,
                undo_token: undoToken,
                undo_expires_in: 10 * 60 * 1000, // 10 minutes in milliseconds
                backupId: backupId  // Include backup ID for undo
            }
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
            adminComment: s.admin_comment || '',
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
        const { 
            filterStatus, 
            attendanceStatus, 
            homeworkStatus,
            comment, 
            howMany, 
            totalTest,
            name,
            studentPhone,
            parentPhone,
            studentId: studentIdField,
            center,
            examMark
        } = req.body;
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

        // Update basic fields if provided
        if (name !== undefined) student.name = name;
        if (studentPhone !== undefined) student.student_phone = studentPhone;
        if (parentPhone !== undefined) student.parent_phone = parentPhone;
        if (studentIdField !== undefined) student.student_id = studentIdField;
        if (center !== undefined) student.center = center;
        if (examMark !== undefined) {
            student.exam_mark = examMark !== null && examMark !== '' ? examMark : null;
        }

        // Update status fields
        if (filterStatus !== undefined) {
            // It's a filter status (wrong-number, no-answer, present, etc.)
            student.filter_status = filterStatus;
        }
        if (attendanceStatus !== undefined) student.attendance_status = attendanceStatus;
        if (homeworkStatus !== undefined) student.homework_status = homeworkStatus;
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

const deleteCallSessionStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        console.log('DELETE request received for student ID:', studentId);
        console.log('User making request:', req.user ? req.user.name : 'Unknown');

        // Validate studentId is a valid MongoDB ObjectId
        console.log('Validating student ID:', studentId);
        console.log('Is studentId truthy:', !!studentId);
        console.log('Is valid ObjectId:', mongoose.isValidObjectId(studentId));

        if (!studentId || !mongoose.isValidObjectId(studentId)) {
            console.log('Invalid student ID:', studentId);
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID',
                receivedId: studentId
            });
        }

        console.log('Attempting to find student with ID:', studentId);
        const student = await CallSessionStudent.findById(studentId);
        console.log('Student lookup result:', student);
        console.log('Student found:', student ? 'Yes' : 'No');
        if (!student) {
            console.log('Student not found with ID:', studentId);
            // Try to see if any students exist at all
            const totalStudents = await CallSessionStudent.countDocuments();
            console.log('Total students in database:', totalStudents);
            return res.status(404).json({
                success: false,
                message: 'Student not found',
                studentId: studentId,
                totalStudents: totalStudents
            });
        }

        console.log('Deleting student:', student.name, 'from session:', student.call_session_id);

        // If student was assigned to someone, we need to clear that assignment
        // This prevents assistants from getting stuck
        if (student.assigned_to) {
            console.log('Clearing assignment for assistant:', student.assigned_to);
        }

        // Log the deletion for audit purposes (only if user is authenticated)
        try {
            const auditLogger = require('../utils/auditLogger');
            if (req.user && req.user.id) {
                await auditLogger.logAuditAction(req.user.id, 'DELETE_STUDENT', {
                    studentId: studentId,
                    studentName: student.name,
                    sessionId: student.call_session_id,
                    wasAssigned: !!student.assigned_to
                });
            } else {
                console.warn('Cannot log audit: User not authenticated');
            }
        } catch (auditError) {
            console.error('Audit logging failed:', auditError.message);
            // Continue with deletion even if audit logging fails
        }

        const deleteResult = await CallSessionStudent.findByIdAndDelete(studentId);
        console.log('Student delete result:', deleteResult ? 'Success' : 'Failed - student not found');
        if (!deleteResult) {
            throw new Error('Student could not be deleted - may not exist');
        }

        res.json({
            success: true,
            message: 'Student removed successfully'
        });
    } catch (error) {
        console.error('Delete student error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // Provide more specific error information
        let errorMessage = 'Error deleting student';
        if (error.message.includes('Cast to ObjectId failed')) {
            errorMessage = 'Invalid student ID format';
        } else if (error.message.includes('not found')) {
            errorMessage = 'Student not found in database';
        }

        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message,
            studentId: studentId
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
        const {
            user_id,
            type,
            status,
            call_session_id,
            start_date,
            end_date,
            duration_min,
            duration_max,
            students_min,
            students_max,
            page = 1,
            limit = 50
        } = req.query;

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
        if (call_session_id) query.call_session_id = call_session_id;

        // Status filter (active = end_time is null, completed = end_time exists)
        if (status === 'active') {
            query.end_time = null;
        } else if (status === 'completed') {
            query.end_time = { $ne: null };
        }

        // Date range filter
        if (start_date || end_date) {
            query.start_time = {};
            if (start_date) {
                query.start_time.$gte = moment.tz(start_date, 'Africa/Cairo').startOf('day').toDate();
            }
            if (end_date) {
                query.start_time.$lte = moment.tz(end_date, 'Africa/Cairo').endOf('day').toDate();
            }
        }

        // Duration filters
        if (duration_min || duration_max) {
            query.duration_minutes = {};
            if (duration_min) query.duration_minutes.$gte = parseInt(duration_min);
            if (duration_max) query.duration_minutes.$lte = parseInt(duration_max);
        }

        // If students count filtering is used, we need to fetch all records first
        // because students count is calculated dynamically and can't be filtered in DB query
        const hasStudentsFilter = students_min || students_max;
        const fetchLimit = hasStudentsFilter ? 10000 : parseInt(limit); // Fetch more when filtering by students
        const skip = hasStudentsFilter ? 0 : (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .populate('user_id', 'name email')
                .populate('call_session_id', 'name')
                .populate('whatsapp_schedule_id')
                .populate('deleted_by', 'name')
                .sort({ start_time: -1 })
                .skip(skip)
                .limit(fetchLimit)
                .lean(),
            ActivityLog.countDocuments(query)
        ]);

        // Get students handled count for call sessions
        const callSessionIds = logs
            .filter(log => log.type === 'call' && log.call_session_id)
            .map(log => log.call_session_id._id);

        let studentsHandledCounts = {};
        if (callSessionIds.length > 0) {
            // Get unique user-call_session combinations
            const userSessionPairs = logs
                .filter(log => log.type === 'call' && log.call_session_id && log.user_id)
                .map(log => ({
                    userId: log.user_id._id,
                    sessionId: log.call_session_id._id
                }));

            // Remove duplicates
            const uniquePairs = Array.from(
                new Map(userSessionPairs.map(p => [`${p.userId}_${p.sessionId}`, p])).values()
            );

            // Count students for each user-session pair
            for (const pair of uniquePairs) {
                const count = await CallSessionStudent.countDocuments({
                    call_session_id: pair.sessionId,
                    assigned_to: pair.userId
                });
                studentsHandledCounts[`${pair.userId}_${pair.sessionId}`] = count;
            }
        }

        let formattedLogs = logs.map(log => {
            const startMoment = moment.tz(log.start_time, 'Africa/Cairo');
            const endMoment = log.end_time ? moment.tz(log.end_time, 'Africa/Cairo') : null;

            // Get students handled count for call sessions
            let studentsHandledCount = 0;
            if (log.type === 'call' && log.call_session_id && log.user_id) {
                const key = `${log.user_id._id}_${log.call_session_id._id}`;
                studentsHandledCount = studentsHandledCounts[key] || 0;
            }

            return {
                id: log._id,
                user_id: log.user_id?._id,
                user_name: log.user_id?.name || 'Unknown',
                type: log.type,
                start_time: log.start_time,
                end_time: log.end_time,
                duration_minutes: log.duration_minutes || 0,
                students_handled_count: studentsHandledCount,
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

        // Apply students count filters after formatting
        if (hasStudentsFilter) {
            formattedLogs = formattedLogs.filter(log => {
                const count = log.students_handled_count;
                const minCheck = !students_min || count >= parseInt(students_min);
                const maxCheck = !students_max || count <= parseInt(students_max);
                return minCheck && maxCheck;
            });
        }

        // Calculate pagination - if we filtered by students, paginate the filtered results
        // Otherwise, use the original pagination
        let paginatedLogs;
        let paginationTotal;
        let paginationPages;

        if (hasStudentsFilter) {
            // Paginate the filtered results
            paginationTotal = formattedLogs.length;
            paginationPages = paginationTotal > 0 ? Math.ceil(paginationTotal / parseInt(limit)) : 1;
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const endIndex = startIndex + parseInt(limit);
            paginatedLogs = formattedLogs.slice(startIndex, endIndex);
        } else {
            // Use original pagination (already paginated from DB)
            paginatedLogs = formattedLogs;
            paginationTotal = total;
            paginationPages = total > 0 ? Math.ceil(total / parseInt(limit)) : 1;
        }

        res.json({
            success: true,
            data: paginatedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: paginationTotal,
                pages: paginationPages
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

/**
 * Undo Import Students
 * POST /api/activities/call-sessions/:id/undo-import
 */
// Create temp backup of students before import
const createTempBackup = async (sessionId, students) => {
    try {
        const backupId = `backup_${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store backup in a simple in-memory store for now (could be Redis or database)
        // For production, this should be stored in database or Redis
        if (!global.tempBackups) {
            global.tempBackups = new Map();
        }

        const backupData = {
            sessionId,
            students: JSON.parse(JSON.stringify(students)), // Deep copy
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        };

        global.tempBackups.set(backupId, backupData);

        // Clean up expired backups
        for (const [key, backup] of global.tempBackups.entries()) {
            if (backup.expiresAt < new Date()) {
                global.tempBackups.delete(key);
            }
        }

        console.log(`Created temp backup ${backupId} for session ${sessionId} with ${students.length} students`);
        return backupId;
    } catch (error) {
        console.error('Error creating temp backup:', error);
        return null;
    }
};

// Restore from temp backup
const restoreFromTempBackup = async (sessionId, backupId) => {
    try {
        if (!global.tempBackups || !global.tempBackups.has(backupId)) {
            throw new Error('Backup not found or expired');
        }

        const backup = global.tempBackups.get(backupId);

        if (backup.sessionId !== sessionId) {
            throw new Error('Backup does not belong to this session');
        }

        if (backup.expiresAt < new Date()) {
            global.tempBackups.delete(backupId);
            throw new Error('Backup has expired');
        }

        // Replace all students in the session with the backup data
        await CallSessionStudent.deleteMany({ call_session_id: sessionId });

        if (backup.students.length > 0) {
            // Clear any assignments that might conflict
            const studentsToInsert = backup.students.map(student => ({
                ...student,
                call_session_id: sessionId,
                _id: undefined, // Let MongoDB generate new IDs
                assigned_to: undefined, // Clear any old assignments
                assigned_at: undefined
            }));

            await CallSessionStudent.insertMany(studentsToInsert);
        }

        // Clean up the backup
        global.tempBackups.delete(backupId);

        console.log(`Restored ${backup.students.length} students from backup ${backupId} for session ${sessionId}`);
        return backup.students.length;

    } catch (error) {
        console.error('Error restoring from temp backup:', error);
        throw error;
    }
};

const undoImportStudents = async (req, res) => {
    console.log('UNDO FUNCTION CALLED - Session:', req.params.id, 'Token:', req.body.undo_token);

    try {
        const { id } = req.params;
        const { undo_token, backupId } = req.body;

        console.log('Undo import request received for session:', id, 'token:', undo_token, 'backupId:', backupId);

        if (!undo_token) {
            return res.status(400).json({
                success: false,
                message: 'Undo token is required'
            });
        }

        if (!backupId) {
            return res.status(400).json({
                success: false,
                message: 'Backup ID is required'
            });
        }

        // Parse undo token: sessionId_timestamp_randomString
        const [tokenSessionId, timestampStr] = undo_token.split('_');

        console.log('Parsed token - sessionId:', tokenSessionId, 'timestamp:', timestampStr);
        console.log('Expected sessionId:', id);

        if (tokenSessionId !== id) {
            console.log('Token validation failed: session ID mismatch');
            return res.status(400).json({
                success: false,
                message: 'Invalid undo token for this session'
            });
        }

        const importTimestamp = new Date(parseInt(timestampStr));
        const now = new Date();

        console.log('Import timestamp:', importTimestamp, 'Current time:', now);

        // Check if undo is still valid (within 10 minutes)
        const timeDiff = now - importTimestamp;
        const maxUndoTime = 10 * 60 * 1000; // 10 minutes

        console.log('Time difference:', timeDiff, 'Max allowed:', maxUndoTime);

        if (timeDiff > maxUndoTime) {
            console.log('Undo time expired');
            return res.status(400).json({
                success: false,
                message: 'Undo time has expired (10 minutes limit)'
            });
        }

        // Restore from backup
        try {
            const restoredCount = await restoreFromTempBackup(id, backupId);

            await logAuditAction(req.user.id, 'UNDO_IMPORT_STUDENTS', {
                session_id: id,
                restored_count: restoredCount,
                backup_id: backupId
            });

            res.status(200).json({
                success: true,
                message: `Successfully restored ${restoredCount} students from backup`,
                data: {
                    restored_count: restoredCount
                }
            });

        } catch (restoreError) {
            console.error('Failed to restore from backup:', restoreError);
            return res.status(500).json({
                success: false,
                message: `Failed to restore from backup: ${restoreError.message}`
            });
        }

        // Convert string IDs to ObjectIds for MongoDB query
        const objectIds = newlyAddedStudentIds.map(id => {
            try {
                return require('mongoose').Types.ObjectId(id);
            } catch (error) {
                console.error('Invalid ObjectId in newlyAddedStudentIds:', id);
                return null;
            }
        }).filter(id => id !== null);

        console.log('Converted', newlyAddedStudentIds.length, 'string IDs to', objectIds.length, 'valid ObjectIds');

        if (objectIds.length === 0) {
            // If no valid IDs, check if this is an import that only updated existing students
            console.log('No valid student IDs found. This might be an import that only updated existing students.');
            return res.status(200).json({
                success: true,
                message: 'Import undo completed - no new students were added to remove',
                data: {
                    removed_count: 0,
                    reason: 'No new students were added during this import'
                }
            });
        }

        // Safety check: don't allow undoing more than 100 students at once
        if (objectIds.length > 100) {
            return res.status(400).json({
                success: false,
                message: `Too many students to undo (${objectIds.length}). Maximum allowed is 100.`
            });
        }

        // Find students by their specific IDs
        const studentsToRemove = await CallSessionStudent.find({
            _id: { $in: objectIds }
        });

        console.log('Found', studentsToRemove.length, 'students to remove by ID');

        if (studentsToRemove.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No students found with the provided IDs'
            });
        }

        if (studentsToRemove.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No students found to undo'
            });
        }

        // First, clear any assignments for these students to prevent assistant lock-in
        await CallSessionStudent.updateMany(
            { _id: { $in: objectIds } },
            {
                $unset: {
                    assigned_to: 1,
                    assigned_at: 1
                }
            }
        );

        // Then remove the students
        console.log('About to delete', studentsToRemove.length, 'students by ID');
        const result = await CallSessionStudent.deleteMany({
            _id: { $in: objectIds }
        });

        console.log('Delete result:', {
            acknowledged: result.acknowledged,
            deletedCount: result.deletedCount
        });

        await logAuditAction(req.user.id, 'UNDO_IMPORT_STUDENTS', {
            session_id: id,
            removed_count: result.deletedCount,
            student_ids: newlyAddedStudentIds
        });

        // Verify the deletion by checking if the specific students still exist
        const stillExistCount = await CallSessionStudent.countDocuments({
            _id: { $in: objectIds }
        });

        console.log('Students still existing after deletion:', stillExistCount);

        res.status(200).json({
            success: true,
            message: `Successfully removed ${result.deletedCount} recently imported students`,
            data: {
                removed_count: result.deletedCount,
                remaining_students: remainingStudents
            }
        });

    } catch (error) {
        console.error('Undo import students error:', error);
        await logError(error, {
            action: 'undoImportStudents',
            sessionId: req.params.id,
            undoToken: req.body.undo_token
        }, req);

        res.status(500).json({
            success: false,
            message: 'Error undoing student import'
        });
    }
};

/**
 * Start Round Two - Create a new separate call session with no-answer students
 * POST /api/activities/call-sessions/:id/start-round-two
 */
const startRoundTwo = async (req, res) => {
    try {
        const { id } = req.params;

        const originalSession = await CallSession.findById(id);
        if (!originalSession) {
            return res.status(404).json({
                success: false,
                message: 'Call session not found'
            });
        }

        // Allow round two to be started for any session status
        // Removed the check that required session to be 'active'

        // Find all students with 'no-answer' status from the original session
        const noAnswerStudents = await CallSessionStudent.find({
            call_session_id: id,
            filter_status: 'no-answer'
        }).lean(); // Use lean() for better performance

        if (noAnswerStudents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No students found with "no-answer" status available for round two'
            });
        }

        // Create a new call session for round two
        const roundTwoSessionName = `${originalSession.name} - Round Two`;
        const newSession = new CallSession({
            name: roundTwoSessionName,
            date: originalSession.date, // Use same date as original
            start_time: originalSession.start_time, // Use same start time
            status: 'pending' // Start as pending, admin/assistants can activate it
        });

        await newSession.save();

        // Copy students to the new session with reset filter_status
        const studentsToImport = noAnswerStudents.map(student => ({
            name: student.name,
            student_phone: student.student_phone || '',
            parent_phone: student.parent_phone || '',
            student_id: student.student_id || '',
            center: student.center || '',
            exam_mark: student.exam_mark || null,
            attendance_status: student.attendance_status || '',
            homework_status: student.homework_status || '',
            filter_status: '', // Reset filter status for fresh start
            comments: student.comments || [], // Keep comments history
            how_many: student.how_many || false,
            total_test: student.total_test || false,
            call_session_id: newSession._id,
            // Do not copy assigned_to, round_two_assigned_to - start fresh
            assigned_to: null,
            assigned_at: null,
            round_two_assigned_to: null,
            round_two_assigned_at: null
        }));

        // Bulk insert students into the new session
        if (studentsToImport.length > 0) {
            await CallSessionStudent.insertMany(studentsToImport);
        }

        await logAuditAction(req.user.id, 'START_ROUND_TWO', {
            original_session_id: id,
            new_session_id: newSession._id.toString(),
            students_count: noAnswerStudents.length
        });

        res.status(200).json({
            success: true,
            message: `Round two session created successfully. ${noAnswerStudents.length} students imported from original session.`,
            data: {
                new_session_id: newSession._id,
                new_session_name: roundTwoSessionName,
                students_count: noAnswerStudents.length,
                original_session_id: id
            }
        });

    } catch (error) {
        console.error('Start round two error:', error);
        await logError(error, {
            action: 'startRoundTwo',
            sessionId: req.params.id
        }, req);

        res.status(500).json({
            success: false,
            message: 'Error starting round two',
            error: error.message
        });
    }
};

/**
 * Assign Next Round Two Student
 * POST /api/activities/call-sessions/:id/assign-round-two
 */
const assignNextRoundTwoStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const LOCK_TIMEOUT_MINUTES = 60; // Increased from 15 to 60 minutes

        const session = await CallSession.findById(id);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        if (session.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Session is not active' });
        }

        // 1. Check if user already has an assigned round two student
        const currentRoundTwoAssignment = await CallSessionStudent.findOne({
            call_session_id: id,
            round_two_assigned_to: userId,
            filter_status: 'no-answer'
        });

        if (currentRoundTwoAssignment) {
            // Return the current assignment
            console.log(`[Round Two Assignment] User ${userId} continuing with round two student ${currentRoundTwoAssignment._id} (${currentRoundTwoAssignment.name})`);
            const formattedStudent = {
                id: currentRoundTwoAssignment._id,
                name: currentRoundTwoAssignment.name,
                studentId: currentRoundTwoAssignment.student_id,
                studentPhone: currentRoundTwoAssignment.student_phone,
                parentPhone: currentRoundTwoAssignment.parent_phone,
                center: currentRoundTwoAssignment.center,
                examMark: currentRoundTwoAssignment.exam_mark,
                attendanceStatus: currentRoundTwoAssignment.attendance_status,
                homeworkStatus: currentRoundTwoAssignment.homework_status,
                filterStatus: currentRoundTwoAssignment.filter_status,
                comments: currentRoundTwoAssignment.comments || [],
                assignedAt: currentRoundTwoAssignment.round_two_assigned_at,
                isRoundTwo: true
            };

            return res.json({
                success: true,
                message: 'Current round two student assignment returned',
                data: formattedStudent
            });
        }

        // 2. Find an available no-answer student not assigned for round two
        console.log(`[Round Two Assignment] User ${userId} looking for round two students in session ${id}`);
        const availableStudent = await CallSessionStudent.findOne({
            call_session_id: id,
            filter_status: 'no-answer',
            round_two_assigned_to: null
        }).sort({ createdAt: 1 }); // Oldest first

        if (!availableStudent) {
            console.log(`[Round Two Assignment] No round two students available for user ${userId} in session ${id}`);
            return res.status(404).json({
                success: false,
                message: 'No round two students available for assignment'
            });
        }

        // 3. Assign the student for round two
        console.log(`[Round Two Assignment] Assigned round two student ${availableStudent._id} (${availableStudent.name}) to user ${userId}`);
        availableStudent.round_two_assigned_to = userId;
        availableStudent.round_two_assigned_at = new Date();
        await availableStudent.save();

        await logAuditAction(userId, 'ASSIGN_ROUND_TWO_STUDENT', {
            session_id: id,
            student_id: availableStudent._id.toString()
        });

        // 4. Calculate stats
        const totalRoundTwoStudents = await CallSessionStudent.countDocuments({
            call_session_id: id,
            filter_status: 'no-answer'
        });

        const completedRoundTwo = await CallSessionStudent.countDocuments({
            call_session_id: id,
            filter_status: 'no-answer',
            round_two_assigned_to: { $ne: null }
        });

        const remainingRoundTwo = totalRoundTwoStudents - completedRoundTwo;

        const userRoundTwoCompleted = await CallSessionStudent.countDocuments({
            call_session_id: id,
            filter_status: 'no-answer',
            round_two_assigned_to: req.user.id
        });

        const sendResponse = (student) => {
            const formattedStudent = {
                id: student._id,
                name: student.name,
                studentId: student.student_id,
                studentPhone: student.student_phone,
                parentPhone: student.parent_phone,
                center: student.center,
                examMark: student.exam_mark,
                attendanceStatus: student.attendance_status,
                homeworkStatus: student.homework_status,
                filterStatus: student.filter_status,
                comments: student.comments || [],
                assignedAt: student.round_two_assigned_at,
                isRoundTwo: true
            };

            res.json({
                success: true,
                message: 'Round two student assigned',
                data: {
                    student: formattedStudent,
                    stats: {
                        total: totalRoundTwoStudents,
                        completed: completedRoundTwo,
                        remaining: remainingRoundTwo,
                        userCompleted: userRoundTwoCompleted
                    }
                }
            });
        };

        sendResponse(availableStudent);

    } catch (error) {
        console.error('Assign round two student error:', error);
        await logError(error, {
            action: 'assignNextRoundTwoStudent',
            sessionId: req.params.id,
            userId: req.user.id
        }, req);

        res.status(500).json({
            success: false,
            message: 'Error assigning round two student',
            error: error.message
        });
    }
};

// Periodic cleanup of expired backups
setInterval(() => {
    if (global.tempBackups) {
        const now = new Date();
        let cleaned = 0;
        for (const [key, backup] of global.tempBackups.entries()) {
            if (backup.expiresAt < now) {
                global.tempBackups.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} expired temp backups`);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

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
    undoImportStudents,
    startRoundTwo,
    assignNextRoundTwoStudent,
    getCallSessionStudents,
    updateCallSessionStudent,
    deleteCallSessionStudent,
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


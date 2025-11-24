const User = require('../models/User');
const Center = require('../models/Center');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const { logAuditAction } = require('../utils/auditLogger');

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

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

        // Active sessions today (one-time and weekly)
        const jsDay = today.getDay();
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

        const deletedAssistant = await User.findOneAndDelete({
            _id: id,
            role: 'assistant'
        });

        if (!deletedAssistant) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_ASSISTANT', {
            assistant_id: id
        });

        res.json({
            success: true,
            message: 'Assistant deleted successfully'
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
            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);

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
            start_time,
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
        res.status(500).json({
            success: false,
            message: 'Error creating session'
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
        if (start_time) updateData.start_time = start_time;
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

        const deletedSession = await Session.findByIdAndDelete(id);

        if (!deletedSession) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_SESSION', {
            session_id: id
        });

        res.json({
            success: true,
            message: 'Session deleted successfully'
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
                const startDate = new Date(start_date);
                startDate.setHours(0, 0, 0, 0);
                query.time_recorded.$gte = startDate;
            }
            if (end_date) {
                const endDate = new Date(end_date);
                endDate.setHours(23, 59, 59, 999);
                query.time_recorded.$lte = endDate;
            }
        }

        if (center_id) query.center_id = center_id;
        if (assistant_id) query.assistant_id = assistant_id;

        // Get total count for pagination
        const total = await Attendance.countDocuments(query);

        // Get records
        let attendanceQuery = Attendance.find(query)
            .populate('assistant_id', 'name')
            .populate('center_id', 'name')
            .populate('session_id', 'subject start_time')
            .sort({ time_recorded: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const records = await attendanceQuery;

        // Filter by subject if provided (done after populate)
        let filteredRecords = records;
        if (subject) {
            filteredRecords = records.filter(r =>
                r.session_id?.subject?.toLowerCase().includes(subject.toLowerCase())
            );
        }

        const formattedRecords = filteredRecords.map(r => ({
            id: r._id,
            time_recorded: r.time_recorded,
            delay_minutes: r.delay_minutes,
            notes: r.notes,
            assistant_name: r.assistant_id?.name || 'Unknown',
            center_name: r.center_id?.name || 'Unknown',
            subject: r.session_id?.subject || 'Unknown',
            start_time: r.session_id?.start_time,
            latitude: r.latitude,
            longitude: r.longitude
        }));

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
 * Record attendance manually (admin only)
 * POST /api/admin/attendance/manual
 */
const recordAttendanceManually = async (req, res) => {
    try {
        const { assistant_id, session_id, center_id, delay_minutes = 0, notes = '' } = req.body;

        if (!assistant_id || !session_id || !center_id) {
            return res.status(400).json({
                success: false,
                message: 'Assistant, session, and center are required'
            });
        }

        // Check if attendance already exists
        const existing = await Attendance.findOne({
            assistant_id,
            session_id
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Attendance record already exists for this assistant and session'
            });
        }

        // Get center coordinates for the attendance record
        const center = await Center.findById(center_id);
        if (!center) {
            return res.status(404).json({
                success: false,
                message: 'Center not found'
            });
        }

        const newAttendance = new Attendance({
            assistant_id,
            session_id,
            center_id,
            latitude: center.latitude,
            longitude: center.longitude,
            delay_minutes,
            notes: notes || 'Manually recorded by admin'
        });

        await newAttendance.save();

        // Log the action
        await logAuditAction(req.user.id, 'MANUAL_ATTENDANCE', {
            attendance_id: newAttendance._id.toString(),
            assistant_id,
            session_id,
            center_id,
            delay_minutes
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
 * Clear/delete attendance record
 * DELETE /api/admin/attendance/:id
 */
const clearAttendance = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedAttendance = await Attendance.findByIdAndDelete(id);

        if (!deletedAttendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_ATTENDANCE', {
            attendance_id: id
        });

        res.json({
            success: true,
            message: 'Attendance record deleted successfully'
        });
    } catch (error) {
        console.error('Clear attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting attendance record'
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
        const { new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        const passwordHash = await bcrypt.hash(new_password, 10);

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
                const startDate = new Date(start_date);
                startDate.setHours(0, 0, 0, 0);
                query.timestamp.$gte = startDate;
            }
            if (end_date) {
                const endDate = new Date(end_date);
                endDate.setHours(23, 59, 59, 999);
                query.timestamp.$lte = endDate;
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
    recordAttendanceManually,
    clearAttendance,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    changeUserPassword,
    getAuditLogs
};

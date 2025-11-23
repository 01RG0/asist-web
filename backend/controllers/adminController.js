const db = require('../config/database');
const bcrypt = require('bcryptjs');
const path = require('path');
const { logAuditAction } = require('../utils/auditLogger');

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res) => {
    try {
        // Today's attendance count
        const [todayAttendance] = await db.query(
            'SELECT COUNT(*) as count FROM attendance WHERE DATE(time_recorded) = CURDATE()'
        );

        // Late arrivals today
        const [lateArrivals] = await db.query(
            'SELECT COUNT(*) as count FROM attendance WHERE DATE(time_recorded) = CURDATE() AND delay_minutes > 0'
        );

        // Total centers
        const [totalCenters] = await db.query(
            'SELECT COUNT(*) as count FROM centers'
        );

        // Active sessions today
        const [activeSessions] = await db.query(
            'SELECT COUNT(*) as count FROM sessions WHERE DATE(start_time) = CURDATE()'
        );

        // Recent attendance today with details
        const [recentAttendance] = await db.query(
            `SELECT a.id, a.time_recorded, a.delay_minutes,
                    u.name as assistant_name, 
                    c.name as center_name,
                    s.subject
             FROM attendance a
             JOIN users u ON a.assistant_id = u.id
             JOIN centers c ON a.center_id = c.id
             JOIN sessions s ON a.session_id = s.id
             WHERE DATE(a.time_recorded) = CURDATE()
             ORDER BY a.time_recorded DESC
             LIMIT 10`
        );

        res.json({
            success: true,
            data: {
                totalAttendanceToday: todayAttendance[0].count,
                lateArrivals: lateArrivals[0].count,
                totalCenters: totalCenters[0].count,
                activeSessions: activeSessions[0].count,
                recentAttendance: recentAttendance
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
        const [assistants] = await db.query(
            `SELECT u.id, u.name, u.email, u.created_at,
              GROUP_CONCAT(c.name SEPARATOR ', ') as centers
       FROM users u
       LEFT JOIN assistants_centers ac ON u.id = ac.assistant_id
       LEFT JOIN centers c ON ac.center_id = c.id
       WHERE u.role = 'assistant'
       GROUP BY u.id
       ORDER BY u.name`
        );

        res.json({
            success: true,
            data: assistants
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
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert assistant
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, 'assistant']
        );

        const assistantId = result.insertId;

        // Assign centers
        if (center_ids.length > 0) {
            const values = center_ids.map(centerId => [assistantId, centerId]);
            await db.query(
                'INSERT INTO assistants_centers (assistant_id, center_id) VALUES ?',
                [values]
            );
        }

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_ASSISTANT', {
            assistant_id: assistantId,
            name,
            email,
            center_ids
        });

        res.status(201).json({
            success: true,
            message: 'Assistant created successfully',
            data: { id: assistantId, name, email }
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

        // Update user info
        if (name || email) {
            await db.query(
                'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ? AND role = ?',
                [name, email, id, 'assistant']
            );
        }

        // Update centers if provided
        if (center_ids) {
            // Remove existing
            await db.query('DELETE FROM assistants_centers WHERE assistant_id = ?', [id]);

            // Add new
            if (center_ids.length > 0) {
                const values = center_ids.map(centerId => [id, centerId]);
                await db.query(
                    'INSERT INTO assistants_centers (assistant_id, center_id) VALUES ?',
                    [values]
                );
            }
        }

        // Log the action
        await logAuditAction(req.user.id, 'UPDATE_ASSISTANT', {
            assistant_id: id,
            name,
            email,
            center_ids
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

        const [result] = await db.query(
            'DELETE FROM users WHERE id = ? AND role = ?',
            [id, 'assistant']
        );

        if (result.affectedRows === 0) {
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

        let query = `
      SELECT s.id, s.subject, s.start_time, s.recurrence_type, s.day_of_week, s.is_active,
             u.name as assistant_name, c.name as center_name,
             s.assistant_id, s.center_id
      FROM sessions s
      LEFT JOIN users u ON s.assistant_id = u.id
      JOIN centers c ON s.center_id = c.id
      WHERE 1=1
    `;

        const params = [];

        if (date) {
            query += ' AND DATE(s.start_time) = ?';
            params.push(date);
        }

        if (center_id) {
            query += ' AND s.center_id = ?';
            params.push(center_id);
        }

        if (assistant_id) {
            query += ' AND s.assistant_id = ?';
            params.push(assistant_id);
        }

        if (recurrence_type) {
            query += ' AND s.recurrence_type = ?';
            params.push(recurrence_type);
        }

        // Only show active sessions by default
        query += ' AND s.is_active = TRUE';

        query += ' ORDER BY s.start_time DESC';

        const [sessions] = await db.query(query, params);

        res.json({
            success: true,
            data: sessions
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

        const [sessions] = await db.query(
            `SELECT s.id, s.subject, s.start_time, s.recurrence_type, s.day_of_week, s.is_active,
                    u.name as assistant_name, c.name as center_name,
                    s.assistant_id, s.center_id
             FROM sessions s
             LEFT JOIN users u ON s.assistant_id = u.id
             JOIN centers c ON s.center_id = c.id
             WHERE s.id = ?`,
            [id]
        );

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        res.json({
            success: true,
            data: sessions[0]
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

        const [result] = await db.query(
            `INSERT INTO sessions (assistant_id, center_id, subject, start_time, recurrence_type, day_of_week) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [assistant_id, center_id, subject, start_time, recurrence_type, day_of_week]
        );

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_SESSION', {
            session_id: result.insertId,
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
            data: { id: result.insertId }
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

        const [result] = await db.query(
            `UPDATE sessions 
       SET assistant_id = COALESCE(?, assistant_id),
           center_id = COALESCE(?, center_id),
           subject = COALESCE(?, subject),
           start_time = COALESCE(?, start_time),
           recurrence_type = COALESCE(?, recurrence_type),
           day_of_week = COALESCE(?, day_of_week),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
            [assistant_id, center_id, subject, start_time, recurrence_type, day_of_week, is_active, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'UPDATE_SESSION', {
            session_id: id,
            assistant_id,
            center_id,
            subject,
            start_time,
            recurrence_type,
            day_of_week,
            is_active
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

        const [result] = await db.query('DELETE FROM sessions WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
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

        let query = `
      SELECT a.id, a.time_recorded, a.delay_minutes, a.notes,
               u.name as assistant_name, c.name as center_name,
               s.subject, s.start_time,
               a.latitude, a.longitude
        FROM attendance a
        JOIN users u ON a.assistant_id = u.id
        JOIN centers c ON a.center_id = c.id
        JOIN sessions s ON a.session_id = s.id
        WHERE 1=1
      `;

        const params = [];

        if (start_date) {
            query += ' AND DATE(a.time_recorded) >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND DATE(a.time_recorded) <= ?';
            params.push(end_date);
        }

        if (center_id) {
            query += ' AND a.center_id = ?';
            params.push(center_id);
        }

        if (assistant_id) {
            query += ' AND a.assistant_id = ?';
            params.push(assistant_id);
        }

        if (subject) {
            query += ' AND s.subject LIKE ?';
            params.push(`%${subject}%`);
        }

        // Get total count for pagination
        let countQuery = `
      SELECT COUNT(*) as total
        FROM attendance a
        JOIN users u ON a.assistant_id = u.id
        JOIN centers c ON a.center_id = c.id
        JOIN sessions s ON a.session_id = s.id
        WHERE 1=1
      `;

        const countParams = [...params]; // Copy params for count

        if (start_date) {
            countQuery += ' AND DATE(a.time_recorded) >= ?';
        }

        if (end_date) {
            countQuery += ' AND DATE(a.time_recorded) <= ?';
        }

        if (center_id) {
            countQuery += ' AND a.center_id = ?';
        }

        if (assistant_id) {
            countQuery += ' AND a.assistant_id = ?';
        }

        if (subject) {
            countQuery += ' AND s.subject LIKE ?';
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        // Add pagination
        const offset = (page - 1) * limit;
        query += ' ORDER BY a.time_recorded DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [records] = await db.query(query, params);

        res.json({
            success: true,
            data: records,
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
 * Get all users (assistants and admins)
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, name, email, role, created_at FROM users ORDER BY name'
        );

        res.json({
            success: true,
            data: users
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

        const [users] = await db.query(
            'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: users[0]
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
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, role]
        );

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_USER', {
            user_id: result.insertId,
            name,
            email,
            role
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: { id: result.insertId, name, email, role }
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

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (name) {
            updates.push('name = ?');
            params.push(name);
        }
        if (email) {
            updates.push('email = ?');
            params.push(email);
        }
        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        if (password) {
            // Hash the new password
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            params.push(passwordHash);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        params.push(id);
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

        const [result] = await db.query(query, params);

        if (result.affectedRows === 0) {
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

        const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
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
 * Change user password (admin only)
 * PUT /api/admin/users/:id/password
 */
const changeUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Hash the new password
        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'CHANGE_USER_PASSWORD', {
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
 * Manually record attendance for an assistant (admin only)
 * POST /api/admin/attendance/manual
 */
const recordAttendanceManually = async (req, res) => {
    try {
        const { assistant_id, session_id, time_recorded, notes } = req.body;

        // Validation
        if (!assistant_id || !session_id) {
            return res.status(400).json({
                success: false,
                message: 'Assistant ID and Session ID are required'
            });
        }

        // Get session details
        const [sessions] = await db.query(
            `SELECT s.id, s.subject, s.center_id, s.start_time,
                    c.name as center_name, c.latitude, c.longitude
             FROM sessions s
             JOIN centers c ON s.center_id = c.id
             WHERE s.id = ?`,
            [session_id]
        );

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        const session = sessions[0];

        // Check if assistant exists and is an assistant
        const [assistants] = await db.query(
            'SELECT id, name FROM users WHERE id = ? AND role = ?',
            [assistant_id, 'assistant']
        );

        if (assistants.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        const assistant = assistants[0];

        // Check if already attended
        const [existingAttendance] = await db.query(
            'SELECT id FROM attendance WHERE session_id = ? AND assistant_id = ?',
            [session_id, assistant_id]
        );

        if (existingAttendance.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Attendance already recorded for this assistant and session'
            });
        }

        // Calculate delay (if time_recorded is provided, use it; otherwise use current time)
        const recordTime = time_recorded ? new Date(time_recorded) : new Date();
        const sessionDate = new Date(session.start_time);
        const delayMs = recordTime - sessionDate;
        const delayMinutes = Math.max(0, Math.floor(delayMs / 60000));

        // Record attendance manually (using center's coordinates)
        const [result] = await db.query(
            `INSERT INTO attendance
             (assistant_id, session_id, center_id, time_recorded, delay_minutes, notes, latitude, longitude)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                assistant_id,
                session_id,
                session.center_id,
                recordTime,
                delayMinutes,
                notes || 'Manually recorded by admin',
                session.latitude || 0,  // Use center's lat or 0 fallback
                session.longitude || 0  // Use center's lng or 0 fallback
            ]
        );

        // Log the action
        await logAuditAction(req.user.id, 'MANUAL_ATTENDANCE_RECORD', {
            attendance_id: result.insertId,
            assistant_id,
            assistant_name: assistant.name,
            session_id,
            subject: session.subject,
            center_id: session.center_id,
            delay_minutes: delayMinutes,
            time_recorded: recordTime.toISOString(),
            notes: notes || null
        });

        res.json({
            success: true,
            message: `Attendance manually recorded for ${assistant.name} - ${session.subject}`,
            data: {
                attendance_id: result.insertId,
                assistant: assistant.name,
                session: session.subject,
                center: session.center_name,
                time_recorded: recordTime.toISOString(),
                delay_minutes: delayMinutes
            }
        });

    } catch (error) {
        console.error('Manual attendance recording error:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording attendance manually'
        });
    }
};

/**
 * Get audit logs with filters
 * GET /api/admin/audit-logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const { start_date, end_date, user_id, action, limit = 100 } = req.query;

        let query = `
            SELECT al.id, al.action, al.details, al.created_at,
                   u.name as user_name, u.email as user_email
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (start_date) {
            query += ' AND DATE(al.created_at) >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND DATE(al.created_at) <= ?';
            params.push(end_date);
        }

        if (user_id) {
            query += ' AND al.user_id = ?';
            params.push(user_id);
        }

        if (action) {
            query += ' AND al.action LIKE ?';
            params.push(`%${action}%`);
        }

        query += ' ORDER BY al.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [logs] = await db.query(query, params);

        res.json({
            success: true,
            data: logs
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
 * Clear all attendance records with password verification and backup
 * DELETE /api/admin/attendance/clear
 */
const clearAttendance = async (req, res) => {
    try {
        const { password } = req.body;

        // Verify system password
        if (!password || password !== 'admin123') {
            return res.status(403).json({
                success: false,
                message: 'Invalid password'
            });
        }

        // Create backup before clearing
        const backupFilename = `attendance_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '').replace(/-/g, '').replace('T', '_')}.sql`;
        const backupDir = path.join(__dirname, '..', 'database', 'backups');
        const backupPath = path.join(backupDir, backupFilename);

        // Get all attendance records for backup
        const [records] = await db.query('SELECT * FROM attendance ORDER BY id');

        if (records.length > 0) {
            // Generate SQL INSERT statements
            let sqlContent = `-- Attendance backup created on ${new Date().toISOString()}\n`;
            sqlContent += `-- Total records: ${records.length}\n\n`;

            records.forEach(record => {
                const values = [
                    record.id,
                    record.assistant_id,
                    record.session_id,
                    record.center_id,
                    record.latitude ? `'${record.latitude}'` : 'NULL',
                    record.longitude ? `'${record.longitude}'` : 'NULL',
                    `'${record.time_recorded.toISOString().slice(0, 19).replace('T', ' ')}'`,
                    record.delay_minutes,
                    record.notes ? `'${record.notes.replace(/'/g, "''")}'` : 'NULL'
                ].join(', ');

                sqlContent += `INSERT INTO attendance (id, assistant_id, session_id, center_id, latitude, longitude, time_recorded, delay_minutes, notes) VALUES (${values});\n`;
            });

            // Ensure backup directory exists
            const fs = require('fs').promises;
            try {
                await fs.mkdir(backupDir, { recursive: true });
            } catch (error) {
                // Directory might already exist, ignore error
            }

            // Write backup file
            await fs.writeFile(backupPath, sqlContent, 'utf8');
        }

        // Clear attendance table
        await db.query('TRUNCATE TABLE attendance');

        // Log the action
        await logAuditAction(req.user.id, 'CLEAR_ATTENDANCE', {
            backup_filename: backupFilename,
            records_cleared: records.length
        });

        res.json({
            success: true,
            message: `All attendance records cleared successfully. ${records.length} records backed up to ${backupFilename}`,
            data: {
                backup_filename: backupFilename,
                records_cleared: records.length
            }
        });
    } catch (error) {
        console.error('Clear attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error clearing attendance records'
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

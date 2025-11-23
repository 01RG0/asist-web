const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(checkRole('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Assistants management (legacy)
router.get('/assistants', getAllAssistants);
router.post('/assistants', createAssistant);
router.put('/assistants/:id', updateAssistant);
router.delete('/assistants/:id', deleteAssistant);

// Users management (new - used by frontend)
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.put('/users/:id/password', changeUserPassword);  // Password change endpoint
router.delete('/users/:id', deleteUser);

// Sessions management
router.get('/sessions', getAllSessions);
router.get('/sessions/:id', getSessionById);
router.post('/sessions', createSession);
router.put('/sessions/:id', updateSession);
router.delete('/sessions/:id', deleteSession);

// Attendance records
router.get('/attendance', getAttendanceRecords);
router.post('/attendance/manual', recordAttendanceManually);
router.delete('/attendance/clear', clearAttendance);

// Audit logs
router.get('/audit-logs', getAuditLogs);

module.exports = router;

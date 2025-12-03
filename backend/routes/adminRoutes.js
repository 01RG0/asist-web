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
router.get('/attendance/:id', getAttendanceById);
router.post('/attendance/manual', recordAttendanceManually);
router.put('/attendance/:id', updateAttendance);
router.delete('/attendance/:id', clearAttendance);
router.delete('/attendance/clear', clearAttendance);

// Audit logs
router.get('/audit-logs', getAuditLogs);

// Error logs
router.get('/error-logs', getErrorLogs);
router.get('/error-logs/:id', getErrorLogById);
router.put('/error-logs/:id/resolve', markErrorResolved);
router.delete('/error-logs', clearErrorLogs);
router.delete('/error-logs/:id', deleteErrorLog);

module.exports = router;

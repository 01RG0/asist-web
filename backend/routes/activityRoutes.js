const express = require('express');
const router = express.Router();
const {
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
    deleteActivityLog
} = require('../controllers/activityController');
const authenticateToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authenticateToken);

// WhatsApp Schedule routes (Admin only)
router.post('/whatsapp-schedules', checkRole('admin'), createWhatsAppSchedule);
router.get('/whatsapp-schedules', checkRole('admin'), getWhatsAppSchedules);
router.put('/whatsapp-schedules/:id', checkRole('admin'), updateWhatsAppSchedule);
router.delete('/whatsapp-schedules/:id', checkRole('admin'), deleteWhatsAppSchedule);

// Call Session routes
router.post('/call-sessions', checkRole('admin'), createCallSession);
router.get('/call-sessions', getCallSessions); // Both admin and assistant can view
router.get('/call-sessions/:id', getCallSessionById); // Both admin and assistant can view
router.put('/call-sessions/:id', checkRole('admin'), updateCallSession);
router.delete('/call-sessions/:id', checkRole('admin'), deleteCallSession);
router.post('/call-sessions/:id/start', checkRole('assistant'), startCallSession);
router.post('/call-sessions/:id/stop', stopCallSession); // Both admin and assistant can stop

// Call Session Student routes
router.post('/call-sessions/:id/students', checkRole('admin'), importCallSessionStudents);
router.post('/call-sessions/:id/undo-import', checkRole('admin'), undoImportStudents);
router.post('/call-sessions/:id/start-round-two', checkRole('admin'), startRoundTwo);
router.post('/call-sessions/:id/assign-round-two', assignNextRoundTwoStudent);
router.post('/call-sessions/:id/assign', assignNextStudent); // Assign/Get Next
router.get('/call-sessions/:id/students', getCallSessionStudents); // Both admin and assistant can view
router.put('/call-sessions/students/:studentId', updateCallSessionStudent); // Assistant updates status/comment
router.delete('/call-sessions/students/:studentId', deleteCallSessionStudent); // Allow deleting students (temporarily removed admin check for testing)
router.post('/call-sessions/students/:studentId/remove', deleteCallSessionStudent); // Alternative POST endpoint for removal

// Activity Log routes (Admin only)
router.post('/logs', checkRole('admin'), createActivityLog);
router.get('/logs', checkRole('admin'), getActivityLogs);
router.get('/logs/:id', checkRole('admin'), getActivityLogById);
router.put('/logs/:id', checkRole('admin'), updateActivityLog);
router.delete('/logs/:id', checkRole('admin'), deleteActivityLog);

module.exports = router;


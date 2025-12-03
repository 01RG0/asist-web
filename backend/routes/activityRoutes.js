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

// Activity Log routes (Admin only)
router.post('/logs', checkRole('admin'), createActivityLog);
router.get('/logs', checkRole('admin'), getActivityLogs);
router.get('/logs/:id', checkRole('admin'), getActivityLogById);
router.put('/logs/:id', checkRole('admin'), updateActivityLog);
router.delete('/logs/:id', checkRole('admin'), deleteActivityLog);

module.exports = router;


const express = require('express');
const router = express.Router();
const {
    listBackups,
    createBackup,
    downloadBackup,
    deleteBackup,
    getBackupInfo
} = require('../controllers/backupController');
const authenticateToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// All backup routes require authentication and admin role
router.use(authenticateToken);
router.use(checkRole('admin'));

// GET /api/admin/backups - List all backup files
router.get('/', listBackups);

// POST /api/admin/backups - Create a new backup
router.post('/', createBackup);

// GET /api/admin/backups/:filename - Get backup file information
router.get('/:filename', getBackupInfo);

// GET /api/admin/backups/:filename/download - Download backup file
router.get('/:filename/download', downloadBackup);

// DELETE /api/admin/backups/:filename - Delete backup file
router.delete('/:filename', deleteBackup);

module.exports = router;
const express = require('express');
const router = express.Router();
const {
    listBackups,
    createBackup,
    downloadBackup,
    deleteBackup,
    getBackupInfo,
    listDeletedItems,
    restoreDeletedItem,
    permanentlyDeleteDeletedItem
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

// Deleted Items Routes (Must be before /:filename to avoid conflict)
// GET /api/admin/backups/deleted - List all deleted items
router.get('/deleted', listDeletedItems);

// POST /api/admin/backups/deleted/:id/restore - Restore a deleted item
router.post('/deleted/:id/restore', restoreDeletedItem);

// DELETE /api/admin/backups/deleted/:id - Permanently delete a deleted item backup
router.delete('/deleted/:id', permanentlyDeleteDeletedItem);

// GET /api/admin/backups/:filename - Get backup file information
router.get('/:filename', getBackupInfo);

// GET /api/admin/backups/:filename/download - Download backup file
router.get('/:filename/download', downloadBackup);

// DELETE /api/admin/backups/:filename - Delete backup file
router.delete('/:filename', deleteBackup);

module.exports = router;
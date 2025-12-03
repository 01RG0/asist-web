const DeletedItem = require('../models/DeletedItem');
const { logAuditAction } = require('./auditLogger');

/**
 * Create a backup of an item before deletion
 * @param {String} itemType - Type of item (center, assistant, session, attendance)
 * @param {Object} itemData - The item data to backup
 * @param {String} userId - ID of user performing deletion
 * @param {String} reason - Optional reason for deletion
 * @returns {Promise<Object>} The created backup document
 */
async function createDeletionBackup(itemType, itemData, userId, reason = '') {
    try {
        const backup = await DeletedItem.create({
            item_type: itemType,
            item_id: itemData._id.toString(),
            item_data: itemData,
            deleted_by: userId,
            deletion_reason: reason,
            can_restore: true
        });

        // Log the backup creation
        await logAuditAction(userId, 'CREATE_DELETION_BACKUP', {
            backup_id: backup._id,
            item_type: itemType,
            item_id: itemData._id
        });

        return backup;
    } catch (error) {
        console.error('Error creating deletion backup:', error);
        throw error;
    }
}

/**
 * Restore an item from backup
 * @param {String} backupId - ID of the backup to restore
 * @param {String} userId - ID of user performing restoration
 * @returns {Promise<Object>} The restored item
 */
async function restoreFromBackup(backupId, userId) {
    try {
        const backup = await DeletedItem.findById(backupId);

        if (!backup) {
            throw new Error('Backup not found');
        }

        if (!backup.can_restore) {
            throw new Error('This item cannot be restored');
        }

        // Determine which model to use based on item type
        let Model;
        switch (backup.item_type) {
            case 'center':
                Model = require('../models/Center');
                break;
            case 'assistant':
                Model = require('../models/User');
                break;
            case 'session':
                Model = require('../models/Session');
                break;
            case 'attendance':
                Model = require('../models/Attendance');
                break;
            default:
                throw new Error('Unknown item type');
        }

        // Restore the item
        const restoredItem = await Model.create(backup.item_data);

        // Mark backup as restored (can't restore again)
        backup.can_restore = false;
        await backup.save();

        // Log the restoration
        await logAuditAction(userId, 'RESTORE_FROM_BACKUP', {
            backup_id: backupId,
            item_type: backup.item_type,
            item_id: restoredItem._id
        });

        return restoredItem;
    } catch (error) {
        console.error('Error restoring from backup:', error);
        throw error;
    }
}

/**
 * Permanently delete a backup (cannot be restored)
 * @param {String} backupId - ID of the backup to delete
 * @param {String} userId - ID of user performing deletion
 * @returns {Promise<void>}
 */
async function permanentlyDeleteBackup(backupId, userId) {
    try {
        const backup = await DeletedItem.findByIdAndDelete(backupId);

        if (!backup) {
            throw new Error('Backup not found');
        }

        // Log the permanent deletion
        await logAuditAction(userId, 'PERMANENTLY_DELETE_BACKUP', {
            backup_id: backupId,
            item_type: backup.item_type,
            item_id: backup.item_id
        });

        return backup;
    } catch (error) {
        console.error('Error permanently deleting backup:', error);
        throw error;
    }
}

module.exports = {
    createDeletionBackup,
    restoreFromBackup,
    permanentlyDeleteBackup
};

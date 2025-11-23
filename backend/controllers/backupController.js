const db = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const { logAuditAction } = require('../utils/auditLogger');

/**
 * List all backup files with metadata
 * GET /api/admin/backups
 */
const listBackups = async (req, res) => {
    try {
        const backupDir = path.join(__dirname, '..', 'database', 'backups');

        // Ensure backup directory exists
        try {
            await fs.mkdir(backupDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        // Read backup directory
        const files = await fs.readdir(backupDir);

        // Filter and get file stats
        const backupFiles = [];
        for (const file of files) {
            if (file.endsWith('.sql') || file.endsWith('.zip') || file.endsWith('.gz')) {
                try {
                    const filePath = path.join(backupDir, file);
                    const stats = await fs.stat(filePath);

                    // Parse filename for metadata
                    const fileInfo = parseBackupFilename(file);

                    backupFiles.push({
                        id: file,
                        filename: file,
                        ...fileInfo,
                        size: stats.size,
                        created_at: stats.birthtime,
                        modified_at: stats.mtime
                    });
                } catch (error) {
                    console.warn(`Error reading backup file ${file}:`, error.message);
                }
            }
        }

        // Sort by creation date (newest first)
        backupFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({
            success: true,
            data: backupFiles
        });
    } catch (error) {
        console.error('List backups error:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing backup files'
        });
    }
};

/**
 * Create a new database backup
 * POST /api/admin/backups
 */
const createBackup = async (req, res) => {
    try {
        const { type = 'full', tables = null, description = '' } = req.body;

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '').replace(/-/g, '').replace('T', '_');
        const backupFilename = `backup_${type}_${timestamp}.sql`;
        const backupDir = path.join(__dirname, '..', 'database', 'backups');
        const backupPath = path.join(backupDir, backupFilename);

        // Ensure backup directory exists
        await fs.mkdir(backupDir, { recursive: true });

        // Generate SQL dump
        let sqlContent = `-- Database backup created on ${new Date().toISOString()}\n`;
        sqlContent += `-- Type: ${type}\n`;
        sqlContent += `-- Description: ${description}\n`;
        sqlContent += `-- Created by: ${req.user.name} (${req.user.email})\n\n`;

        // Get all tables or specific tables
        let tablesToBackup = [];
        if (tables && Array.isArray(tables)) {
            tablesToBackup = tables;
        } else {
            // Get all tables from database
            const [tableResults] = await db.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);
            tablesToBackup = tableResults.map(row => row.table_name);
        }

        // Backup each table
        for (const tableName of tablesToBackup) {
            try {
                // Get table structure
                const [structureResult] = await db.query(`SHOW CREATE TABLE \`${tableName}\``);
                if (structureResult.length > 0) {
                    sqlContent += `-- Table structure for ${tableName}\n`;
                    sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
                    sqlContent += structureResult[0]['Create Table'] + ';\n\n';
                }

                // Get table data
                const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);
                if (rows.length > 0) {
                    sqlContent += `-- Data for ${tableName}\n`;
                    for (const row of rows) {
                        const columns = Object.keys(row).map(col => `\`${col}\``).join(', ');
                        const values = Object.values(row).map(val => {
                            if (val === null) return 'NULL';
                            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                            return val;
                        }).join(', ');
                        sqlContent += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
                    }
                    sqlContent += '\n';
                }
            } catch (tableError) {
                console.warn(`Error backing up table ${tableName}:`, tableError.message);
                sqlContent += `-- Error backing up table ${tableName}: ${tableError.message}\n\n`;
            }
        }

        // Write backup file
        await fs.writeFile(backupPath, sqlContent, 'utf8');

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_BACKUP', {
            filename: backupFilename,
            type,
            tables: tablesToBackup,
            size: Buffer.byteLength(sqlContent, 'utf8'),
            description
        });

        res.json({
            success: true,
            message: `Backup created successfully: ${backupFilename}`,
            data: {
                filename: backupFilename,
                type,
                size: Buffer.byteLength(sqlContent, 'utf8'),
                tables: tablesToBackup.length,
                path: backupPath
            }
        });
    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating backup'
        });
    }
};

/**
 * Download a backup file
 * GET /api/admin/backups/:filename/download
 */
const downloadBackup = async (req, res) => {
    try {
        const { filename } = req.params;
        const backupPath = path.join(__dirname, '..', 'database', 'backups', filename);

        // Security check - only allow .sql, .zip, .gz files
        if (!filename.match(/\.(sql|zip|gz)$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type'
            });
        }

        // Check if file exists
        try {
            await fs.access(backupPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'Backup file not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'DOWNLOAD_BACKUP', {
            filename
        });

        // Stream the file
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        const fileStream = require('fs').createReadStream(backupPath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Download backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading backup'
        });
    }
};

/**
 * Delete a backup file
 * DELETE /api/admin/backups/:filename
 */
const deleteBackup = async (req, res) => {
    try {
        const { filename } = req.params;
        const backupPath = path.join(__dirname, '..', 'database', 'backups', filename);

        // Security check
        if (!filename.match(/\.(sql|zip|gz)$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type'
            });
        }

        // Check if file exists
        try {
            await fs.access(backupPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'Backup file not found'
            });
        }

        // Get file size before deletion
        const stats = await fs.stat(backupPath);
        const fileSize = stats.size;

        // Delete the file
        await fs.unlink(backupPath);

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_BACKUP', {
            filename,
            size: fileSize
        });

        res.json({
            success: true,
            message: `Backup deleted successfully: ${filename}`
        });
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting backup'
        });
    }
};

/**
 * Get backup file information
 * GET /api/admin/backups/:filename
 */
const getBackupInfo = async (req, res) => {
    try {
        const { filename } = req.params;
        const backupPath = path.join(__dirname, '..', 'database', 'backups', filename);

        // Security check
        if (!filename.match(/\.(sql|zip|gz)$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type'
            });
        }

        // Get file stats
        const stats = await fs.stat(backupPath);
        const fileInfo = parseBackupFilename(filename);

        res.json({
            success: true,
            data: {
                id: filename,
                filename,
                ...fileInfo,
                size: stats.size,
                created_at: stats.birthtime,
                modified_at: stats.mtime
            }
        });
    } catch (error) {
        console.error('Get backup info error:', error);
        res.status(404).json({
            success: false,
            message: 'Backup file not found'
        });
    }
};

/**
 * Parse backup filename to extract metadata
 */
function parseBackupFilename(filename) {
    const info = {
        type: 'unknown',
        timestamp: null,
        date: null,
        tables: null
    };

    // Parse filename like: backup_full_20251123_225603.sql
    const match = filename.match(/^backup_(\w+)_(\d{8})_(\d{6})\.sql$/);
    if (match) {
        info.type = match[1];
        const dateStr = match[2];
        const timeStr = match[3];

        info.timestamp = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
        info.date = new Date(info.timestamp);
    }

    // Parse attendance backup: attendance_backup_20251123_225603.sql
    const attendanceMatch = filename.match(/^attendance_backup_(\d{8})_(\d{6})\.sql$/);
    if (attendanceMatch) {
        info.type = 'attendance';
        const dateStr = attendanceMatch[1];
        const timeStr = attendanceMatch[2];

        info.timestamp = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
        info.date = new Date(info.timestamp);
    }

    return info;
}

module.exports = {
    listBackups,
    createBackup,
    downloadBackup,
    deleteBackup,
    getBackupInfo
};
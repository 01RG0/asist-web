const AuditLog = require('../models/AuditLog');

/**
 * Log audit action
 * @param {string} userId - MongoDB ObjectId of user performing the action
 * @param {string} action - Action description
 * @param {object} details - Additional details
 * @param {string} ipAddress - Optional IP address
 * @param {string} userAgent - Optional user agent
 */
const logAuditAction = async (userId, action, details = {}, ipAddress = null, userAgent = null) => {
    try {
        // Validate inputs
        if (!userId || !action) {
            console.warn('Audit logging skipped: Missing userId or action');
            return null;
        }

        // Use the static method from AuditLog model
        const log = await AuditLog.logAction(userId, action, details, ipAddress, userAgent);
        return log;
    } catch (error) {
        console.error('Audit logging error:', error.message);
        // Don't throw error to avoid breaking main functionality
        return null;
    }
};

/**
 * Log user login
 */
const logUserLogin = async (userId, email, success = true) => {
    return logAuditAction(userId, success ? 'USER_LOGIN' : 'USER_LOGIN_FAILED', {
        email,
        success,
        timestamp: new Date().toISOString()
    });
};

/**
 * Log user logout
 */
const logUserLogout = async (userId) => {
    return logAuditAction(userId, 'USER_LOGOUT', {
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    logAuditAction,
    logUserLogin,
    logUserLogout
};
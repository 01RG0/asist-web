const ErrorLog = require('../models/ErrorLog');

/**
 * Error Logger Utility
 * Works with Vercel (database-based, not file-based)
 */

/**
 * Log an error to the database
 * @param {Error|string} error - Error object or error message
 * @param {object} context - Additional context information
 * @param {object} req - Express request object (optional)
 * @returns {Promise<ErrorLog|null>} Created error log or null
 */
const logError = async (error, context = {}, req = null) => {
    try {
        let message, stack, level = 'error';

        if (error instanceof Error) {
            message = error.message;
            stack = error.stack;
            // Determine level based on error type
            if (error.name === 'ValidationError') {
                level = 'warning';
            } else if (error.name === 'CastError' || error.name === 'TypeError') {
                level = 'error';
            }
        } else if (typeof error === 'string') {
            message = error;
            stack = null;
        } else {
            message = 'Unknown error';
            stack = null;
        }

        // Extract request information if available
        const errorData = {
            level,
            message: message.substring(0, 1000), // Limit message length
            stack: stack ? stack.substring(0, 5000) : null, // Limit stack length
            context: {
                ...context,
                errorName: error instanceof Error ? error.name : 'String',
                errorType: error instanceof Error ? error.constructor.name : 'String'
            },
            user_id: req?.user?.id || null,
            endpoint: req?.path || req?.url || null,
            method: req?.method || null,
            ip_address: req?.ip || req?.connection?.remoteAddress || null,
            user_agent: req?.get('user-agent') || null
        };

        const errorLog = await ErrorLog.logError(errorData);
        return errorLog;
    } catch (logError) {
        // Don't throw - error logging should not break the main flow
        console.error('Failed to log error to database:', logError);
        return null;
    }
};

/**
 * Log a warning
 * @param {string} message - Warning message
 * @param {object} context - Additional context
 * @param {object} req - Express request object (optional)
 */
const logWarning = async (message, context = {}, req = null) => {
    return await logError(message, { ...context, type: 'warning' }, req);
};

/**
 * Log an info message
 * @param {string} message - Info message
 * @param {object} context - Additional context
 * @param {object} req - Express request object (optional)
 */
const logInfo = async (message, context = {}, req = null) => {
    try {
        const errorData = {
            level: 'info',
            message: message.substring(0, 1000),
            stack: null,
            context,
            user_id: req?.user?.id || null,
            endpoint: req?.path || req?.url || null,
            method: req?.method || null,
            ip_address: req?.ip || req?.connection?.remoteAddress || null,
            user_agent: req?.get('user-agent') || null
        };

        return await ErrorLog.logError(errorData);
    } catch (error) {
        console.error('Failed to log info:', error);
        return null;
    }
};

/**
 * Log a critical error
 * @param {Error|string} error - Error object or message
 * @param {object} context - Additional context
 * @param {object} req - Express request object (optional)
 */
const logCritical = async (error, context = {}, req = null) => {
    try {
        let message, stack;

        if (error instanceof Error) {
            message = error.message;
            stack = error.stack;
        } else {
            message = String(error);
            stack = null;
        }

        const errorData = {
            level: 'critical',
            message: message.substring(0, 1000),
            stack: stack ? stack.substring(0, 5000) : null,
            context: {
                ...context,
                errorName: error instanceof Error ? error.name : 'String',
                errorType: error instanceof Error ? error.constructor.name : 'String'
            },
            user_id: req?.user?.id || null,
            endpoint: req?.path || req?.url || null,
            method: req?.method || null,
            ip_address: req?.ip || req?.connection?.remoteAddress || null,
            user_agent: req?.get('user-agent') || null
        };

        return await ErrorLog.logError(errorData);
    } catch (logError) {
        console.error('Failed to log critical error:', logError);
        return null;
    }
};

module.exports = {
    logError,
    logWarning,
    logInfo,
    logCritical
};


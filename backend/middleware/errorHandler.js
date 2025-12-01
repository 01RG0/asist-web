const { logError } = require('../utils/errorLogger');

/**
 * Global error handler middleware
 * Logs errors and sends appropriate responses
 */
const errorHandler = (err, req, res, next) => {
    // Log the error
    logError(err, {
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params
    }, req).catch(console.error); // Don't let logging errors break the response

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Send error response
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;


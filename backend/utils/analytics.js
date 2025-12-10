/**
 * Server-side Analytics Utilities
 * Handles analytics events received from the frontend
 * Reference: https://vercel.com/docs/analytics
 */

const logger = require('./logger');

/**
 * Process analytics event from frontend
 * @param {object} analyticsData - Data received from frontend
 * @returns {void}
 */
function processAnalyticsEvent(analyticsData) {
    try {
        // Extract event information
        const {
            event,
            action,
            endpoint,
            method,
            duration,
            success,
            timestamp,
            page,
            url,
            ...customProperties
        } = analyticsData;

        // Log analytics event with context
        const logData = {
            event,
            ...(action && { action }),
            ...(endpoint && { endpoint, method, duration, success }),
            page,
            url,
            timestamp,
            customProperties
        };

        // Use appropriate log level based on event type
        if (event === 'error' || (success === false && event === 'api_call')) {
            logger.error(`Analytics Event: ${event}`, logData);
        } else {
            logger.info(`Analytics Event: ${event}`, logData);
        }

        return true;
    } catch (error) {
        logger.error('Error processing analytics data:', error);
        return false;
    }
}

/**
 * Generate analytics summary for monitoring
 * @param {array} events - Array of analytics events
 * @returns {object} Summary object
 */
function generateAnalyticsSummary(events) {
    try {
        const summary = {
            totalEvents: events.length,
            eventsByType: {},
            errorCount: 0,
            successCount: 0,
            apiCallStats: {
                total: 0,
                averageDuration: 0,
                totalDuration: 0
            }
        };

        events.forEach(event => {
            // Count events by type
            summary.eventsByType[event.event] = (summary.eventsByType[event.event] || 0) + 1;

            // Count errors
            if (event.event === 'error' || event.success === false) {
                summary.errorCount++;
            } else {
                summary.successCount++;
            }

            // Calculate API call statistics
            if (event.event === 'api_call') {
                summary.apiCallStats.total++;
                summary.apiCallStats.totalDuration += event.duration || 0;
            }
        });

        // Calculate average duration
        if (summary.apiCallStats.total > 0) {
            summary.apiCallStats.averageDuration = 
                Math.round(summary.apiCallStats.totalDuration / summary.apiCallStats.total);
        }

        return summary;
    } catch (error) {
        logger.error('Error generating analytics summary:', error);
        return null;
    }
}

module.exports = {
    processAnalyticsEvent,
    generateAnalyticsSummary
};

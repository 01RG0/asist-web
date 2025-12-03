const CallSession = require('../models/CallSession');
const ActivityLog = require('../models/ActivityLog');
const moment = require('moment-timezone');
const { getCurrentEgyptTime } = require('./timezone');

/**
 * Check and auto-end call sessions that have passed their end_time
 * This should be called periodically (e.g., every minute)
 */
const checkAndEndSessions = async () => {
    try {
        const now = getCurrentEgyptTime();
        const nowMoment = moment.tz(now, 'Africa/Cairo');

        // Find all active sessions with an end_time that has passed
        const sessionsToEnd = await CallSession.find({
            status: 'active',
            end_time: { $ne: null, $lte: now }
        });

        if (sessionsToEnd.length === 0) {
            return { ended: 0 };
        }

        let endedCount = 0;

        for (const session of sessionsToEnd) {
            // Update session status
            session.status = 'completed';
            await session.save();

            // Update all related activity logs that are still ongoing
            const activityLogs = await ActivityLog.find({
                call_session_id: session._id,
                end_time: null
            });

            for (const log of activityLogs) {
                log.end_time = session.end_time;
                // Calculate duration
                if (log.start_time) {
                    const durationMs = session.end_time.getTime() - log.start_time.getTime();
                    log.duration_minutes = Math.round(durationMs / (1000 * 60));
                }
                await log.save();
            }

            endedCount++;
        }

        if (endedCount > 0) {
            console.log(`✅ Auto-ended ${endedCount} call session(s) that reached their end time`);
        }

        return { ended: endedCount };
    } catch (error) {
        console.error('Error checking and ending call sessions:', error);
        return { ended: 0, error: error.message };
    }
};

/**
 * Initialize the call session auto-end checker
 * This should be called after database connection is established
 * Runs every minute to check for sessions that need to be ended
 */
const initializeCallSessionChecker = (cron) => {
    // Run every minute
    const cronJob = cron.schedule('* * * * *', async () => {
        await checkAndEndSessions();
    }, {
        scheduled: true,
        timezone: 'Africa/Cairo'
    });

    console.log('✅ Call session auto-end checker initialized (runs every minute)');
    return cronJob;
};

module.exports = {
    checkAndEndSessions,
    initializeCallSessionChecker
};

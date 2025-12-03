const { generateWhatsAppRecordsForDate } = require('../controllers/activityController');
const moment = require('moment-timezone');
const { getCurrentEgyptTime } = require('./timezone');
const { logError } = require('./errorLogger');

/**
 * Generate WhatsApp records for all days of the week
 * This function is called by the cron job daily
 * It generates records for the current week (today + next 6 days)
 */
const generateWeeklyWhatsAppRecords = async () => {
    try {
        const now = getCurrentEgyptTime();
        const today = moment.tz(now, 'Africa/Cairo').startOf('day');

        // Generate records for the next 7 days (current week)
        for (let i = 0; i < 7; i++) {
            const targetDate = today.clone().add(i, 'days');
            await generateWhatsAppRecordsForDate(targetDate.toDate());
        }

        console.log('✅ WhatsApp records generated for all days of the week');
        return true;
    } catch (error) {
        console.error('❌ Error generating WhatsApp records:', error);
        await logError(null, 'WHATSAPP_SCHEDULER_CRON', error);
        return false;
    }
};

/**
 * Initialize the WhatsApp scheduler cron job
 * This should be called after database connection is established
 */
const initializeWhatsAppScheduler = (cron) => {
    // Run daily at 1 AM Egypt time
    // Cron format: minute hour day month dayOfWeek
    // Using timezone option to run in Egypt timezone
    const cronJob = cron.schedule('0 1 * * *', async () => {
        console.log('🕐 Running WhatsApp scheduler cron job...');
        await generateWeeklyWhatsAppRecords();
    }, {
        scheduled: true,
        timezone: 'Africa/Cairo'
    });

    console.log('✅ WhatsApp scheduler initialized (runs daily at 1 AM Egypt time)');
    return cronJob;
};

module.exports = {
    generateWeeklyWhatsAppRecords,
    initializeWhatsAppScheduler
};


const { generateWhatsAppRecordsForDate } = require('../controllers/activityController');
const moment = require('moment-timezone');
const { getCurrentEgyptTime } = require('./timezone');
const { logError } = require('./errorLogger');

/**
 * Generate WhatsApp records for today only
 * This function is called by the cron job daily
 * It generates records for the current day only
 */
const generateDailyWhatsAppRecords = async () => {
    try {
        const now = getCurrentEgyptTime();
        const today = moment.tz(now, 'Africa/Cairo').startOf('day');

        // Generate records for today only
        await generateWhatsAppRecordsForDate(today.toDate());

        console.log('✅ WhatsApp records generated for today');
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
    // Run daily at 12 PM (noon) Egypt time
    // Cron format: minute hour day month dayOfWeek
    // 0 12 * * * = 12:00 PM every day
    // Using timezone option to run in Egypt timezone
    const cronJob = cron.schedule('0 12 * * *', async () => {
        console.log('🕐 Running WhatsApp scheduler cron job at 12 PM Egypt time...');
        await generateDailyWhatsAppRecords();
    }, {
        scheduled: true,
        timezone: 'Africa/Cairo'
    });

    console.log('✅ WhatsApp scheduler initialized (runs daily at 12 PM Egypt time)');
    return cronJob;
};

module.exports = {
    generateWeeklyWhatsAppRecords,
    initializeWhatsAppScheduler
};


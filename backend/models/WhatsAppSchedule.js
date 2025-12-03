const mongoose = require('mongoose');

/**
 * WhatsApp Schedule Schema
 * Stores weekly recurring schedules for WhatsApp shifts (auto-recorded)
 */
const whatsAppScheduleSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required']
    },
    day_of_week: {
        type: Number,
        required: [true, 'Day of week is required'],
        min: 1,
        max: 7,
        validate: {
            validator: function (v) {
                return v >= 1 && v <= 7;
            },
            message: 'Day of week must be between 1 (Monday) and 7 (Sunday)'
        }
    },
    start_time: {
        type: String,
        required: [true, 'Start time is required'],
        match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format']
    },
    end_time: {
        type: String,
        required: [true, 'End time is required'],
        match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:mm format']
    },
    is_active: {
        type: Boolean,
        default: true
    },
    recurrence_type: {
        type: String,
        enum: ['weekly'],
        default: 'weekly'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
whatsAppScheduleSchema.index({ user_id: 1, day_of_week: 1 });
whatsAppScheduleSchema.index({ is_active: 1 });
whatsAppScheduleSchema.index({ day_of_week: 1 });

// Virtual field for populated user data
whatsAppScheduleSchema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
});

// Validate that start_time and end_time are not the same
whatsAppScheduleSchema.pre('save', function (next) {
    if (this.start_time && this.end_time) {
        if (this.start_time === this.end_time) {
            return next(new Error('Start time and end time cannot be the same'));
        }
        // Note: We allow end_time < start_time to support overnight shifts
    }
    next();
});

const WhatsAppSchedule = mongoose.model('WhatsAppSchedule', whatsAppScheduleSchema);

module.exports = WhatsAppSchedule;


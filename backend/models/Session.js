const mongoose = require('mongoose');

/**
 * Session Schema
 * Teaching sessions - can be one-time or weekly recurring
 */
const sessionSchema = new mongoose.Schema({
    assistant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Optional - for pre-assigned sessions
    },
    center_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Center',
        required: [true, 'Center is required']
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true,
        maxlength: [150, 'Subject cannot exceed 150 characters']
    },
    start_time: {
        type: Date,
        required: [true, 'Start time is required']
    },
    recurrence_type: {
        type: String,
        enum: ['one_time', 'weekly'],
        default: 'one_time'
    },
    day_of_week: {
        type: Number,
        min: 1,
        max: 7,
        default: null,
        validate: {
            validator: function (v) {
                // day_of_week is required for weekly sessions
                if (this.recurrence_type === 'weekly') {
                    return v !== null && v >= 1 && v <= 7;
                }
                return true;
            },
            message: 'Day of week (1-7) is required for weekly sessions'
        }
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
sessionSchema.index({ assistant_id: 1, start_time: -1 });
sessionSchema.index({ center_id: 1, start_time: -1 });
sessionSchema.index({ start_time: -1 });
sessionSchema.index({ recurrence_type: 1, is_active: 1 });
sessionSchema.index({ day_of_week: 1 });

// Virtual fields for populated data
sessionSchema.virtual('assistant', {
    ref: 'User',
    localField: 'assistant_id',
    foreignField: '_id',
    justOne: true
});

sessionSchema.virtual('center', {
    ref: 'Center',
    localField: 'center_id',
    foreignField: '_id',
    justOne: true
});

// Method to check if session is upcoming
sessionSchema.methods.isUpcoming = function () {
    return this.start_time > new Date();
};

// Method to get the next occurrence for weekly sessions
sessionSchema.methods.getNextOccurrence = function () {
    if (this.recurrence_type !== 'weekly') {
        return this.start_time;
    }

    const now = new Date();
    const sessionDate = new Date(this.start_time);

    // Calculate days until next occurrence
    let daysUntilNext = this.day_of_week - now.getDay();
    if (daysUntilNext <= 0) {
        daysUntilNext += 7;
    }

    const nextOccurrence = new Date(now);
    nextOccurrence.setDate(now.getDate() + daysUntilNext);
    nextOccurrence.setHours(sessionDate.getHours());
    nextOccurrence.setMinutes(sessionDate.getMinutes());
    nextOccurrence.setSeconds(0);

    return nextOccurrence;
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;

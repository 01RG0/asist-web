const mongoose = require('mongoose');

/**
 * Activity Log Schema
 * Stores historical records for WhatsApp and Call activities
 */
const activityLogSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required']
    },
    type: {
        type: String,
        enum: ['whatsapp', 'call'],
        required: [true, 'Activity type is required']
    },
    start_time: {
        type: Date,
        required: [true, 'Start time is required']
    },
    end_time: {
        type: Date,
        default: null
    },
    duration_minutes: {
        type: Number,
        default: 0,
        min: [0, 'Duration cannot be negative']
    },
    call_session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CallSession',
        default: null
    },
    whatsapp_schedule_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WhatsAppSchedule',
        default: null
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    // Soft delete fields
    is_deleted: {
        type: Boolean,
        default: false
    },
    deleted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deleted_at: {
        type: Date,
        default: null
    },
    deletion_reason: {
        type: String,
        trim: true,
        maxlength: [200, 'Deletion reason cannot exceed 200 characters']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
activityLogSchema.index({ user_id: 1, start_time: -1 });
activityLogSchema.index({ type: 1 });
activityLogSchema.index({ start_time: -1 });
activityLogSchema.index({ is_deleted: 1 });
activityLogSchema.index({ call_session_id: 1 });
activityLogSchema.index({ whatsapp_schedule_id: 1 });

// Pre-save middleware to calculate duration
activityLogSchema.pre('save', function (next) {
    if (this.start_time && this.end_time) {
        const durationMs = this.end_time.getTime() - this.start_time.getTime();
        this.duration_minutes = Math.round(durationMs / (1000 * 60));
    } else {
        this.duration_minutes = 0;
    }
    next();
});

// Virtual fields for populated data
activityLogSchema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
});

activityLogSchema.virtual('call_session', {
    ref: 'CallSession',
    localField: 'call_session_id',
    foreignField: '_id',
    justOne: true
});

activityLogSchema.virtual('whatsapp_schedule', {
    ref: 'WhatsAppSchedule',
    localField: 'whatsapp_schedule_id',
    foreignField: '_id',
    justOne: true
});

// Method to check if activity is ongoing
activityLogSchema.methods.isOngoing = function () {
    return this.end_time === null;
};

// Method to format duration as human-readable string
activityLogSchema.methods.getDurationString = function () {
    if (this.duration_minutes === 0) {
        return '0 minutes';
    } else if (this.duration_minutes < 60) {
        return `${this.duration_minutes} minutes`;
    } else {
        const hours = Math.floor(this.duration_minutes / 60);
        const minutes = this.duration_minutes % 60;
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;


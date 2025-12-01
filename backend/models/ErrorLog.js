const mongoose = require('mongoose');

/**
 * ErrorLog Schema
 * Stores application errors for debugging and monitoring
 * Works with Vercel (database-based, not file-based)
 */
const errorLogSchema = new mongoose.Schema({
    level: {
        type: String,
        enum: ['error', 'warning', 'info', 'critical'],
        default: 'error',
        required: true
    },
    message: {
        type: String,
        required: [true, 'Error message is required'],
        trim: true
    },
    stack: {
        type: String,
        default: null
    },
    context: {
        type: mongoose.Schema.Types.Mixed, // Flexible JSON object for additional context
        default: {}
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Optional - may not have user context
    },
    endpoint: {
        type: String,
        trim: true,
        default: null
    },
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', null],
        default: null
    },
    ip_address: {
        type: String,
        trim: true,
        default: null
    },
    user_agent: {
        type: String,
        trim: true,
        default: null
    },
    resolved: {
        type: Boolean,
        default: false
    },
    resolved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    resolved_at: {
        type: Date,
        default: null
    },
    resolution_notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Resolution notes cannot exceed 500 characters'],
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    timestamps: false, // We're using custom timestamp field
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
errorLogSchema.index({ timestamp: -1 });
errorLogSchema.index({ level: 1, timestamp: -1 });
errorLogSchema.index({ resolved: 1, timestamp: -1 });
errorLogSchema.index({ user_id: 1, timestamp: -1 });
errorLogSchema.index({ endpoint: 1, timestamp: -1 });

// Virtual field for user
errorLogSchema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
});

// Virtual field for resolved by user
errorLogSchema.virtual('resolver', {
    ref: 'User',
    localField: 'resolved_by',
    foreignField: '_id',
    justOne: true
});

// Static method to log an error
errorLogSchema.statics.logError = async function (errorData) {
    try {
        const {
            level = 'error',
            message,
            stack = null,
            context = {},
            user_id = null,
            endpoint = null,
            method = null,
            ip_address = null,
            user_agent = null
        } = errorData;

        if (!message) {
            console.warn('Error logging skipped: Missing error message');
            return null;
        }

        const log = new this({
            level,
            message: message.substring(0, 1000), // Limit message length
            stack: stack ? stack.substring(0, 5000) : null, // Limit stack length
            context,
            user_id,
            endpoint,
            method,
            ip_address,
            user_agent
        });

        await log.save();
        return log;
    } catch (error) {
        console.error('Error creating error log:', error);
        // Don't throw - error logging should not break the main flow
        return null;
    }
};

// Method to mark error as resolved
errorLogSchema.methods.markResolved = async function (resolvedBy, notes = null) {
    this.resolved = true;
    this.resolved_by = resolvedBy;
    this.resolved_at = new Date();
    this.resolution_notes = notes;
    await this.save();
    return this;
};

// Method to format log entry as readable string
errorLogSchema.methods.toString = function () {
    const timestamp = this.timestamp.toISOString();
    const context = Object.keys(this.context).length > 0
        ? JSON.stringify(this.context)
        : 'No context';
    return `[${timestamp}] [${this.level.toUpperCase()}] ${this.message} - ${context}`;
};

const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);

module.exports = ErrorLog;


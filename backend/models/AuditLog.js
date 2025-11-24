const mongoose = require('mongoose');

/**
 * AuditLog Schema
 * Tracks admin actions and system events for accountability
 */
const auditLogSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    action: {
        type: String,
        required: [true, 'Action is required'],
        trim: true,
        maxlength: [100, 'Action cannot exceed 100 characters']
    },
    details: {
        type: mongoose.Schema.Types.Mixed, // Flexible JSON object
        default: {}
    },
    ip_address: {
        type: String,
        trim: true
    },
    user_agent: {
        type: String,
        trim: true
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
auditLogSchema.index({ user_id: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Virtual field for user
auditLogSchema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
});

// Static method to log an action
auditLogSchema.statics.logAction = async function (userId, action, details = {}, ipAddress = null, userAgent = null) {
    try {
        const log = new this({
            user_id: userId,
            action,
            details,
            ip_address: ipAddress,
            user_agent: userAgent
        });
        await log.save();
        return log;
    } catch (error) {
        console.error('Error creating audit log:', error);
        // Don't throw - audit logging should not break the main flow
        return null;
    }
};

// Method to format log entry as readable string
auditLogSchema.methods.toString = function () {
    const timestamp = this.timestamp.toISOString();
    const details = Object.keys(this.details).length > 0
        ? JSON.stringify(this.details)
        : 'No details';
    return `[${timestamp}] User ${this.user_id}: ${this.action} - ${details}`;
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;

const mongoose = require('mongoose');

/**
 * Call Session Schema
 * Defines available call blocks that assistants can start/stop
 */
const callSessionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [150, 'Name cannot exceed 150 characters']
    },
    date: {
        type: Date,
        required: [true, 'Date is required']
    },
    start_time: {
        type: String,
        required: [true, 'Start time is required'],
        match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format']
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed'],
        default: 'pending'
    },
    assistant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assistants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    end_time: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
callSessionSchema.index({ date: 1, status: 1 });
callSessionSchema.index({ assistant_id: 1 });
callSessionSchema.index({ assistants: 1 });
callSessionSchema.index({ status: 1 });

// Virtual fields for populated data
callSessionSchema.virtual('assistant', {
    ref: 'User',
    localField: 'assistant_id',
    foreignField: '_id',
    justOne: true
});

callSessionSchema.virtual('assistants_list', {
    ref: 'User',
    localField: 'assistants',
    foreignField: '_id',
    justOne: false
});

// Method to check if session is active
callSessionSchema.methods.isActive = function () {
    return this.status === 'active';
};

// Method to check if session is completed
callSessionSchema.methods.isCompleted = function () {
    return this.status === 'completed';
};

const CallSession = mongoose.model('CallSession', callSessionSchema);

module.exports = CallSession;


const mongoose = require('mongoose');

const deletedItemSchema = new mongoose.Schema({
    item_type: {
        type: String,
        required: true,
        enum: ['center', 'assistant', 'session', 'attendance']
    },
    item_id: {
        type: String,
        required: true
    },
    item_data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    deleted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    deleted_at: {
        type: Date,
        default: Date.now
    },
    deletion_reason: {
        type: String,
        default: ''
    },
    can_restore: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
deletedItemSchema.index({ item_type: 1, deleted_at: -1 });
deletedItemSchema.index({ item_id: 1 });

module.exports = mongoose.model('DeletedItem', deletedItemSchema);

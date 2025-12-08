const mongoose = require('mongoose');

const callSessionStudentSchema = new mongoose.Schema({
    call_session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CallSession',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    student_phone: {
        type: String,
        default: ''
    },
    parent_phone: {
        type: String,
        default: ''
    },
    student_id: {
        type: String,
        default: ''
    },
    center: {
        type: String,
        default: ''
    },
    exam_mark: {
        type: mongoose.Schema.Types.Mixed, // Can be number or string
        default: null
    },
    attendance_status: {
        type: String,
        default: ''
    },
    homework_status: {
        type: String,
        default: ''
    },
    filter_status: {
        type: String,
        enum: ['', 'wrong-number', 'no-answer', 'online-makeup', 'left-teacher', 'other-makeup'],
        default: ''
    },
    comments: [{
        text: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        author: String
    }],
    how_many: {
        type: Boolean,
        default: false
    },
    total_test: {
        type: Boolean,
        default: false
    },
    last_called_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assigned_to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assigned_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CallSessionStudent', callSessionStudentSchema);

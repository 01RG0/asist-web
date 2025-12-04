const mongoose = require('mongoose');

/**
 * Attendance Schema
 * Records of attendance with GPS validation
 */
const attendanceSchema = new mongoose.Schema({
    assistant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Assistant is required']
    },
    session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        default: null // Optional when call_session_id is present
    },
    call_session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CallSession',
        default: null // Optional when session_id is present
    },
    session_subject: {
        type: String,
        trim: true,
        maxlength: [150, 'Session subject cannot exceed 150 characters'],
        default: null // Optional for backward compatibility
    },
    center_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Center',
        default: null // Optional for call sessions
    },
    latitude: {
        type: Number,
        default: null, // Optional for call sessions
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
        type: Number,
        default: null, // Optional for call sessions
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
    },
    time_recorded: {
        type: Date,
        default: Date.now,
        required: true
    },
    delay_minutes: {
        type: Number,
        default: 0,
        min: [0, 'Delay cannot be negative']
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
    },
    // Optional: Location in GeoJSON format
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number] // [longitude, latitude]
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Validation: session_id or call_session_id can be null (for WhatsApp/other activities)
attendanceSchema.pre('validate', function (next) {
    // Cannot have both session_id and call_session_id
    if (this.session_id && this.call_session_id) {
        this.invalidate('session_id', 'Cannot have both session_id and call_session_id');
        this.invalidate('call_session_id', 'Cannot have both session_id and call_session_id');
    }
    // For regular sessions (session_id present), GPS and center are required
    if (this.session_id && (!this.latitude || !this.longitude || !this.center_id)) {
        if (!this.latitude) this.invalidate('latitude', 'Latitude is required for regular sessions');
        if (!this.longitude) this.invalidate('longitude', 'Longitude is required for regular sessions');
        if (!this.center_id) this.invalidate('center_id', 'Center is required for regular sessions');
    }
    // For call sessions and WhatsApp, GPS is optional
    next();
});

// Unique constraint strategy:
// - For one-time sessions: enforced at controller level (check before save)
// - For weekly sessions: allow multiple records, enforced via daily date check in controller
// - For call_sessions: one record per assistant
// 
// Note: We removed the strict unique index to allow weekly session flexibility.
// Duplicate prevention is handled in the controller layer with proper date-based checks.
attendanceSchema.index({ assistant_id: 1, call_session_id: 1 }, { 
    unique: true, 
    partialFilterExpression: { call_session_id: { $ne: null } }
});

// Indexes for quick lookups during duplicate checking
attendanceSchema.index({ assistant_id: 1, session_id: 1 });
attendanceSchema.index({ assistant_id: 1, session_id: 1, time_recorded: -1 });

// Indexes for performance
attendanceSchema.index({ session_id: 1 });
attendanceSchema.index({ call_session_id: 1 });
attendanceSchema.index({ assistant_id: 1 });
attendanceSchema.index({ center_id: 1 });
attendanceSchema.index({ time_recorded: -1 });
attendanceSchema.index({ delay_minutes: 1 });

// Pre-save middleware to sync location with latitude/longitude
attendanceSchema.pre('save', function (next) {
    if (this.latitude && this.longitude) {
        this.location = {
            type: 'Point',
            coordinates: [this.longitude, this.latitude]
        };
    }
    next();
});

// Virtual fields for populated data
attendanceSchema.virtual('assistant', {
    ref: 'User',
    localField: 'assistant_id',
    foreignField: '_id',
    justOne: true
});

attendanceSchema.virtual('session', {
    ref: 'Session',
    localField: 'session_id',
    foreignField: '_id',
    justOne: true
});

attendanceSchema.virtual('call_session', {
    ref: 'CallSession',
    localField: 'call_session_id',
    foreignField: '_id',
    justOne: true
});

attendanceSchema.virtual('center', {
    ref: 'Center',
    localField: 'center_id',
    foreignField: '_id',
    justOne: true
});

// Method to check if attendance was on time
attendanceSchema.methods.isOnTime = function () {
    return this.delay_minutes === 0;
};

// Method to format delay as human-readable string
attendanceSchema.methods.getDelayString = function () {
    if (this.delay_minutes === 0) {
        return 'On time';
    } else if (this.delay_minutes < 0) {
        return `Early by ${Math.abs(this.delay_minutes)} minutes`;
    } else {
        return `Late by ${this.delay_minutes} minutes`;
    }
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;

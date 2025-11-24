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
        required: [true, 'Session is required']
    },
    center_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Center',
        required: [true, 'Center is required']
    },
    latitude: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
        type: Number,
        required: [true, 'Longitude is required'],
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

// Unique constraint: one attendance record per assistant per session
attendanceSchema.index({ assistant_id: 1, session_id: 1 }, { unique: true });

// Indexes for performance
attendanceSchema.index({ session_id: 1 });
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

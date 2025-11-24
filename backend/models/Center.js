const mongoose = require('mongoose');

/**
 * Center Schema
 * Educational centers with GPS coordinates for attendance validation
 */
const centerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Center name is required'],
        trim: true,
        maxlength: [150, 'Center name cannot exceed 150 characters']
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
    radius_m: {
        type: Number,
        default: 30,
        min: [1, 'Radius must be at least 1 meter'],
        max: [500, 'Radius cannot exceed 500 meters']
    },
    address: {
        type: String,
        trim: true,
        maxlength: [255, 'Address cannot exceed 255 characters']
    },
    // Optional: GeoJSON format for advanced geospatial queries
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere'
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
centerSchema.index({ name: 1 });
centerSchema.index({ location: '2dsphere' }); // For geospatial queries

// Pre-save middleware to sync location with latitude/longitude
centerSchema.pre('save', function (next) {
    if (this.latitude && this.longitude) {
        this.location = {
            type: 'Point',
            coordinates: [this.longitude, this.latitude]
        };
    }
    next();
});

// Virtual field to get assigned assistants
centerSchema.virtual('assistants', {
    ref: 'User',
    localField: '_id',
    foreignField: 'assignedCenters'
});

// Method to check if coordinates are within radius
centerSchema.methods.isWithinRadius = function (lat, lon) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = this.latitude * Math.PI / 180;
    const φ2 = lat * Math.PI / 180;
    const Δφ = (lat - this.latitude) * Math.PI / 180;
    const Δλ = (lon - this.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    return distance <= this.radius_m;
};

const Center = mongoose.model('Center', centerSchema);

module.exports = Center;

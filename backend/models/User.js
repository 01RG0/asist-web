const mongoose = require('mongoose');

/**
 * User Schema
 * Stores both admins and assistants
 */
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        maxlength: [150, 'Email cannot exceed 150 characters'],
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password_hash: {
        type: String,
        required: [true, 'Password hash is required']
    },
    role: {
        type: String,
        enum: ['admin', 'assistant'],
        default: 'assistant',
        required: true
    },
    // Array of center IDs this assistant is assigned to
    // For assistants only - admins have access to all centers
    assignedCenters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Center'
    }]
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ assignedCenters: 1 });

// Virtual field to get centers (for population)
userSchema.virtual('centers', {
    ref: 'Center',
    localField: 'assignedCenters',
    foreignField: '_id'
});

// Method to check if user has access to a specific center
userSchema.methods.hasAccessToCenter = function (centerId) {
    if (this.role === 'admin') {
        return true; // Admins have access to all centers
    }
    return this.assignedCenters.some(id => id.toString() === centerId.toString());
};

// Don't return password hash in JSON responses
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password_hash;
    delete obj.__v;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

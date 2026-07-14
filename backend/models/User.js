const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String, // Optional if using Google Sign-In only
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allow multiple nulls if not using Google
    },
    role: {
        type: String,
        enum: ['passenger', 'driver', 'admin'],
        default: 'passenger',
    },
    phone: {
        type: String,
    },
    profileImage: {
        type: String,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number],
            default: [0, 0], // [Longitude, Latitude]
        },
    },
    address: {
        type: String, // Human readable address
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isOnline: {
        type: Boolean,
        default: false,
    },
    themePreference: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
    },
    vehicle: {
        model: String,
        year: String,
        licensePlate: String,
        color: String,
    },
    walletBalance: {
        type: Number,
        default: 0,
    },
    paymentMethods: [{
        type: { type: String, enum: ['card', 'mobile_money'], default: 'mobile_money' },
        number: String, // Masked or tokenized in real app
        provider: String, // e.g., MTN, Airtel, Visa
    }],
    tin: {
        type: String,
    },
}, {
    timestamps: true,
});

// Create 2dsphere index for geospatial queries
userSchema.index({ location: '2dsphere' });

// Password hashing middleware
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Password match method
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

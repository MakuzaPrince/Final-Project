const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    passenger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    passengerName: {
        type: String,
        required: true,
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    driverName: {
        type: String,
    },
    pickupLocation: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
        },
        address: String,
    },
    destinationLocation: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
        },
        address: String,
    },
    distanceKm: {
        type: Number,
        required: true,
    },
    estimatedTime: {
        type: String,
    },
    baseFare: {
        type: Number,
        required: true,
    },
    taxAmount: {
        type: Number,
        required: true,
    },
    totalFare: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['searching', 'accepted', 'arrived', 'ongoing', 'completed', 'cancelled'],
        default: 'searching',
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'pending', 'paid', 'failed'],
        default: 'unpaid',
    },
    paymentRef: {
        type: String,
    },
    startedAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
    },
    category: {
        type: String,
        enum: ['ride', 'system', 'message'],
        default: 'system'
    },
    metadata: {
        rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        link: String, // To direct to specific pages like /driver/live-map
        additionalData: mongoose.Schema.Types.Mixed
    },
    read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notification', notificationSchema);

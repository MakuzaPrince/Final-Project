const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['technical', 'billing', 'driver', 'passenger', 'ride', 'other'],
        default: 'other'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    // Optional linked ride
    rideId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride',
        default: null
    },
    // Admin response
    adminResponse: {
        type: String,
        default: ''
    },
    respondedAt: {
        type: Date
    },
    respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);

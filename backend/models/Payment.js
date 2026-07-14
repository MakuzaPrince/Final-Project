const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    passenger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'successful', 'failed'],
        default: 'pending',
    },
    paypackRef: {
        type: String,
        required: true,
        unique: true,
    },
}, {
    timestamps: true,
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

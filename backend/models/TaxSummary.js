const mongoose = require('mongoose');

const taxSummarySchema = new mongoose.Schema({
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    month: {
        type: String, // Format: "YYYY-MM"
        required: true,
    },
    totalRides: {
        type: Number,
        default: 0,
    },
    totalTax: {
        type: Number,
        default: 0,
    },
    totalEarnings: {
        type: Number,
        default: 0,
    },
    netIncome: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Compound index to ensure unique monthly record per driver
taxSummarySchema.index({ driver: 1, month: 1 }, { unique: true });

const TaxSummary = mongoose.model('TaxSummary', taxSummarySchema);

module.exports = TaxSummary;

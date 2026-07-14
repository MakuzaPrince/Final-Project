const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get wallet balance
// @route   GET /api/wallet
router.get('/', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ balance: user.walletBalance, paymentMethods: user.paymentMethods });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Add payment method
// @route   POST /api/wallet/method
router.post('/method', protect, async (req, res) => {
    const { type, number, provider } = req.body;
    try {
        const user = await User.findById(req.user.id);
        user.paymentMethods.push({ type, number, provider });
        await user.save();
        res.json(user.paymentMethods);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;

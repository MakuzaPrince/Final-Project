const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all users (excluding admins)
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, async (req, res) => {
    try {
        // Ensure the requester is an admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as an admin' });
        }

        // Fetch all users except admins
        const users = await User.find({ role: { $ne: 'admin' } }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.fullName = req.body.fullName || user.fullName;
            user.phone = req.body.phone || user.phone;
            user.address = req.body.address || user.address;
            user.profileImage = req.body.profileImage || user.profileImage;
            user.tin = req.body.tin !== undefined ? req.body.tin : user.tin;

            // If driver, update vehicle
            if (user.role === 'driver' && req.body.vehicle) {
                user.vehicle = {
                    model: req.body.vehicle.model || user.vehicle?.model,
                    year: req.body.vehicle.year || user.vehicle?.year,
                    licensePlate: req.body.vehicle.licensePlate || user.vehicle?.licensePlate,
                    color: req.body.vehicle.color || user.vehicle?.color
                };
            }

            const updatedUser = await user.save();

            // Trigger System Notification
            const { createNotification } = require('../services/notificationService');
            // Note: io is not available here, so we only save to DB. 
            // Frontend will fetch it on page load or refresh.
            await createNotification(null, {
                recipient: updatedUser._id,
                title: 'Profile Updated',
                message: 'Your profile information has been successfully updated.',
                type: 'success',
                category: 'system'
            });

            res.json({
                _id: updatedUser._id,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                role: updatedUser.role,
                phone: updatedUser.phone,
                address: updatedUser.address,
                vehicle: updatedUser.vehicle,
                profileImage: updatedUser.profileImage,
                tin: updatedUser.tin,
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (user && (await user.matchPassword(currentPassword))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(400).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Helper to generate token (duplicate from authRoutes, ideally shared)
const jwt = require('jsonwebtoken');
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

module.exports = router;

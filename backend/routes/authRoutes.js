const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// Generate JWT — 90 days so users aren't kicked out mid-session
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '90d',
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    const { fullName, email, password, role, phone, vehicle, profileImage } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Vehicle info will be added later in profile

        const user = await User.create({
            fullName,
            email,
            password,
            role,
            phone,
            vehicle: role === 'driver' ? vehicle : undefined,
            profileImage,
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address,
                vehicle: user.vehicle,
                profileImage: user.profileImage,
                token: generateToken(user._id),
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (user.isActive === false) {
            return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
        }

        res.json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            phone: user.phone,
            address: user.address,
            vehicle: user.vehicle,
            profileImage: user.profileImage,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Google Login (Simplified for now - assumes token verified on frontend or separately)
// In production, verify Firebase token here.
router.post('/google-login', async (req, res) => {
    const { email, googleId, fullName, profileImage, role } = req.body;

    try {
        let user = await User.findOne({ email });

        if (user) {
            if (user.isActive === false) {
                return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
            }
            // Update googleId if missing
            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }
            return res.json({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address,
                vehicle: user.vehicle,
                profileImage: user.profileImage,
                token: generateToken(user._id),
            });
        }

        // Create new user
        user = await User.create({
            fullName,
            email,
            googleId,
            profileImage,
            role: role || 'passenger', // Default to passenger if not specified
        });

        res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            phone: user.phone,
            address: user.address,
            vehicle: user.vehicle,
            profileImage: user.profileImage,
            token: generateToken(user._id),
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

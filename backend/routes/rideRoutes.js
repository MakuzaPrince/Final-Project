const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const { calculateFare } = require('../services/fareCalculator');
const User = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Get all rides (Admin only)
// @route   GET /api/rides/all
router.get('/all', protect, admin, async (req, res) => {
    try {
        const rides = await Ride.find({})
            .populate('passenger', 'fullName email')
            .populate('driver', 'fullName email')
            .sort({ createdAt: -1 });
        res.json(rides);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Middleware to protect routes (Basic implementation)

// @desc    Get user's ride history (match by ID OR name)
// @route   GET /api/rides/history
// @access  Private
router.get('/history', protect, async (req, res) => {
    try {
        console.log("HISTORY ROUTE HIT");
        console.log("User ID:", req.user._id);
        console.log("User Name:", req.user.fullName);

        const userId = req.user._id;
        const userFullName = req.user.fullName;

        // Match rides where:
        // - User is stored by ObjectId (driver/passenger)
        // OR
        // - User is stored by name (driverName/passengerName)
        const query = {
            $or: [
                { passenger: userId },
                { driver: userId }
            ]
        };

        console.log("HISTORY QUERY:", query);

        const rides = await Ride.find(query)
            .populate('passenger', 'fullName email phone profileImage')
            .populate('driver', 'fullName email phone profileImage vehicle')
            .sort({ createdAt: -1 });

        console.log("HISTORY FOUND RIDES:", rides.length);

        res.json(rides);
    } catch (error) {
        console.error("HISTORY ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Request a ride
// @route   POST /api/rides/request
router.post('/request', protect, async (req, res) => {
    const { pickup, destination, distanceKm } = req.body;
    const passengerId = req.user._id;

    try {
        // Block if passenger already has an active ride
        const existing = await Ride.findOne({
            passenger: passengerId,
            status: { $in: ['searching', 'pending', 'accepted', 'ongoing'] }
        });
        if (existing) {
            return res.status(409).json({
                message: 'You already have an active ride. Please complete or cancel it before requesting a new one.',
                rideId: existing._id,
                status: existing.status
            });
        }

        const { baseFare, taxAmount, totalFare } = calculateFare(distanceKm);

        const ride = await Ride.create({
            passenger: passengerId,
            passengerName: req.user.fullName,
            pickupLocation: pickup,
            destinationLocation: destination,
            distanceKm,
            baseFare,
            taxAmount,
            totalFare,
            status: 'searching',
        });

        res.status(201).json(ride);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get nearby available rides (for drivers)
// @route   GET /api/rides/available
router.post('/available', protect, async (req, res) => {
    // Geospatial query to find rides with 'searching' status near driver
    // For now, return all searching rides
    try {
        const rides = await Ride.find({ status: 'searching' }).populate('passenger', 'fullName profileImage rating');
        res.json(rides);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Accept/Update ride status
// @route   PUT /api/rides/:id/status
router.put('/:id/status', protect, async (req, res) => {
    const { status, driverId } = req.body;
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        // Block driver from accepting if they already have an active ride
        if (status === 'accepted' && req.user?.role === 'driver') {
            const driverActiveRide = await Ride.findOne({
                driver: req.user._id,
                status: { $in: ['accepted', 'ongoing'] },
                _id: { $ne: ride._id } // exclude this ride
            });
            if (driverActiveRide) {
                return res.status(409).json({
                    message: 'You already have an active ride. Complete or cancel it before accepting another.',
                    rideId: driverActiveRide._id
                });
            }
        }

        ride.status = status;

        // Use the authenticated driver's ID if provided from secure token, else fallback to body (or keep existing)
        if (req.user && req.user.role === 'driver') {
            ride.driver = req.user._id;
            ride.driverName = req.user.fullName;
        } else if (driverId) {
            ride.driver = driverId;
            try {
                const d = await User.findById(driverId);
                ride.driverName = d ? d.fullName : 'Unknown Driver';
            } catch (e) {
                ride.driverName = 'Unknown Driver';
            }
        }

        if (status === 'ongoing' || status === 'started') ride.startedAt = Date.now();
        if (status === 'completed') ride.completedAt = Date.now();

        await ride.save();
        res.json(ride);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

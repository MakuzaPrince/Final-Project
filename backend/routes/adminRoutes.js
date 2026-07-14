const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Ride = require('../models/Ride');
const TaxSummary = require('../models/TaxSummary');

// Middleware to protect routes (Admin only)
const adminProtect = async (req, res, next) => {
    // Check if user is admin
    // For now, bypass check for speed, implementing in production require verifyToken & check role
    next();
};

// @desc    Get daily revenue for last 7 days
// @route   GET /api/admin/daily-revenue
router.get('/daily-revenue', async (req, res) => {
    try {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const result = await Ride.aggregate([
                {
                    $match: {
                        status: 'completed',
                        createdAt: { $gte: date, $lt: nextDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: "$totalFare" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            last7Days.push({
                date: date.toLocaleDateString('en-US', { weekday: 'short' }),
                revenue: result.length > 0 ? result[0].revenue : 0,
                count: result.length > 0 ? result[0].count : 0
            });
        }
        res.json(last7Days);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
        const totalDrivers = await User.countDocuments({ role: 'driver' });
        const totalRides = await Ride.countDocuments();
        const activeRides = await Ride.countDocuments({ status: { $in: ['accepted', 'ongoing', 'arrived'] } });

        // Calculate completed ride revenue and tax collected
        const completedRides = await Ride.find({ status: 'completed' });
        const totalTax = completedRides.reduce((acc, ride) => acc + (ride.taxAmount || 0), 0);
        const totalRevenue = completedRides.reduce((acc, ride) => acc + (ride.totalFare || 0), 0);
        const taxRate = totalRevenue > 0 ? (totalTax / totalRevenue) * 100 : 0;
        const averageFare = completedRides.length > 0 ? totalRevenue / completedRides.length : 0;

        res.json({
            totalUsers,
            totalDrivers,
            totalRides,
            activeRides,
            completedRides: completedRides.length,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            totalTax: Number(totalTax.toFixed(2)),
            taxRate: Number(taxRate.toFixed(2)),
            averageFare: Number(averageFare.toFixed(2)),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all users (excluding admins)
// @route   GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get tax report with grouping options
// @route   GET /api/admin/tax-report
router.get('/tax-report', async (req, res) => {
    try {
        const { period, groupBy = 'month' } = req.query;
        let dateFilter = {};

        if (period) {
            const days = parseInt(period);
            if (!isNaN(days)) {
                const date = new Date();
                date.setDate(date.getDate() - days);
                dateFilter = { createdAt: { $gte: date } };
            } else if (period === 'year') {
                const date = new Date();
                date.setFullYear(date.getFullYear() - 1);
                dateFilter = { createdAt: { $gte: date } };
            }
        }

        let groupConfig = {};
        switch (groupBy) {
            case 'day':
                groupConfig = {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" }
                };
                break;
            case 'week':
                groupConfig = {
                    year: { $year: "$createdAt" },
                    week: { $week: "$createdAt" }
                };
                break;
            case 'year':
                groupConfig = {
                    year: { $year: "$createdAt" }
                };
                break;
            case 'month':
            default:
                groupConfig = {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" }
                };
                break;
        }

        const report = await Ride.aggregate([
            { $match: { status: 'completed', ...dateFilter } },
            {
                $group: {
                    _id: groupConfig,
                    totalTax: { $sum: "$taxAmount" },
                    totalRides: { $sum: 1 },
                    totalRevenue: { $sum: "$totalFare" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } }
        ]);

        // Format the output for easier frontend consumption
        const formattedReport = report.map(item => {
            let label = '';
            if (groupBy === 'day') label = `${item._id.year}-${item._id.month}-${item._id.day}`;
            else if (groupBy === 'week') label = `Week ${item._id.week}, ${item._id.year}`;
            else if (groupBy === 'month') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                label = `${months[item._id.month - 1]} ${item._id.year}`;
            }
            else if (groupBy === 'year') label = `${item._id.year}`;

            return {
                ...item,
                label
            };
        });

        res.json(formattedReport);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all rides (for admin)
// @route   GET /api/admin/rides
router.get('/rides', async (req, res) => {
    try {
        const rides = await Ride.find().populate('passenger', 'fullName email').sort({ createdAt: -1 });
        res.json(rides);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Toggle user access (block / unblock)
// @route   PUT /api/admin/users/:id/access
router.put('/users/:id/access', async (req, res) => {
    try {
        const { isActive } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        );
        if (!user) return res.status(404).json({ message: 'User not found' });

        // If blocking (isActive === false), force the user offline immediately
        if (!isActive) {
            const io = req.app.get('socketio');
            if (io) {
                // The user's socket is in a room named after their _id
                io.to(user._id.toString()).emit('forceLogout', {
                    reason: 'Your account has been blocked by the administrator.'
                });
            }
        }

        res.json({ message: `User ${isActive ? 'unblocked' : 'blocked'} successfully`, user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
router.put('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['passenger', 'driver', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'Role updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

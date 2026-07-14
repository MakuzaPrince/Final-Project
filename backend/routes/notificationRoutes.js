const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { category, search, period } = req.query;
        let query = { recipient: req.user._id };

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }

        if (period) {
            const now = new Date();
            let startDate;
            switch (period) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
            }
            if (startDate) {
                query.createdAt = { $gte: startDate };
            }
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findById(req.id || req.params.id);

        if (notification) {
            if (notification.recipient.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }
            notification.read = true;
            await notification.save();
            res.json({ message: 'Marked as read' });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark all as read
// @route   PUT /api/notifications/read-all
// @access  Private
router.put('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, read: false },
            { $set: { read: true } }
        );
        res.json({ message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

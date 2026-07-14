const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');
const { protect } = require('../middleware/authMiddleware');

// Helper: get the admin user (for system messages)
const getAdminId = async () => {
    const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
    return admin?._id;
};

// ── GET /api/messages/users ─────────────────────────────────────────────────
// Any authenticated user: search other users to start a conversation with
router.get('/users', protect, async (req, res) => {
    try {
        const { search } = req.query;
        const query = { _id: { $ne: req.user._id } }; // exclude self
        if (search && search.trim()) {
            query.$or = [
                { fullName: { $regex: search.trim(), $options: 'i' } },
                { email:    { $regex: search.trim(), $options: 'i' } }
            ];
        }
        const users = await User.find(query)
            .select('_id fullName email role profileImage')
            .sort({ role: 1, fullName: 1 })
            .limit(25);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/messages/unread-count ──────────────────────────────────────────
// Returns count of unread messages for the current user
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Message.countDocuments({
            recipient: req.user._id,
            read: false
        });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/messages/admin/conversations ───────────────────────────────────
// Admin only: returns one summary entry per unique user the admin has messaged
router.get('/admin/conversations', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        // Aggregate: for each user who has exchanged messages with admin,
        // return the latest message, unread count, and user info
        const adminId = req.user._id;

        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: adminId }, { recipient: adminId }],
                    parentMessage: null // only root messages for conversation summary
                }
            },
            {
                $addFields: {
                    otherUser: {
                        $cond: [{ $eq: ['$sender', adminId] }, '$recipient', '$sender']
                    }
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$otherUser',
                    lastMessage: { $first: '$$ROOT' },
                    totalMessages: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: '$_id',
                    user: { _id: 1, fullName: 1, email: 1, role: 1, profileImage: 1 },
                    lastMessage: {
                        _id: 1, subject: 1, body: 1, createdAt: 1,
                        sender: 1, recipient: 1, read: 1
                    },
                    totalMessages: 1
                }
            },
            { $sort: { 'lastMessage.createdAt': -1 } }
        ]);

        // Also count unread messages per conversation (sent by non-admin to admin)
        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    recipient: adminId,
                    read: false
                }
            },
            { $group: { _id: '$sender', unreadCount: { $sum: 1 } } }
        ]);
        const unreadMap = {};
        unreadCounts.forEach(u => { unreadMap[u._id.toString()] = u.unreadCount; });

        const result = conversations.map(c => ({
            ...c,
            unreadCount: unreadMap[c.userId.toString()] || 0
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/messages/admin/users ────────────────────────────────────────────
// Admin: list all non-admin users to start new conversations
router.get('/admin/users', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        const { search } = req.query;
        const query = { role: { $ne: 'admin' } };
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        const users = await User.find(query)
            .select('_id fullName email role profileImage')
            .sort({ fullName: 1 })
            .limit(50);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/messages/conversation/:userId ──────────────────────────────────
// Returns the full message thread between the current user and :userId
router.get('/conversation/:userId', protect, async (req, res) => {
    try {
        const me = req.user._id;
        const other = new mongoose.Types.ObjectId(req.params.userId);

        const messages = await Message.find({
            $or: [
                { sender: me, recipient: other },
                { sender: other, recipient: me }
            ]
        })
            .populate('sender', 'fullName email role profileImage')
            .populate('recipient', 'fullName email role profileImage')
            .sort({ createdAt: 1 });

        // Mark messages sent TO the current user as read
        await Message.updateMany(
            { sender: other, recipient: me, read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/messages/inbox ─────────────────────────────────────────────────
// User: list of unique senders who have messaged this user
router.get('/inbox', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const threads = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { recipient: userId }]
                }
            },
            {
                $addFields: {
                    otherUser: {
                        $cond: [{ $eq: ['$sender', userId] }, '$recipient', '$sender']
                    }
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$otherUser',
                    lastMessage: { $first: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$recipient', userId] }, { $eq: ['$read', false] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: '$_id',
                    user: { _id: 1, fullName: 1, email: 1, role: 1, profileImage: 1 },
                    lastMessage: { _id: 1, subject: 1, body: 1, createdAt: 1, sender: 1, read: 1 },
                    unreadCount: 1
                }
            },
            { $sort: { 'lastMessage.createdAt': -1 } }
        ]);

        res.json(threads);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── POST /api/messages ───────────────────────────────────────────────────────
// Send a message; creates a notification for the recipient
router.post('/', protect, async (req, res) => {
    try {
        const { recipientId, subject, body, parentMessageId } = req.body;

        if (!recipientId || !subject || !body) {
            return res.status(400).json({ message: 'recipientId, subject, and body are required' });
        }

        const recipient = await User.findById(recipientId).select('_id fullName role');
        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });

        const message = await Message.create({
            sender: req.user._id,
            recipient: recipientId,
            subject: subject.trim(),
            body: body.trim(),
            parentMessage: parentMessageId || null
        });

        const populated = await Message.findById(message._id)
            .populate('sender', 'fullName email role profileImage')
            .populate('recipient', 'fullName email role profileImage');

        // Real-time notification to recipient
        const io = req.app.get('socketio');
        await createNotification(io, {
            recipient: recipientId,
            title: `New message from ${req.user.fullName}`,
            message: subject,
            type: 'info',
            category: 'message',
            metadata: {
                link: req.user.role === 'admin' ? '/messages' : '/messages',
                additionalData: { messageId: message._id, senderId: req.user._id }
            }
        });

        // Also emit the message directly via socket for instant UI update
        if (io) {
            io.to(recipientId.toString()).emit('newMessage', populated);
        }

        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── PUT /api/messages/:id/read ───────────────────────────────────────────────
router.put('/:id/read', protect, async (req, res) => {
    try {
        const msg = await Message.findById(req.params.id);
        if (!msg) return res.status(404).json({ message: 'Message not found' });
        if (msg.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        msg.read = true;
        msg.readAt = new Date();
        await msg.save();
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

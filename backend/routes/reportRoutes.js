const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { createNotification } = require('../services/notificationService');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// ── POST /api/reports — user submits a report ────────────────────────────────
router.post('/', protect, async (req, res) => {
    try {
        const { subject, description, category, priority, rideId } = req.body;

        if (!subject || !description) {
            return res.status(400).json({ message: 'Subject and description are required' });
        }

        const report = await Report.create({
            reporter: req.user._id,
            subject: subject.trim(),
            description: description.trim(),
            category: category || 'other',
            priority: priority || 'medium',
            rideId: rideId || null
        });

        // Notify all admins
        const admins = await User.find({ role: 'admin' }).select('_id');
        const io = req.app.get('socketio');
        for (const admin of admins) {
            await createNotification(io, {
                recipient: admin._id,
                title: `New Issue Report: ${subject}`,
                message: `${req.user.fullName} (${req.user.role}) reported: ${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`,
                type: 'warning',
                category: 'system',
                metadata: {
                    link: '/admin/issues',
                    additionalData: { reportId: report._id }
                }
            });
        }

        res.status(201).json(report);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/reports/my — user's own reports ─────────────────────────────────
router.get('/my', protect, async (req, res) => {
    try {
        const reports = await Report.find({ reporter: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/reports — admin: all reports with filters ───────────────────────
router.get('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const { status, category, priority, search } = req.query;
        const query = {};
        if (status && status !== 'all') query.status = status;
        if (category && category !== 'all') query.category = category;
        if (priority && priority !== 'all') query.priority = priority;
        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const reports = await Report.find(query)
            .populate('reporter', 'fullName email role profileImage')
            .populate('respondedBy', 'fullName')
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/reports/stats — admin: status counts ────────────────────────────
router.get('/stats', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

        const [open, inProgress, resolved, closed] = await Promise.all([
            Report.countDocuments({ status: 'open' }),
            Report.countDocuments({ status: 'in_progress' }),
            Report.countDocuments({ status: 'resolved' }),
            Report.countDocuments({ status: 'closed' }),
        ]);

        res.json({ open, inProgress, resolved, closed, total: open + inProgress + resolved + closed });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── PUT /api/reports/:id — admin: update status + respond ────────────────────
router.put('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const { status, adminResponse } = req.body;
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found' });

        if (status) report.status = status;
        if (adminResponse !== undefined) {
            report.adminResponse = adminResponse;
            report.respondedAt = new Date();
            report.respondedBy = req.user._id;
        }
        await report.save();

        // Notify the reporter of the update
        const io = req.app.get('socketio');
        const statusLabel = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }[report.status] || report.status;
        await createNotification(io, {
            recipient: report.reporter,
            title: `Your report has been updated`,
            message: `Status: ${statusLabel}${adminResponse ? `. Admin response: ${adminResponse.slice(0, 100)}` : ''}`,
            type: status === 'resolved' ? 'success' : 'info',
            category: 'system',
            metadata: { link: '/report-issue', additionalData: { reportId: report._id } }
        });

        const populated = await Report.findById(report._id)
            .populate('reporter', 'fullName email role profileImage')
            .populate('respondedBy', 'fullName');

        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

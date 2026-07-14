const Notification = require('../models/Notification');

/**
 * Creates and saves a notification, and optionally emits via socket
 * @param {Object} io - Socket.io instance
 * @param {Object} params - Notification parameters
 */
const createNotification = async (io, { recipient, title, message, type = 'info', category = 'system', metadata = {} }) => {
    try {
        const notification = await Notification.create({
            recipient,
            title,
            message,
            type,
            category,
            metadata
        });

        // Emit real-time notification via socket if connected
        if (io) {
            io.to(recipient.toString()).emit('newNotification', notification);
        }

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

module.exports = { createNotification };

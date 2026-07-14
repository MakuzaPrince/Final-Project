const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    body: {
        type: String,
        required: true,
        trim: true
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    // Thread support — replies link back to the root message
    parentMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    }
}, { timestamps: true });

// Index for fast conversation lookups
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

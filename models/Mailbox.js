const mongoose = require('mongoose');

const mailboxSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    messages: [{
        type: {
            type: String,
            enum: ['meeting', 'task', 'document', 'notification'],
            required: true
        },
        title: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        reference: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'messages.type'
        },
        isRead: {
            type: Boolean,
            default: false
        },
        labels: [{
            type: String,
            enum: ['urgent', 'important', 'follow-up', 'personal', 'work']
        }],
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    unreadCount: {
        type: Number,
        default: 0
    },
    labels: [{
        name: String,
        color: String
    }]
}, {
    timestamps: true
});

// Method to add a new message
mailboxSchema.methods.addMessage = async function(messageData) {
    this.messages.push(messageData);
    if (!messageData.isRead) {
        this.unreadCount += 1;
    }
    return this.save();
};

// Method to mark message as read
mailboxSchema.methods.markAsRead = async function(messageId) {
    const message = this.messages.id(messageId);
    if (message && !message.isRead) {
        message.isRead = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        return this.save();
    }
    return this;
};

// Method to add label to message
mailboxSchema.methods.addLabelToMessage = async function(messageId, label) {
    const message = this.messages.id(messageId);
    if (message && !message.labels.includes(label)) {
        message.labels.push(label);
        return this.save();
    }
    return this;
};

// Method to create custom label
mailboxSchema.methods.createLabel = async function(name, color) {
    if (!this.labels.find(l => l.name === name)) {
        this.labels.push({ name, color });
        return this.save();
    }
    return this;
};

// Static method to get unread messages count
mailboxSchema.statics.getUnreadCount = async function(userId) {
    const mailbox = await this.findOne({ owner: userId });
    return mailbox ? mailbox.unreadCount : 0;
};

module.exports = mongoose.model('Mailbox', mailboxSchema);

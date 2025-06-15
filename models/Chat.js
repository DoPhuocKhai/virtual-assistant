const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true,
        enum: ['user', 'assistant']
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const chatSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    messages: [messageSchema],
    isActive: {
        type: Boolean,
        default: true
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    summary: {
        type: String,
        maxlength: 200
    }
}, {
    timestamps: true
});

// Index for better query performance
chatSchema.index({ user: 1, lastMessageAt: -1 });
chatSchema.index({ user: 1, isActive: 1 });

// Method to add a message to the chat
chatSchema.methods.addMessage = function(sender, content) {
    this.messages.push({
        sender,
        content,
        timestamp: new Date()
    });
    this.lastMessageAt = new Date();
    
    // Auto-generate title from first user message if not set
    if (!this.title || this.title === 'Chat mới') {
        const firstUserMessage = this.messages.find(msg => msg.sender === 'user');
        if (firstUserMessage) {
            this.title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
        }
    }
    
    return this.save();
};

// Method to generate summary
chatSchema.methods.generateSummary = function() {
    const userMessages = this.messages.filter(msg => msg.sender === 'user');
    if (userMessages.length > 0) {
        const topics = userMessages.map(msg => msg.content.substring(0, 30)).join(', ');
        this.summary = `Thảo luận về: ${topics}`;
        if (this.summary.length > 200) {
            this.summary = this.summary.substring(0, 197) + '...';
        }
    }
    return this.save();
};

// Static method to get user's chat history
chatSchema.statics.getUserChats = function(userId, limit = 20) {
    return this.find({ user: userId })
        .sort({ lastMessageAt: -1 })
        .limit(limit)
        .select('title lastMessageAt isActive summary messages');
};

// Static method to get or create active chat
chatSchema.statics.getOrCreateActiveChat = function(userId) {
    return this.findOne({ user: userId, isActive: true })
        .then(chat => {
            if (chat) {
                return chat;
            }
            // Create new chat if no active chat exists
            return this.create({
                title: 'Chat mới',
                user: userId,
                messages: [],
                isActive: true
            });
        });
};

module.exports = mongoose.model('Chat', chatSchema);

const mongoose = require('mongoose');

const assistantChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: function() {
            // Generate title from first message if available
            if (this.messages && this.messages.length > 0) {
                const firstMsg = this.messages[0].content;
                return firstMsg.length > 50 ? firstMsg.substring(0, 50) + '...' : firstMsg;
            }
            return 'Cuộc trò chuyện mới';
        }
    },
    isActive: {
        type: Boolean,
        default: false
    },
    messages: [{
        content: {
            type: String,
            required: true
        },
        sender: {
            type: String,
            enum: ['user', 'assistant'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

assistantChatSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AssistantChat', assistantChatSchema);

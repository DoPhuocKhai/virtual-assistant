const mongoose = require('mongoose');

const assistantChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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

const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    user: {
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
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

chatSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
})

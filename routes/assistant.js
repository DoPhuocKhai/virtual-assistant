const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const AssistantChat = require('../models/AssistantChat');
const { auth } = require('../middleware/auth');
const mongoose = require('mongoose');

// Initialize Google AI with error handling
let genAI;
let model;
try {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-pro" });
} catch (error) {
    console.error('Failed to initialize Gemini AI:', error);
}

// Helper function for AI response generation
async function generateAIResponse(prompt) {
    if (!model) {
        throw new Error('AI model not initialized');
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (!text || text.trim() === '') {
            throw new Error('Empty response from AI');
        }
        
        console.log('AI Response:', text); // Debug logging
        return text;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error('Failed to generate AI response: ' + error.message);
    }
}

// Chat endpoint
router.post('/chat', auth, async (req, res) => {
    const { message, chatId } = req.body;
    
    try {
        // Input validation
        if (!req.user || !req.user.id) {
            throw new Error('User authentication required');
        }

        // Find or create chat
        let chat;
        if (chatId) {
            chat = await AssistantChat.findOne({
                _id: new mongoose.Types.ObjectId(chatId),
                userId: new mongoose.Types.ObjectId(req.user.id)
            });
        }

        if (!chat) {
            chat = new AssistantChat({
                userId: new mongoose.Types.ObjectId(req.user.id),
                messages: []
            });
        }

        // Generate AI response
        let aiResponse;
        if (message) {
            const systemMessage = `You are an AI assistant for VNG Corporation. Please respond in Vietnamese.
            Current user: ${req.user.name || 'Unknown'} (${req.user.department || 'Unknown department'})
            
            Guidelines:
            1. Always respond in Vietnamese
            2. Be professional and courteous
            3. If unsure, admit not knowing rather than guessing
            4. Focus on company-related information
            5. Keep responses clear and concise`;

            try {
                aiResponse = await generateAIResponse(`${systemMessage}\n\nUser: ${message}\n\nResponse:`);
            } catch (error) {
                console.error('AI Response Error:', error);
                aiResponse = "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.";
            }

            // Add messages to chat
            chat.messages.push(
                {
                    content: message,
                    sender: 'user',
                    timestamp: new Date()
                },
                {
                    content: aiResponse,
                    sender: 'assistant',
                    timestamp: new Date()
                }
            );
        } else {
            // Welcome message for new chat
            aiResponse = "Xin chào! Tôi là trợ lý ảo của VNG. Tôi có thể giúp gì cho bạn?";
            chat.messages.push({
                content: aiResponse,
                sender: 'assistant',
                timestamp: new Date()
            });
        }

        // Save chat
        await chat.save();

        // Send response
        res.json({
            success: true,
            response: aiResponse,
            chatId: chat._id,
            messages: chat.messages
        });

    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            success: false,
            error: 'Chat processing failed',
            message: error.message
        });
    }
});

// Get active chat
router.get('/active', auth, async (req, res) => {
    try {
        const chat = await AssistantChat.findOne({
            userId: req.user.id
        }).sort({ updatedAt: -1 });

        res.json({ chat });
    } catch (error) {
        console.error('Error fetching active chat:', error);
        res.status(500).json({
            error: 'Failed to fetch active chat',
            message: error.message
        });
    }
});

// Get chat history
router.get('/history', auth, async (req, res) => {
    try {
        const chats = await AssistantChat.find({
            userId: req.user.id
        }).sort({ updatedAt: -1 });

        res.json({ chats });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            error: 'Failed to fetch chat history',
            message: error.message
        });
    }
});

// Create new chat
router.post('/new', auth, async (req, res) => {
    try {
        const chat = new AssistantChat({
            userId: req.user.id,
            messages: [{
                content: "Xin chào! Tôi là trợ lý ảo của VNG. Tôi có thể giúp gì cho bạn?",
                sender: 'assistant',
                timestamp: new Date()
            }]
        });

        await chat.save();
        res.json({ chat });
    } catch (error) {
        console.error('Error creating new chat:', error);
        res.status(500).json({
            error: 'Failed to create new chat',
            message: error.message
        });
    }
});

// Resume chat
router.post('/resume/:chatId', auth, async (req, res) => {
    try {
        const chat = await AssistantChat.findOne({
            _id: req.params.chatId,
            userId: req.user.id
        });

        if (!chat) {
            return res.status(404).json({
                error: 'Chat not found',
                message: 'Could not find chat session'
            });
        }

        res.json({ chat });
    } catch (error) {
        console.error('Error resuming chat:', error);
        res.status(500).json({
            error: 'Failed to resume chat',
            message: error.message
        });
    }
});

// Delete chat
router.delete('/:chatId', auth, async (req, res) => {
    try {
        const result = await AssistantChat.deleteOne({
            _id: req.params.chatId,
            userId: req.user.id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                error: 'Chat not found',
                message: 'Could not find chat to delete'
            });
        }

        res.json({ message: 'Chat deleted successfully' });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({
            error: 'Failed to delete chat',
            message: error.message
        });
    }
});

module.exports = router;

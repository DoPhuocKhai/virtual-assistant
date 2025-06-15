const express = require('express');
const router = express.Router();
const AssistantChat = require('../models/AssistantChat');

// Get chat history
router.get('/history', async (req, res) => {
    try {
        const chats = await AssistantChat.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        const history = chats.map(chat => ({
            id: chat._id,
            messages: chat.messages,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt
        }));

        res.json({ history });
    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ error: 'Không thể tải lịch sử chat' });
    }
});

// Get specific chat
router.get('/:chatId', async (req, res) => {
    try {
        const chat = await AssistantChat.findOne({ 
            _id: req.params.chatId,
            userId: req.user._id
        });

        if (!chat) {
            return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
        }

        res.json({ 
            id: chat._id,
            messages: chat.messages,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt
        });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Không thể tải cuộc trò chuyện' });
    }
});

// Update chat
router.put('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { messages } = req.body;

        const chat = await AssistantChat.findOne({ 
            _id: chatId,
            userId: req.user._id
        });

        if (!chat) {
            return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
        }

        chat.messages = messages;
        await chat.save();

        res.json({ success: true, message: 'Đã lưu cuộc trò chuyện' });
    } catch (error) {
        console.error('Update chat error:', error);
        res.status(500).json({ error: 'Không thể lưu cuộc trò chuyện' });
    }
});

// Delete chat
router.delete('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        
        const result = await AssistantChat.deleteOne({ 
            _id: chatId,
            userId: req.user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
        }

        res.json({ success: true, message: 'Đã xóa cuộc trò chuyện' });
    } catch (error) {
        console.error('Delete chat error:', error);
        res.status(500).json({ error: 'Không thể xóa cuộc trò chuyện' });
    }
});

// Create new chat
router.post('/', async (req, res) => {
    try {
        const chat = new AssistantChat({
            userId: req.user._id,
            messages: []
        });

        await chat.save();

        res.json({ 
            id: chat._id,
            messages: chat.messages,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt
        });
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Không thể tạo cuộc trò chuyện mới' });
    }
});

module.exports = router;

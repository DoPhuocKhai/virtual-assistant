const express = require('express');
const router = express.Router();
const Mailbox = require('../models/Mailbox');
const { auth } = require('../middleware/auth');

// Get user's mailbox
router.get('/', auth, async (req, res) => {
    try {
        let mailbox = await Mailbox.findOne({ owner: req.user.id })
            .populate('messages.sender', 'name email department')
            .populate('messages.reference');

        // Create mailbox if it doesn't exist
        if (!mailbox) {
            mailbox = new Mailbox({
                owner: req.user.id,
                messages: [],
                unreadCount: 0,
                labels: [
                    { name: 'urgent', color: '#ff4444' },
                    { name: 'important', color: '#ff8800' },
                    { name: 'follow-up', color: '#0088ff' },
                    { name: 'personal', color: '#44ff44' },
                    { name: 'work', color: '#8844ff' }
                ]
            });
            await mailbox.save();
        }

        res.json({ mailbox });
    } catch (error) {
        console.error('Error fetching mailbox:', error);
        res.status(500).json({ message: 'Lỗi server khi tải hộp thư' });
    }
});

// Get unread messages count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Mailbox.getUnreadCount(req.user.id);
        res.json({ unreadCount: count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ message: 'Lỗi server khi đếm tin nhắn chưa đọc' });
    }
});

// Mark message as read
router.put('/messages/:messageId/read', auth, async (req, res) => {
    try {
        const mailbox = await Mailbox.findOne({ owner: req.user.id });
        
        if (!mailbox) {
            return res.status(404).json({ message: 'Không tìm thấy hộp thư' });
        }

        await mailbox.markAsRead(req.params.messageId);
        
        res.json({ message: 'Đã đánh dấu tin nhắn là đã đọc' });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ message: 'Lỗi server khi đánh dấu tin nhắn' });
    }
});

// Add label to message
router.put('/messages/:messageId/label', auth, async (req, res) => {
    try {
        const { label } = req.body;
        
        if (!label) {
            return res.status(400).json({ message: 'Label là bắt buộc' });
        }

        const mailbox = await Mailbox.findOne({ owner: req.user.id });
        
        if (!mailbox) {
            return res.status(404).json({ message: 'Không tìm thấy hộp thư' });
        }

        await mailbox.addLabelToMessage(req.params.messageId, label);
        
        res.json({ message: 'Đã thêm label cho tin nhắn' });
    } catch (error) {
        console.error('Error adding label to message:', error);
        res.status(500).json({ message: 'Lỗi server khi thêm label' });
    }
});

// Create custom label
router.post('/labels', auth, async (req, res) => {
    try {
        const { name, color } = req.body;
        
        if (!name || !color) {
            return res.status(400).json({ message: 'Tên và màu label là bắt buộc' });
        }

        const mailbox = await Mailbox.findOne({ owner: req.user.id });
        
        if (!mailbox) {
            return res.status(404).json({ message: 'Không tìm thấy hộp thư' });
        }

        await mailbox.createLabel(name, color);
        
        res.json({ message: 'Đã tạo label mới thành công' });
    } catch (error) {
        console.error('Error creating label:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo label' });
    }
});

// Get messages by label
router.get('/messages/label/:label', auth, async (req, res) => {
    try {
        const mailbox = await Mailbox.findOne({ owner: req.user.id })
            .populate('messages.sender', 'name email department');

        if (!mailbox) {
            return res.status(404).json({ message: 'Không tìm thấy hộp thư' });
        }

        const filteredMessages = mailbox.messages.filter(msg => 
            msg.labels.includes(req.params.label)
        );

        res.json({ messages: filteredMessages });
    } catch (error) {
        console.error('Error getting messages by label:', error);
        res.status(500).json({ message: 'Lỗi server khi lọc tin nhắn theo label' });
    }
});

// Delete message
router.delete('/messages/:messageId', auth, async (req, res) => {
    try {
        const mailbox = await Mailbox.findOne({ owner: req.user.id });
        
        if (!mailbox) {
            return res.status(404).json({ message: 'Không tìm thấy hộp thư' });
        }

        const message = mailbox.messages.id(req.params.messageId);
        if (!message) {
            return res.status(404).json({ message: 'Không tìm thấy tin nhắn' });
        }

        // Update unread count if message was unread
        if (!message.isRead) {
            mailbox.unreadCount = Math.max(0, mailbox.unreadCount - 1);
        }

        mailbox.messages.pull(req.params.messageId);
        await mailbox.save();
        
        res.json({ message: 'Đã xóa tin nhắn thành công' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa tin nhắn' });
    }
});

// Send notification to user (internal use)
router.post('/send-notification', auth, async (req, res) => {
    try {
        const { recipientId, type, title, content, reference } = req.body;
        
        if (!recipientId || !type || !title || !content) {
            return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
        }

        let mailbox = await Mailbox.findOne({ owner: recipientId });
        
        // Create mailbox if it doesn't exist
        if (!mailbox) {
            mailbox = new Mailbox({
                owner: recipientId,
                messages: [],
                unreadCount: 0,
                labels: [
                    { name: 'urgent', color: '#ff4444' },
                    { name: 'important', color: '#ff8800' },
                    { name: 'follow-up', color: '#0088ff' },
                    { name: 'personal', color: '#44ff44' },
                    { name: 'work', color: '#8844ff' }
                ]
            });
        }

        await mailbox.addMessage({
            type,
            title,
            content,
            sender: req.user.id,
            reference,
            labels: ['work']
        });
        
        res.json({ message: 'Đã gửi thông báo thành công' });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ message: 'Lỗi server khi gửi thông báo' });
    }
});

module.exports = router;

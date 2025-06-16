const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const CompanyDocument = require('../models/CompanyDocument');
const Meeting = require('../models/Meeting');
const Task = require('../models/Task');
const AssistantChat = require('../models/AssistantChat');
const { auth } = require('../middleware/auth');
const mongoose = require('mongoose');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const Mailbox = require('../models/Mailbox');

// Context preparation function
async function prepareCompanyContext(user) {
    // Lấy các tài liệu có thể truy cập
    const accessibleDocs = await CompanyDocument.findAccessible(user);
    
    // Lấy các cuộc họp sắp tới
    const upcomingMeetings = await Meeting.findUpcoming(user.id);
    
    // Lấy các công việc đang thực hiện
    const activeTasks = await Task.find({
        assignedTo: user.id,
        status: { $in: ['pending', 'in_progress'] }
    }).sort({ dueDate: 1 });

    // Lấy hộp thư của người dùng
    let mailbox = await Mailbox.findOne({ owner: user.id });
    if (!mailbox) {
        mailbox = new Mailbox({
            owner: user.id,
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

    // Lấy chat history
    const chatHistory = await AssistantChat.find({ userId: user.id })
        .sort({ createdAt: -1 })
        .limit(5);

    return {
        userContext: {
            name: user.name || 'Chưa cập nhật',
            role: user.role || 'Chưa cập nhật',
            department: user.department || 'Chưa cập nhật',
            position: user.position || 'Chưa cập nhật'
        },
        documents: accessibleDocs.map(doc => ({
            id: doc._id,
            title: doc.title,
            category: doc.category,
            content: doc.content,
            tags: doc.tags
        })),
        meetings: upcomingMeetings,
        tasks: activeTasks,
        mailbox: {
            unreadCount: mailbox.unreadCount,
            messages: mailbox.messages.slice(0, 10).map(msg => ({
                id: msg._id,
                type: msg.type,
                title: msg.title,
                content: msg.content,
                isRead: msg.isRead,
                labels: msg.labels,
                createdAt: msg.createdAt
            }))
        },
        chatHistory: chatHistory.map(chat => ({
            id: chat._id,
            messages: chat.messages
        }))
    };
}

// Helper function to handle mailbox operations
async function handleMailboxOperation(user, operation, messageData) {
    let mailbox = await Mailbox.findOne({ owner: user.id });
    if (!mailbox) {
        return null;
    }

    switch (operation) {
        case 'add':
            await mailbox.addMessage(messageData);
            break;
        case 'delete':
            if (messageData.messageId) {
                mailbox.messages.pull(messageData.messageId);
                await mailbox.save();
            }
            break;
        case 'markRead':
            if (messageData.messageId) {
                await mailbox.markAsRead(messageData.messageId);
            }
            break;
    }
    return mailbox;
}

// Helper function to handle meeting operations
async function handleMeetingOperation(user, operation, meetingData) {
    switch (operation) {
        case 'schedule':
            const meeting = new Meeting({
                title: meetingData.title,
                description: meetingData.description,
                organizer: user.id,
                participants: meetingData.participants.map(id => ({ user: id })),
                startTime: new Date(meetingData.startTime),
                endTime: new Date(meetingData.endTime),
                location: meetingData.location,
                meetingType: meetingData.meetingType,
                onlineMeetingLink: meetingData.onlineMeetingLink,
                agenda: meetingData.agenda || []
            });
            await meeting.save();
            await meeting.sendNotifications();
            return meeting;

        case 'cancel':
            const existingMeeting = await Meeting.findById(meetingData.meetingId);
            if (existingMeeting && 
                (existingMeeting.organizer.toString() === user.id.toString() || 
                user.department === 'Operations')) {
                existingMeeting.status = 'cancelled';
                await existingMeeting.save();
                return existingMeeting;
            }
            return null;

        case 'getCalendar':
            const { year, month } = meetingData;
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            
            return await Meeting.find({
                startTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { organizer: user.id },
                    { 'participants.user': user.id }
                ]
            }).sort({ startTime: 1 });
    }
    return null;
}

// Xử lý chat với trợ lý ảo
router.post('/chat', auth, async (req, res) => {
    try {
        const { message, chatId, action } = req.body;
        let response;

        // Handle specific actions if provided
        if (action) {
            switch (action.type) {
                case 'mailbox':
                    const mailboxResult = await handleMailboxOperation(req.user, action.operation, action.data);
                    if (mailboxResult) {
                        return res.json({ 
                            success: true, 
                            message: `Thao tác ${action.operation} hộp thư thành công`,
                            data: mailboxResult
                        });
                    }
                    break;

                case 'meeting':
                    const meetingResult = await handleMeetingOperation(req.user, action.operation, action.data);
                    if (meetingResult) {
                        return res.json({ 
                            success: true, 
                            message: `Thao tác ${action.operation} cuộc họp thành công`,
                            data: meetingResult
                        });
                    }
                    break;
            }
        }

        // Set initial response
        response = message 
            ? undefined  // Will be set by Gemini API
            : "Xin chào, Trợ lý ảo công ty VNG có thể giúp gì cho bạn?";

        // Only call Gemini API if there's a message
        if (message) {
            try {
                const companyContext = await prepareCompanyContext(req.user);

                // Chuẩn bị system message với context của công ty
                const systemMessage = `Bạn là trợ lý ảo của công ty VNG. 
                Thông tin người dùng hiện tại:
                - Tên: ${companyContext.userContext.name || 'Chưa cập nhật'}
                - Vị trí: ${companyContext.userContext.position || 'Chưa cập nhật'}
                - Phòng ban: ${companyContext.userContext.department || 'Chưa cập nhật'}
                - Vai trò: ${companyContext.userContext.role || 'Chưa cập nhật'}

                Bạn có quyền truy cập vào:
                - ${companyContext.documents.length} tài liệu công ty
                - ${companyContext.meetings.length} cuộc họp sắp tới
                - ${companyContext.tasks.length} công việc đang thực hiện
                - ${companyContext.mailbox.messages.length} tin nhắn trong hộp thư (${companyContext.mailbox.unreadCount} chưa đọc)
                - ${companyContext.chatHistory.length} cuộc hội thoại gần đây

                Bạn có thể:
                - Đọc và trả lời tin nhắn trong hộp thư
                - Tạo, hủy cuộc họp và quản lý lịch
                - Tìm kiếm và truy cập tài liệu
                - Xem lịch sử chat

                Hãy trả lời dựa trên ngữ cảnh công ty và quyền truy cập của người dùng.`;

                // Tạo completion với Gemini
                const prompt = `${systemMessage}\n\nUser: ${message}`;
                const result = await model.generateContent(prompt);
                const geminiResponse = await result.response;
                response = geminiResponse.text();

                // Xử lý yêu cầu liên quan đến tài liệu
                if (message.toLowerCase().includes('tài liệu') || 
                    message.toLowerCase().includes('hướng dẫn') ||
                    message.toLowerCase().includes('chính sách')) {
                    
                    // Tìm tài liệu liên quan
                    const relevantDocs = companyContext.documents.filter(doc => 
                        doc.content.toLowerCase().includes(message.toLowerCase()) ||
                        doc.tags.some(tag => message.toLowerCase().includes(tag.toLowerCase()))
                    );

                    if (relevantDocs.length > 0) {
                        response += '\n\nTài liệu liên quan:\n' + relevantDocs.map(doc => 
                            `- ${doc.title} (${doc.category})\n  ID: ${doc.id}`
                        ).join('\n');
                    }
                }

                // Xử lý yêu cầu liên quan đến lịch họp
                if (message.toLowerCase().includes('họp') || 
                    message.toLowerCase().includes('cuộc họp') ||
                    message.toLowerCase().includes('lịch')) {
                    
                    // Kiểm tra nếu là yêu cầu tạo cuộc họp mới
                    if (message.toLowerCase().includes('tạo') || 
                        message.toLowerCase().includes('đặt') ||
                        message.toLowerCase().includes('lên lịch')) {
                        
                        // Extract meeting details from message using Gemini
                        const meetingPrompt = `Extract meeting details from: "${message}"
                        Required fields:
                        - title
                        - description
                        - startTime (YYYY-MM-DD HH:mm)
                        - endTime (YYYY-MM-DD HH:mm)
                        - location
                        - meetingType (in-person/online/hybrid)
                        Format as JSON`;
                        
                        const meetingResult = await model.generateContent(meetingPrompt);
                        const meetingDetails = JSON.parse(meetingResult.response.text());
                        
                        if (meetingDetails) {
                            const meeting = await handleMeetingOperation(req.user, 'schedule', meetingDetails);
                            if (meeting) {
                                response += `\n\nĐã tạo cuộc họp mới:\n- ${meeting.title}\n- Thời gian: ${new Date(meeting.startTime).toLocaleString()} - ${new Date(meeting.endTime).toLocaleString()}\n- Địa điểm: ${meeting.location}`;
                            }
                        }
                    }
                    // Kiểm tra nếu là yêu cầu hủy cuộc họp
                    else if (message.toLowerCase().includes('hủy') || 
                             message.toLowerCase().includes('xóa')) {
                        
                        const meetingToCancel = companyContext.meetings.find(m => 
                            message.toLowerCase().includes(m.title.toLowerCase())
                        );
                        
                        if (meetingToCancel) {
                            const cancelled = await handleMeetingOperation(req.user, 'cancel', { meetingId: meetingToCancel.id });
                            if (cancelled) {
                                response += `\n\nĐã hủy cuộc họp: ${meetingToCancel.title}`;
                            }
                        }
                    }
                    // Hiển thị lịch họp
                    else if (companyContext.meetings.length > 0) {
                        response += '\n\nCuộc họp sắp tới:\n' + companyContext.meetings.map(meeting =>
                            `- ${meeting.title} (${new Date(meeting.startTime).toLocaleString()})\n  ID: ${meeting._id}`
                        ).join('\n');
                    }
                }

                // Xử lý yêu cầu liên quan đến hộp thư
                if (message.toLowerCase().includes('thư') || 
                    message.toLowerCase().includes('mail') ||
                    message.toLowerCase().includes('tin nhắn')) {
                    
                    const mailbox = companyContext.mailbox;
                    
                    // Kiểm tra nếu là yêu cầu xem tin nhắn
                    if (message.toLowerCase().includes('xem') || 
                        message.toLowerCase().includes('đọc')) {
                        
                        if (mailbox.messages.length > 0) {
                            response += '\n\nTin nhắn trong hộp thư:\n' + mailbox.messages.map(msg =>
                                `- ${msg.title} (${msg.isRead ? 'Đã đọc' : 'Chưa đọc'})\n  ID: ${msg.id}`
                            ).join('\n');
                        }
                    }
                    // Kiểm tra nếu là yêu cầu xóa tin nhắn
                    else if (message.toLowerCase().includes('xóa')) {
                        const messageToDelete = mailbox.messages.find(m => 
                            message.toLowerCase().includes(m.title.toLowerCase())
                        );
                        
                        if (messageToDelete) {
                            const result = await handleMailboxOperation(req.user, 'delete', { messageId: messageToDelete.id });
                            if (result) {
                                response += `\n\nĐã xóa tin nhắn: ${messageToDelete.title}`;
                            }
                        }
                    }
                }

                // Xử lý yêu cầu liên quan đến công việc
                if (message.toLowerCase().includes('công việc') || 
                    message.toLowerCase().includes('task') ||
                    message.toLowerCase().includes('nhiệm vụ')) {
                    
                    if (companyContext.tasks.length > 0) {
                        response += '\n\nCông việc đang thực hiện:\n' + companyContext.tasks.map(task =>
                            `- ${task.title} (${task.status}, due: ${new Date(task.dueDate).toLocaleDateString()})\n  ID: ${task._id}`
                        ).join('\n');
                    }
                }

                // Xử lý yêu cầu xem lịch sử chat
                if (message.toLowerCase().includes('lịch sử') && 
                    message.toLowerCase().includes('chat')) {
                    
                    if (companyContext.chatHistory.length > 0) {
                        response += '\n\nLịch sử chat gần đây:\n' + companyContext.chatHistory.map(chat =>
                            `- Chat ID: ${chat.id}\n  Số tin nhắn: ${chat.messages.length}`
                        ).join('\n');
                    }
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                // If API call fails, return the fallback message
                response = "Xin lỗi, tôi không thể xử lý yêu cầu lúc này";
            }
        }

        // Validate user
        if (!req.user || !req.user.id) {
            console.error('User ID is missing:', req.user);
            return res.status(400).json({
                error: 'User authentication failed',
                message: 'User ID is required'
            });
        }

        // Save chat to database
        let chat;
        try {
            if (chatId) {
                // Update existing chat
                chat = await AssistantChat.findOne({ 
                    _id: new mongoose.Types.ObjectId(chatId), 
                    userId: new mongoose.Types.ObjectId(req.user.id) 
                });
                
                if (!chat) {
                    return res.status(404).json({
                        error: 'Chat not found',
                        message: 'Could not find chat session'
                    });
                }

                if (message) {
                    // Add user message and assistant response
                    chat.messages.push(
                        { 
                            content: message, 
                            sender: 'user',
                            timestamp: new Date()
                        },
                        { 
                            content: response, 
                            sender: 'assistant',
                            timestamp: new Date()
                        }
                    );
                    await chat.save();
                }
            } else {
                // Create new chat
                const messages = [];
                if (message) {
                    messages.push(
                        { 
                            content: message, 
                            sender: 'user',
                            timestamp: new Date()
                        },
                        { 
                            content: response, 
                            sender: 'assistant',
                            timestamp: new Date()
                        }
                    );
                } else {
                    // For welcome message, only add assistant response
                    messages.push({ 
                        content: response, 
                        sender: 'assistant',
                        timestamp: new Date()
                    });
                }
                
                chat = new AssistantChat({
                    userId: new mongoose.Types.ObjectId(req.user.id),
                    messages: messages
                });
                await chat.save();
            }

            // Return response with chat context
            res.json({ 
                response,
                chatId: chat._id,
                messages: chat.messages
            });
        } catch (dbError) {
            console.error('Database Error:', dbError);
            return res.status(500).json({
                error: 'Database error',
                message: 'Could not save chat messages'
            });
        }
    } catch (error) {
        console.error('Assistant Error:', error);
        res.status(500).json({
            error: 'Không thể xử lý yêu cầu',
            message: error.message
        });
    }
});

// Get active chat
router.get('/active', auth, async (req, res) => {
    try {
        const activeChat = await AssistantChat.findOne({ 
            userId: req.user.id 
        }).sort({ createdAt: -1 });

        if (!activeChat) {
            return res.status(404).json({ 
                message: 'Không tìm thấy cuộc trò chuyện hiện hành' 
            });
        }

        res.json({ chat: activeChat });
    } catch (error) {
        console.error('Error fetching active chat:', error);
        res.status(500).json({ 
            error: 'Lỗi máy chủ khi lấy cuộc trò chuyện hiện hành' 
        });
    }
});

// Get chat history
router.get('/history', auth, async (req, res) => {
    try {
        const chats = await AssistantChat.find({ 
            userId: req.user.id 
        }).sort({ createdAt: -1 });

        res.json({ chats });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ 
            error: 'Lỗi máy chủ khi lấy lịch sử chat' 
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

        // Mark this chat as active
        chat.isActive = true;
        await chat.save();

        res.json({ chat });
    } catch (error) {
        console.error('Error resuming chat:', error);
        res.status(500).json({
            error: 'Could not resume chat',
            message: error.message
        });
    }
});

// Create new chat
router.post('/new', auth, async (req, res) => {
    try {
        // Create new chat with welcome message
        const chat = new AssistantChat({
            userId: req.user.id,
            messages: [{
                content: "Xin chào, Trợ lý ảo công ty VNG có thể giúp gì cho bạn?",
                sender: 'assistant',
                timestamp: new Date()
            }],
            isActive: true
        });

        await chat.save();
        res.json({ chat });
    } catch (error) {
        console.error('Error creating new chat:', error);
        res.status(500).json({
            error: 'Could not create new chat',
            message: error.message
        });
    }
});

// Delete chat
router.delete('/chat/:chatId', auth, async (req, res) => {
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
            error: 'Could not delete chat',
            message: error.message
        });
    }
});

// Tìm kiếm tài liệu
router.get('/search', auth, async (req, res) => {
    try {
        const { query } = req.query;
        
        // Tìm kiếm trong tài liệu có quyền truy cập
        const documents = await CompanyDocument.findAccessible(req.user);
        
        // Lọc và xếp hạng kết quả
        const results = documents
            .filter(doc => 
                doc.title.toLowerCase().includes(query.toLowerCase()) ||
                doc.content.toLowerCase().includes(query.toLowerCase()) ||
                doc.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
            )
            .map(doc => ({
                id: doc._id,
                title: doc.title,
                category: doc.category,
                relevance: calculateRelevance(doc, query),
                preview: generatePreview(doc.content, query)
            }))
            .sort((a, b) => b.relevance - a.relevance);

        res.json({ results });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể thực hiện tìm kiếm',
            message: error.message
        });
    }
});

// Helper function để tính độ liên quan
function calculateRelevance(doc, query) {
    let score = 0;
    const lowerQuery = query.toLowerCase();

    // Tiêu đề match
    if (doc.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
    }

    // Tag match
    if (doc.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        score += 5;
    }

    // Nội dung match
    if (doc.content.toLowerCase().includes(lowerQuery)) {
        score += 3;
    }

    return score;
}

// Helper function để tạo preview
function generatePreview(content, query) {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index === -1) return content.substring(0, 100) + '...';
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);
    
    return (start > 0 ? '...' : '') +
           content.substring(start, end) +
           (end < content.length ? '...' : '');
}

module.exports = router;

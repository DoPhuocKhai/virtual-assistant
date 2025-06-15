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

    return {
        userContext: {
            name: user.name,
            role: user.role,
            department: user.department,
            position: user.position
        },
        documents: accessibleDocs.map(doc => ({
            title: doc.title,
            category: doc.category,
            content: doc.content,
            tags: doc.tags
        })),
        meetings: upcomingMeetings,
        tasks: activeTasks
    };
}

// Xử lý chat với trợ lý ảo
router.post('/chat', auth, async (req, res) => {
    try {
        const { message, chatId } = req.body;
        let response;

        // Set initial response
        response = message 
            ? undefined  // Will be set by Gemini API
            : "Xin chào, Trợ lý ảo công ty Khải Đỗ có thể giúp gì cho bạn?";

        // Only call Gemini API if there's a message
        if (message) {
            try {
                const companyContext = await prepareCompanyContext(req.user);

                // Chuẩn bị system message với context của công ty
                const systemMessage = `Bạn là trợ lý ảo của công ty Khải Đỗ. 
                Thông tin người dùng hiện tại:
                - Tên: ${companyContext.userContext.name}
                - Vị trí: ${companyContext.userContext.position}
                - Phòng ban: ${companyContext.userContext.department}
                - Vai trò: ${companyContext.userContext.role}

                Bạn có quyền truy cập vào:
                - ${companyContext.documents.length} tài liệu công ty
                - ${companyContext.meetings.length} cuộc họp sắp tới
                - ${companyContext.tasks.length} công việc đang thực hiện

                Hãy trả lời dựa trên ngữ cảnh công ty và quyền truy cập của người dùng.`;

                // Tạo completion với Gemini
                const prompt = `${systemMessage}\n\nUser: ${message}`;
                const result = await model.generateContent(prompt);
                const geminiResponse = await result.response;
                response = geminiResponse.text();

                // Nếu câu hỏi liên quan đến tài liệu
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
                            `- ${doc.title} (${doc.category})`
                        ).join('\n');
                    }
                }

                // Nếu câu hỏi liên quan đến lịch họp
                if (message.toLowerCase().includes('họp') || 
                    message.toLowerCase().includes('cuộc họp') ||
                    message.toLowerCase().includes('lịch')) {
                    
                    if (companyContext.meetings.length > 0) {
                        response += '\n\nCuộc họp sắp tới:\n' + companyContext.meetings.map(meeting =>
                            `- ${meeting.title} (${new Date(meeting.startTime).toLocaleString()})`
                        ).join('\n');
                    }
                }

                // Nếu câu hỏi liên quan đến công việc
                if (message.toLowerCase().includes('công việc') || 
                    message.toLowerCase().includes('task') ||
                    message.toLowerCase().includes('nhiệm vụ')) {
                    
                    if (companyContext.tasks.length > 0) {
                        response += '\n\nCông việc đang thực hiện:\n' + companyContext.tasks.map(task =>
                            `- ${task.title} (${task.status}, due: ${new Date(task.dueDate).toLocaleDateString()})`
                        ).join('\n');
                    }
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                // If API call fails, return the fallback message
                response = "Xin lỗi, tôi không thể xử lý yêu cầu lúc này";
            }
        }

        // For now, just return the response without saving to database for testing
        if (!req.user || !req.user.id) {
            console.error('User ID is missing:', req.user);
            return res.status(400).json({
                error: 'User authentication failed',
                message: 'User ID is required'
            });
        }

        // Lưu tin nhắn vào database
        let chat;
        if (chatId) {
            // Cập nhật chat hiện có
            chat = await AssistantChat.findOne({ 
                _id: new mongoose.Types.ObjectId(chatId), 
                userId: new mongoose.Types.ObjectId(req.user.id) 
            });
            if (chat && message) {
                chat.messages.push(
                    { content: message, sender: 'user' },
                    { content: response, sender: 'assistant' }
                );
                await chat.save();
            }
        } else {
            // Tạo chat mới
            const messages = [];
            if (message) {
                messages.push(
                    { content: message, sender: 'user' },
                    { content: response, sender: 'assistant' }
                );
            } else {
                // For welcome message, only add assistant response
                messages.push({ content: response, sender: 'assistant' });
            }
            
            chat = new AssistantChat({
                userId: new mongoose.Types.ObjectId(req.user.id),
                messages: messages
            });
            await chat.save();
        }

        res.json({ 
            response,
            chatId: chat._id
        });
    } catch (error) {
        console.error('Assistant Error:', error);
        res.status(500).json({
            error: 'Không thể xử lý yêu cầu',
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

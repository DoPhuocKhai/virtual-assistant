const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Document = require('../models/Document');
const CalendarQueries = require('../utils/calendarQueries');
const { auth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Helper function to handle calendar-related requests
async function handleCalendarRequest(message, userId, companyContext) {
    try {
        // Extract date and time information using regex
        const dateRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
        const timeRegex = /(\d{1,2})[h:](\d{2})/;
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;

        const dateMatch = message.match(dateRegex);
        const timeMatch = message.match(timeRegex);
        const emails = message.match(emailRegex) || [];

        if (!dateMatch || !timeMatch) {
            return `Vui lòng cung cấp thông tin đầy đủ về thời gian cuộc họp theo định dạng: DD/MM/YYYY HH:mm và email của người tham gia.`;
        }

        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const year = parseInt(dateMatch[3]);
        const hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);

        const startTime = new Date(year, month - 1, day, hour, minute);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour duration

        // Extract title and description
        const titleMatch = message.match(/về\s+["'](.+?)["']/);
        const title = titleMatch ? titleMatch[1] : 'Cuộc họp mới';
        
        // Create meeting
        const result = await CalendarQueries.createMeeting(userId, {
            title,
            description: message,
            participantEmails: emails,
            startTime,
            endTime,
            location: 'Phòng họp chính',
            meetingType: 'in-person'
        });

        if (result.success) {
            return `Đã tạo cuộc họp thành công:
- Tiêu đề: ${result.meeting.title}
- Thời gian: ${startTime.toLocaleString('vi-VN')}
- Địa điểm: ${result.meeting.location}
- Người tham gia: ${emails.join(', ')}

Đã gửi thông báo cho tất cả người tham gia.`;
        } else {
            if (result.conflicts) {
                return `Không thể tạo cuộc họp do xung đột lịch:
${result.conflicts.map(c => `- ${c.title} (${new Date(c.startTime).toLocaleString('vi-VN')})`).join('\n')}

Vui lòng chọn thời gian khác.`;
            }
            return `Không thể tạo cuộc họp: ${result.message}`;
        }
    } catch (error) {
        console.error('Calendar request error:', error);
        return 'Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu đặt lịch. Vui lòng thử lại sau.';
    }
}

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Get chat history
router.get('/history', auth, async (req, res) => {
    try {
        const chats = await Chat.getUserChats(req.user.id);
        res.json({ chats });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Lỗi khi tải lịch sử chat' });
    }
});

// Get active chat or create new one
router.get('/active', auth, async (req, res) => {
    try {
        const chat = await Chat.getOrCreateActiveChat(req.user.id);
        res.json({ chat });
    } catch (error) {
        console.error('Error getting active chat:', error);
        res.status(500).json({ message: 'Lỗi khi tải đoạn chat hiện tại' });
    }
});

// Create new chat session
router.post('/new', auth, async (req, res) => {
    try {
        // Mark all existing chats as inactive
        await Chat.updateMany(
            { user: req.user.id, isActive: true },
            { isActive: false }
        );
        
        // Create new chat
        const chat = await Chat.create({
            title: 'Chat mới',
            user: req.user.id,
            isActive: true
        });
        
        res.json({ chat });
    } catch (error) {
        console.error('Error creating new chat:', error);
        res.status(500).json({ message: 'Lỗi khi tạo đoạn chat mới' });
    }
});

// Send message in chat
router.post('/message', auth, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Tin nhắn không được để trống' });
        }

        // Get or create active chat
        let chat = await Chat.getOrCreateActiveChat(req.user.id);
        
        // Add user message
        await chat.addMessage('user', message);
        
        // Process with Gemini AI
        let aiResponse;
        try {
            // Search for relevant company documents
            let relevantDocuments = [];
            try {
                // Build query for user's accessible documents
                let docQuery = {
                    status: 'published'
                };

                // Operations department has access to ALL documents
                if (req.user.department !== 'Operations') {
                    docQuery.$or = [
                        { accessLevel: 'public' },
                        { department: req.user.department },
                        { department: 'All' }
                    ];
                }

                // Add text search if message contains keywords
                if (message.length > 3) {
                    docQuery.$text = { $search: message };
                }

                relevantDocuments = await Document.find(docQuery)
                    .select('title content category department accessLevel')
                    .limit(req.user.department === 'Operations' ? 10 : 3) // Operations gets more documents
                    .sort({ score: { $meta: 'textScore' } });
            } catch (docError) {
                console.log('Document search error:', docError);
            }

            // Get active company data
            const CompanyData = require('../models/CompanyData');
            const companyData = await CompanyData.getActiveCompanyData();
            
            // Build context with company info
            let companyContext = `
            Bạn là trợ lý ảo của ${companyData.name}. 
            
            ${companyData.formatForContext()}
            
            QUAN TRỌNG: 
            1. Chỉ trả lời các câu hỏi liên quan đến công ty và hoạt động của công ty.
            2. Sử dụng thông tin chính xác từ nguồn Wikipedia và tài liệu công ty.
            3. Nếu câu hỏi không liên quan đến công ty, hãy lịch sự từ chối và đề nghị đặt câu hỏi về công ty.
            4. Nếu không chắc chắn về thông tin, hãy nói rõ là không có thông tin chính xác.
            
            ${req.user.department === 'Operations' ? `
            ĐẶC BIỆT - QUYỀN TRUY CẬP CAO CẤP (OPERATIONS):
            - Bạn đang hỗ trợ nhân viên phòng Operations với quyền truy cập cao nhất
            - Có thể truy xuất và cung cấp thông tin chi tiết từ TẤT CẢ tài liệu công ty
            - Bao gồm cả thông tin bí mật, nội bộ và quản lý cấp cao
            - Cung cấp phân tích sâu và thông tin toàn diện về hoạt động công ty
            - Có thể trả lời các câu hỏi về chiến lược, tài chính, và quy trình nội bộ
            ` : ''}
            `;

            // Add relevant documents to context
            if (relevantDocuments.length > 0) {
                companyContext += `\n\nTài liệu công ty có liên quan:\n`;
                relevantDocuments.forEach((doc, index) => {
                    companyContext += `${index + 1}. ${doc.title} (${doc.category}): ${doc.content.substring(0, 500)}...\n`;
                });
                companyContext += `\nHãy sử dụng thông tin từ các tài liệu này để trả lời câu hỏi một cách chính xác.`;
            }

            // Check for calendar-related requests
            const calendarKeywords = ['đặt lịch', 'tạo cuộc họp', 'lịch họp', 'meeting', 'schedule', 'calendar', 'lịch', 'họp'];
            const isCalendarRequest = calendarKeywords.some(keyword => 
                message.toLowerCase().includes(keyword)
            );

            // Check if question is company-related
            const nonCompanyKeywords = ['thời tiết', 'tin tức', 'thể thao', 'giải trí', 'nấu ăn', 'du lịch', 'game'];
            const isNonCompanyQuestion = nonCompanyKeywords.some(keyword => 
                message.toLowerCase().includes(keyword)
            );

            if (isNonCompanyQuestion) {
                aiResponse = `Xin lỗi, tôi chỉ có thể trả lời các câu hỏi liên quan đến ${companyData.name}. Vui lòng đặt câu hỏi về công ty, chính sách, quy trình làm việc, phúc lợi nhân viên hoặc các vấn đề nội bộ khác.`;
            } else if (isCalendarRequest && req.user.department === 'Operations') {
                // Handle calendar requests for Operations users
                aiResponse = await handleCalendarRequest(message, req.user.id, companyContext);
            } else {
                const prompt = `${companyContext}\n\nCâu hỏi của nhân viên: ${message}\n\nTrả lời (bằng tiếng Việt, dựa trên thông tin công ty và tài liệu có sẵn):`;
                const result = await model.generateContent(prompt);
                aiResponse = result.response.text();
                
                if (!aiResponse) {
                    throw new Error('Empty response from AI');
                }
            }
        } catch (aiError) {
            console.error('AI processing error:', aiError);
            aiResponse = "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau.";
        }
        
        // Add assistant response
        await chat.addMessage('assistant', aiResponse);
        
        // Generate summary if needed
        if (!chat.summary) {
            await chat.generateSummary();
        }
        
        res.json({ 
            response: aiResponse,
            chat
        });
    } catch (error) {
        console.error('Error processing chat:', error);
        res.status(500).json({ message: 'Lỗi khi xử lý tin nhắn' });
    }
});

// Resume chat session
router.post('/resume/:id', auth, async (req, res) => {
    try {
        // Mark all chats as inactive
        await Chat.updateMany(
            { user: req.user.id },
            { isActive: false }
        );
        
        // Set selected chat as active
        const chat = await Chat.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isActive: true },
            { new: true }
        );
        
        if (!chat) {
            return res.status(404).json({ message: 'Không tìm thấy đoạn chat' });
        }
        
        res.json({ chat });
    } catch (error) {
        console.error('Error resuming chat:', error);
        res.status(500).json({ message: 'Lỗi khi khôi phục đoạn chat' });
    }
});

// Delete chat
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await Chat.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });
        
        if (!result) {
            return res.status(404).json({ message: 'Không tìm thấy đoạn chat' });
        }
        
        res.json({ message: 'Đã xóa đoạn chat' });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ message: 'Lỗi khi xóa đoạn chat' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Document = require('../models/Document');
const CompanyData = require('../models/CompanyData');
const CalendarQueries = require('../utils/calendarQueries');
const { auth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize crawlers
const newsCrawler = require('../utils/newsCrawler');
const wikiCrawler = require('../utils/wikiCrawler');

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
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Initialize MongoDB connection
let dbConnection = null;

async function getDbConnection() {
    if (!dbConnection || !mongoose.connection.readyState) {
        dbConnection = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB Atlas');
    }
    return dbConnection;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    try {
        if (dbConnection) {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

// Get chat history
router.get('/history', auth, async (req, res) => {
    try {
        await getDbConnection();
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
        await getDbConnection();
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
        await getDbConnection();
        
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

        // Initialize database connection
        await getDbConnection();

        // Get or create active chat
        let chat = await Chat.getOrCreateActiveChat(req.user.id);
        
        // Add user message
        await chat.addMessage('user', message);
        
        // Process with Gemini AI
        let aiResponse;
        let companyData = null;
        try {
            // Fetch VNG-specific documents and context
            let documentContext = '';
            try {
                const { getCompiledData } = require('../utils/crawlToMongo');
                const compiledData = await getCompiledData();

                // Build document context including VNG-specific information
                documentContext = '\n\nThông tin từ cơ sở dữ liệu VNG:\n\n';
                
                // Add relevant sections based on the query
                const query = message.toLowerCase();
                
                if (query.includes('tài chính') || query.includes('doanh thu') || query.includes('lợi nhuận')) {
                    documentContext += `=== THÔNG TIN TÀI CHÍNH ===\n${compiledData.financialInfo || ''}\n\n`;
                }
                if (query.includes('giải thưởng') || query.includes('thành tựu')) {
                    documentContext += `=== THÀNH TỰU VÀ GIẢI THƯỞNG ===\n${compiledData.achievements || ''}\n\n`;
                }
                if (query.includes('hợp tác') || query.includes('đối tác')) {
                    documentContext += `=== ĐỐI TÁC VÀ HỢP TÁC ===\n${compiledData.partnerships || ''}\n\n`;
                }
                if (query.includes('kinh doanh') || query.includes('phát triển')) {
                    documentContext += `=== CẬP NHẬT KINH DOANH ===\n${compiledData.businessUpdates || ''}\n\n`;
                }
                if (query.includes('tin tức') || query.includes('tin mới')) {
                    documentContext += `=== TIN TỨC GẦN ĐÂY ===\n${compiledData.recentNews || ''}\n\n`;
                }

                // Add full content if no specific category matched
                if (!documentContext.includes('===')) {
                    documentContext += compiledData.fullContent;
                }

                console.log('Successfully retrieved VNG data from MongoDB');
            } catch (docError) {
                console.error('Error fetching VNG documents:', docError);
            }

            // Build context based on company data and user role
            const defaultContext = [
                'THÔNG TIN VỀ VNG:',
                'VNG là công ty công nghệ hàng đầu Việt Nam, được thành lập năm 2004, tiền thân là VinaGame.',
                'Sứ mệnh: Kiến tạo công nghệ và Phát triển con người.',
                'Giá trị cốt lõi: Đón nhận thách thức, Phát triển đối tác, Giữ gìn chính trực, Tận tâm phục vụ.',
                '',
                'VAI TRÒ CỦA TRỢ LÝ ẢO:',
                '1. Hỗ trợ nhân viên VNG với thông tin chính xác về công ty',
                '2. Trả lời về chính sách, quy trình, và văn hóa VNG',
                '3. Cung cấp thông tin về các sản phẩm và dịch vụ của VNG',
                '4. Hỗ trợ các vấn đề liên quan đến công việc tại VNG',
                '',
                'QUY TẮC PHẢN HỒI:',
                '1. Chỉ sử dụng thông tin từ cơ sở dữ liệu VNG và tài liệu nội bộ',
                '2. Thông tin phải chính xác và cập nhật',
                '3. Nếu không có thông tin trong database, hãy nói rõ là "Tôi không tìm thấy thông tin này trong cơ sở dữ liệu VNG"',
                '4. Bảo mật thông tin theo quy định của VNG'
            ].join('\n');

            const operationsContext = req.user.department === 'Operations' ? [
                '',
                'QUYỀN TRUY CẬP ĐẶC BIỆT (OPERATIONS):',
                '- Quyền truy cập cao cấp vào hệ thống VNG',
                '- Có thể xem thông tin chi tiết về hoạt động công ty',
                '- Truy cập dữ liệu về chiến lược và kế hoạch phát triển',
                '- Xem thông tin về các dự án và sản phẩm mới',
                '- Hỗ trợ với các quy trình và chính sách nội bộ'
            ].join('\n') : '';

            // Build company context using the already fetched companyData
            const companyContext = [
                companyData && companyData.name ? 
                    `Bạn là trợ lý ảo của ${companyData.name}.` :
                    'Bạn là trợ lý ảo của VNG Corporation.',
                companyData ? companyData.formatForContext() : '',
                defaultContext,
                operationsContext
            ].filter(Boolean).join('\n\n');

            // Check for calendar-related requests
            const calendarKeywords = ['đặt lịch', 'tạo cuộc họp', 'lịch họp', 'meeting', 'schedule', 'calendar', 'lịch', 'họp'];
            const isCalendarRequest = calendarKeywords.some(keyword => 
                message.toLowerCase().includes(keyword)
            );

            if (isCalendarRequest && req.user.department === 'Operations') {
                // Handle calendar requests for Operations users
                aiResponse = await handleCalendarRequest(message, req.user.id, companyContext);
            } else {
                // Combine all context and build comprehensive prompt
                const fullContext = [
                    companyContext,
                    documentContext,
                    '\nLỊCH SỬ CHAT GẦN NHẤT:',
                    chat.messages.slice(-6).map(msg => 
                        `${msg.sender === 'user' ? 'Nhân viên' : 'Trợ lý'}: ${msg.content}`
                    ).join('\n'),
                    '\nCÂU HỎI HIỆN TẠI:',
                    message
                ].join('\n');

                const prompt = `${fullContext}\n\n
HƯỚNG DẪN TRẢ LỜI CHO TRỢ LÝ ẢO VNG:

1. Phân tích và sử dụng thông tin:
   - Ưu tiên sử dụng thông tin từ cơ sở dữ liệu VNG được cung cấp ở trên
   - Phân tích kỹ các tài liệu theo từng danh mục
   - Kết hợp thông tin từ nhiều nguồn tài liệu nếu có liên quan
   - Đảm bảo thông tin là mới nhất và chính xác

2. Quy tắc bảo mật:
   - Chỉ chia sẻ thông tin phù hợp với quyền truy cập của người dùng
   - Với thông tin nhạy cảm, kiểm tra kỹ department của người dùng
   - Tuân thủ nghiêm ngặt quy định bảo mật của VNG

3. Phong cách trả lời:
   - Sử dụng ngôn ngữ tiếng Việt chuyên nghiệp
   - Thể hiện văn hóa và giá trị cốt lõi của VNG
   - Trả lời rõ ràng, chi tiết và có cấu trúc
   - Giọng điệu thân thiện và hỗ trợ

4. Xử lý khi thiếu thông tin:
   - Nếu không tìm thấy thông tin trong database VNG, trả lời:
     "Tôi không tìm thấy thông tin này trong cơ sở dữ liệu VNG. Bạn có thể liên hệ bộ phận HR hoặc quản lý trực tiếp để được hỗ trợ chi tiết hơn."
   - TUYỆT ĐỐI KHÔNG tự thêm thông tin không có trong nguồn dữ liệu

5. Duy trì tính liên tục:
   - Sử dụng lịch sử chat để đảm bảo các câu trả lời nhất quán
   - Tham chiếu đến các cuộc trao đổi trước nếu liên quan
   - Giữ ngữ cảnh của cuộc trò chuyện

Trả lời:`;
                const result = await model.generateContent(prompt);
                aiResponse = result.response.text();
                
                if (!aiResponse) {
                    throw new Error('Empty response from AI');
                }
            }
        } catch (aiError) {
            console.error('AI processing error:', aiError);
            
            // Provide more helpful error responses
            if (aiError.message && (
                aiError.message.includes('API key') || 
                aiError.message.includes('network') ||
                aiError.message.includes('connection')
            )) {
                aiResponse = "Xin lỗi, tôi đang gặp vấn đề kết nối. Vui lòng đợi một chút và thử lại.";
            } else if (aiError.message.includes('rate limit')) {
                aiResponse = "Xin lỗi, hệ thống đang bận. Vui lòng đợi một lát rồi tiếp tục cuộc trò chuyện.";
            } else if (aiError.message.includes('content filtered')) {
                aiResponse = "Xin lỗi, tôi không thể trả lời câu hỏi này. Vui lòng hỏi về các thông tin liên quan đến công ty.";
            } else {
                aiResponse = "Xin lỗi, tôi gặp vấn đề trong việc xử lý câu hỏi của bạn. Hãy thử diễn đạt câu hỏi theo cách khác hoặc hỏi về một chủ đề khác liên quan đến công ty.";
            }
            
            // Log chi tiết lỗi để debug
            console.log('Detailed AI Error:', {
                name: aiError.name,
                message: aiError.message,
                stack: aiError.stack
            });
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
        await getDbConnection();

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
        await getDbConnection();

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

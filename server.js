const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const moment = require('moment');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Get the Gemini-1.5-flash model
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// MongoDB Atlas connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    }
}).then(() => {
    console.log('📦 Connected to MongoDB Atlas successfully!');
}).catch((err) => {
    console.error('❌ MongoDB Atlas connection error:', err);
    process.exit(1);
});

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

process.on('SIGINT', async () => {
    await mongoose.connection.close();
    process.exit(0);
});

// Import routes
const assistantRoutes = require('./routes/assistant');
const taskRoutes = require('./routes/tasks');
const meetingRoutes = require('./routes/meetings');
const documentRoutes = require('./routes/documents');
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const assistantChatRoutes = require('./routes/assistantChat');

// Import middleware
const { auth } = require('./middleware/auth');

// Use routes (auth routes don't need authentication middleware)
app.use('/api/auth', authRoutes);
app.use('/api/assistant', auth, assistantRoutes);
app.use('/api/tasks', auth, taskRoutes);
app.use('/api/meetings', auth, meetingRoutes);
app.use('/api/documents', auth, documentRoutes);
app.use('/api/chat', auth, chatRoutes);
app.use('/api/assistant-chat', auth, assistantChatRoutes);

// Company info endpoint
app.get('/api/company/info', auth, (req, res) => {
    res.json({
        name: 'Công ty Khải Đỗ',
        departments: ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations'],
        locations: {
            headquarters: 'Hà Nội, Việt Nam',
            branches: ['Hồ Chí Minh', 'Đà Nẵng']
        },
        establishedYear: 2023,
        industry: 'Công nghệ thông tin',
        contact: {
            email: 'contact@khaido.com',
            phone: '+84 xxx xxx xxx',
            address: 'xxx, Hà Nội, Việt Nam'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Trợ lý ảo doanh nghiệp đang hoạt động',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Có lỗi xảy ra trong hệ thống',
        message: err.message 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint không tồn tại',
        path: req.originalUrl 
    });
});

app.listen(PORT, () => {
    console.log(`🤖 Trợ lý ảo doanh nghiệp đang chạy tại port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api`);
});

module.exports = app;

const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { sendMeetingInvitation } = require('../utils/emailService');
const { auth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Get chat messages between two users
router.get('/:userId', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const otherUserId = req.params.userId;

        const messages = await Chat.find({
            $or: [
                { sender: userId, receiver: otherUserId },
                { sender: otherUserId, receiver: userId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy tin nhắn' });
    }
});

// Send a chat message
router.post('/', auth, async (req, res) => {
    try {
        const { receiver, message, attachments } = req.body;
        const sender = req.user._id;

        // Check if message contains meeting scheduling intent using Gemini
        const prompt = `You are a helpful assistant that extracts meeting scheduling details from user messages.

Detect if the following message is a request to schedule a meeting. If yes, extract the meeting details (title, description, start time, end time, participants, location). Message: "${message}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const geminiReply = response.text();

        let meetingCreated = null;

        // Simple check if Gemini detected meeting scheduling intent
        if (geminiReply.toLowerCase().includes('title:')) {
            // Parse meeting details from Gemini reply (assuming JSON or structured text)
            // For simplicity, assume Gemini returns JSON string with meeting details
            let meetingDetails = null;
            try {
                meetingDetails = JSON.parse(geminiReply);
            } catch (err) {
                // If parsing fails, ignore meeting creation
                meetingDetails = null;
            }

            if (meetingDetails) {
                // Create meeting document
                const meeting = new Meeting({
                    title: meetingDetails.title || 'Cuộc họp từ chat',
                    description: meetingDetails.description || '',
                    organizer: sender,
                    participants: meetingDetails.participants ? meetingDetails.participants.map(p => ({ user: p })) : [],
                    startTime: meetingDetails.startTime ? new Date(meetingDetails.startTime) : new Date(),
                    endTime: meetingDetails.endTime ? new Date(meetingDetails.endTime) : new Date(Date.now() + 3600000),
                    location: meetingDetails.location || '',
                    department: meetingDetails.department || 'IT',
                    status: 'scheduled'
                });

                meetingCreated = await meeting.save();

                // Send email invitations to participants
                if (meetingCreated && meetingCreated.participants.length > 0) {
                    const participantIds = meetingCreated.participants.map(p => p.user);
                    const users = await User.find({ _id: { $in: participantIds } });
                    const emails = users.map(u => u.email).filter(email => email);

                    if (emails.length > 0) {
                        await sendMeetingInvitation(emails, meetingCreated);
                    }
                }
            }
        }

        // Save chat message
        const chatMessage = new Chat({
            sender,
            receiver,
            message,
            attachments
        });

        await chatMessage.save();

        res.json({ chatMessage, meetingCreated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi gửi tin nhắn' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Mailbox = require('../models/Mailbox');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Chatbot endpoint to create meetings
router.post('/chatbot/schedule', auth, async (req, res) => {
    try {
        // Only allow Operations or admin to use chatbot scheduling
        if (req.user.department !== 'Operations' && req.user.role !== 'admin') {
            return res.status(403).json({ 
                message: 'Chỉ phòng Operations hoặc admin mới có quyền đặt lịch qua chatbot' 
            });
        }

        const {
            title,
            description,
            participantEmails, // Array of participant emails
            startTime,
            endTime,
            location,
            meetingType = 'in-person',
            onlineMeetingLink,
            agenda = []
        } = req.body;

        // Validate required fields
        if (!title || !description || !startTime || !endTime || !location) {
            return res.status(400).json({ 
                message: 'Thiếu thông tin bắt buộc: title, description, startTime, endTime, location' 
            });
        }

        // Validate time
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        if (start >= end) {
            return res.status(400).json({ 
                message: 'Thời gian bắt đầu phải trước thời gian kết thúc' 
            });
        }

        if (start < new Date()) {
            return res.status(400).json({ 
                message: 'Không thể đặt lịch trong quá khứ' 
            });
        }

        // Find participants by email
        let participantIds = [];
        if (participantEmails && participantEmails.length > 0) {
            const participants = await User.find({ 
                email: { $in: participantEmails } 
            }).select('_id email name');
            
            participantIds = participants.map(p => p._id);
            
            // Check if all emails were found
            const foundEmails = participants.map(p => p.email);
            const notFoundEmails = participantEmails.filter(email => !foundEmails.includes(email));
            
            if (notFoundEmails.length > 0) {
                return res.status(400).json({ 
                    message: `Không tìm thấy người dùng với email: ${notFoundEmails.join(', ')}` 
                });
            }
        }

        // Check for conflicts
        const conflicts = await Meeting.checkConflicts(start, end, participantIds);
        
        if (conflicts.length > 0) {
            return res.status(400).json({ 
                message: 'Có xung đột lịch với các cuộc họp khác',
                conflicts: conflicts.map(c => ({
                    title: c.title,
                    startTime: c.startTime,
                    participants: c.participants.map(p => p.user.name)
                }))
            });
        }

        // Create meeting
        const meeting = new Meeting({
            title,
            description,
            organizer: req.user.id,
            participants: participantIds.map(id => ({ user: id })),
            startTime: start,
            endTime: end,
            location,
            meetingType,
            onlineMeetingLink,
            agenda
        });

        await meeting.save();

        // Send notifications to participants
        await meeting.sendNotifications();

        // Populate for response
        await meeting.populate('organizer', 'name email department');
        await meeting.populate('participants.user', 'name email department');

        res.status(201).json({ 
            message: 'Cuộc họp đã được tạo thành công qua chatbot',
            meeting,
            summary: {
                title: meeting.title,
                startTime: meeting.startTime,
                endTime: meeting.endTime,
                location: meeting.location,
                participantCount: meeting.participants.length,
                notificationsSent: true
            }
        });
    } catch (error) {
        console.error('Error creating meeting via chatbot:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo cuộc họp qua chatbot' });
    }
});

// Chatbot endpoint to get available time slots
router.post('/chatbot/available-slots', auth, async (req, res) => {
    try {
        const { 
            participantEmails, 
            date, // YYYY-MM-DD format
            duration = 60, // minutes
            workingHours = { start: 9, end: 17 } // 9 AM to 5 PM
        } = req.body;

        if (!date) {
            return res.status(400).json({ message: 'Vui lòng cung cấp ngày cần kiểm tra' });
        }

        // Find participants
        let participantIds = [];
        if (participantEmails && participantEmails.length > 0) {
            const participants = await User.find({ 
                email: { $in: participantEmails } 
            }).select('_id');
            participantIds = participants.map(p => p._id);
        }

        // Get meetings for the specified date
        const startOfDay = new Date(date + 'T00:00:00.000Z');
        const endOfDay = new Date(date + 'T23:59:59.999Z');

        const existingMeetings = await Meeting.find({
            status: 'scheduled',
            startTime: { $gte: startOfDay, $lte: endOfDay },
            'participants.user': { $in: participantIds }
        }).sort({ startTime: 1 });

        // Generate available slots
        const availableSlots = [];
        const workStart = new Date(startOfDay);
        workStart.setHours(workingHours.start, 0, 0, 0);
        
        const workEnd = new Date(startOfDay);
        workEnd.setHours(workingHours.end, 0, 0, 0);

        let currentTime = new Date(workStart);
        
        while (currentTime < workEnd) {
            const slotEnd = new Date(currentTime.getTime() + duration * 60000);
            
            if (slotEnd > workEnd) break;
            
            // Check if this slot conflicts with existing meetings
            const hasConflict = existingMeetings.some(meeting => 
                currentTime < meeting.endTime && slotEnd > meeting.startTime
            );
            
            if (!hasConflict) {
                availableSlots.push({
                    startTime: new Date(currentTime),
                    endTime: new Date(slotEnd),
                    duration: duration
                });
            }
            
            // Move to next 30-minute slot
            currentTime.setMinutes(currentTime.getMinutes() + 30);
        }

        res.json({ 
            date,
            availableSlots,
            totalSlots: availableSlots.length,
            workingHours
        });
    } catch (error) {
        console.error('Error finding available slots:', error);
        res.status(500).json({ message: 'Lỗi server khi tìm thời gian trống' });
    }
});

// Chatbot endpoint to get user's schedule
router.get('/chatbot/user-schedule/:email', auth, async (req, res) => {
    try {
        const { email } = req.params;
        const { date, days = 7 } = req.query;

        // Find user by email
        const user = await User.findOne({ email }).select('_id name email department');
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        // Set date range
        const startDate = date ? new Date(date) : new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + parseInt(days));

        // Get user's meetings
        const meetings = await Meeting.find({
            status: 'scheduled',
            startTime: { $gte: startDate, $lt: endDate },
            $or: [
                { organizer: user._id },
                { 'participants.user': user._id }
            ]
        })
        .populate('organizer', 'name email department')
        .populate('participants.user', 'name email department')
        .sort({ startTime: 1 });

        res.json({
            user: {
                name: user.name,
                email: user.email,
                department: user.department
            },
            schedule: {
                startDate,
                endDate,
                meetings: meetings.map(meeting => ({
                    id: meeting._id,
                    title: meeting.title,
                    startTime: meeting.startTime,
                    endTime: meeting.endTime,
                    location: meeting.location,
                    meetingType: meeting.meetingType,
                    organizer: meeting.organizer.name,
                    participantCount: meeting.participants.length
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching user schedule:', error);
        res.status(500).json({ message: 'Lỗi server khi tải lịch người dùng' });
    }
});

// Chatbot endpoint to send custom notifications
router.post('/chatbot/send-notification', auth, async (req, res) => {
    try {
        // Only allow Operations or admin
        if (req.user.department !== 'Operations' && req.user.role !== 'admin') {
            return res.status(403).json({ 
                message: 'Chỉ phòng Operations hoặc admin mới có quyền gửi thông báo' 
            });
        }

        const {
            recipientEmails, // Array of recipient emails
            title,
            content,
            type = 'notification',
            labels = ['work']
        } = req.body;

        if (!recipientEmails || !title || !content) {
            return res.status(400).json({ 
                message: 'Thiếu thông tin bắt buộc: recipientEmails, title, content' 
            });
        }

        // Find recipients by email
        const recipients = await User.find({ 
            email: { $in: recipientEmails } 
        }).select('_id email name');

        if (recipients.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người nhận nào' });
        }

        const notificationResults = [];

        // Send notification to each recipient
        for (const recipient of recipients) {
            try {
                let mailbox = await Mailbox.findOne({ owner: recipient._id });
                
                // Create mailbox if it doesn't exist
                if (!mailbox) {
                    mailbox = new Mailbox({
                        owner: recipient._id,
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
                    labels
                });

                notificationResults.push({
                    recipient: recipient.email,
                    status: 'sent',
                    name: recipient.name
                });
            } catch (error) {
                notificationResults.push({
                    recipient: recipient.email,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        const successCount = notificationResults.filter(r => r.status === 'sent').length;
        const failCount = notificationResults.filter(r => r.status === 'failed').length;

        res.json({
            message: `Đã gửi thông báo: ${successCount} thành công, ${failCount} thất bại`,
            results: notificationResults,
            summary: {
                total: recipients.length,
                success: successCount,
                failed: failCount
            }
        });
    } catch (error) {
        console.error('Error sending notifications:', error);
        res.status(500).json({ message: 'Lỗi server khi gửi thông báo' });
    }
});

// Get all users for chatbot reference
router.get('/chatbot/users', auth, async (req, res) => {
    try {
        // Only allow Operations or admin
        if (req.user.department !== 'Operations' && req.user.role !== 'admin') {
            return res.status(403).json({ 
                message: 'Chỉ phòng Operations hoặc admin mới có quyền xem danh sách người dùng' 
            });
        }

        const users = await User.find({})
            .select('name email department position role')
            .sort({ department: 1, name: 1 });

        res.json({ 
            users: users.map(user => ({
                name: user.name,
                email: user.email,
                department: user.department,
                position: user.position,
                role: user.role
            }))
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Lỗi server khi tải danh sách người dùng' });
    }
});

module.exports = router;

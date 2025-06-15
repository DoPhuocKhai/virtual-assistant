const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { sendMeetingInvitation } = require('../utils/emailService');
const { auth, checkPermission } = require('../middleware/auth');

// Get all meetings (filtered by user's participation)
router.get('/', auth, async (req, res) => {
    try {
        const query = {
            $or: [
                { organizer: req.user._id },
                { 'participants.user': req.user._id }
            ]
        };

        // Admin can see all meetings
        if (req.user.role === 'admin') {
            delete query.$or;
        }

        const meetings = await Meeting.find(query)
            .populate('organizer', 'name email department')
            .populate('participants.user', 'name email department')
            .sort({ startTime: 1 });

        res.json({ meetings });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể lấy danh sách cuộc họp',
            message: error.message
        });
    }
});

// Create new meeting with email notifications
router.post('/', auth, checkPermission('manage_meetings'), async (req, res) => {
    try {
        const meeting = new Meeting({
            ...req.body,
            organizer: req.user._id
        });

        await meeting.save();
        await meeting.populate('organizer', 'name email department');
        await meeting.populate('participants.user', 'name email department');

        // Send email invitations to participants
        if (meeting.participants.length > 0) {
            const participantIds = meeting.participants.map(p => p.user._id);
            const users = await User.find({ _id: { $in: participantIds } });
            const emails = users.map(u => u.email).filter(email => email);

            if (emails.length > 0) {
                try {
                    await sendMeetingInvitation(emails, {
                        title: meeting.title,
                        description: meeting.description,
                        startTime: meeting.startTime,
                        endTime: meeting.endTime,
                        location: meeting.location || meeting.meetingLink || 'Chưa xác định'
                    });
                } catch (emailError) {
                    console.error('Email sending failed:', emailError);
                    // Don't fail the meeting creation if email fails
                }
            }
        }

        res.status(201).json({
            message: 'Tạo cuộc họp thành công và đã gửi lời mời',
            meeting
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể tạo cuộc họp',
            message: error.message
        });
    }
});

// Update meeting
router.patch('/:id', auth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        
        if (!meeting) {
            throw new Error('Không tìm thấy cuộc họp');
        }

        // Check permissions
        if (req.user.role !== 'admin' && 
            meeting.organizer.toString() !== req.user._id.toString() &&
            !req.user.permissions.includes('manage_meetings')) {
            throw new Error('Không có quyền cập nhật cuộc họp này');
        }

        // Update allowed fields
        const updates = Object.keys(req.body);
        const allowedUpdates = ['title', 'description', 'startTime', 'endTime', 'location', 'meetingLink', 'agenda', 'status'];
        
        updates.forEach(update => {
            if (allowedUpdates.includes(update)) {
                meeting[update] = req.body[update];
            }
        });

        await meeting.save();
        await meeting.populate('organizer', 'name email department');
        await meeting.populate('participants.user', 'name email department');

        res.json({
            message: 'Cập nhật cuộc họp thành công',
            meeting
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể cập nhật cuộc họp',
            message: error.message
        });
    }
});

// Delete meeting
router.delete('/:id', auth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        
        if (!meeting) {
            throw new Error('Không tìm thấy cuộc họp');
        }

        // Check permissions
        if (req.user.role !== 'admin' && 
            meeting.organizer.toString() !== req.user._id.toString()) {
            throw new Error('Không có quyền xóa cuộc họp này');
        }

        await meeting.remove();

        res.json({
            message: 'Xóa cuộc họp thành công'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể xóa cuộc họp',
            message: error.message
        });
    }
});

// Get upcoming meetings for current user
router.get('/upcoming', auth, async (req, res) => {
    try {
        const meetings = await Meeting.findUpcoming(req.user._id);
        res.json({ meetings });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể lấy lịch họp sắp tới',
            message: error.message
        });
    }
});

module.exports = router;

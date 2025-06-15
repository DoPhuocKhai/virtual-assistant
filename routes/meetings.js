const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Mailbox = require('../models/Mailbox');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get all meetings (with filtering)
router.get('/', auth, async (req, res) => {
    try {
        const { status, upcoming, month, year } = req.query;
        let query = {};

        // Build query based on filters
        if (status) {
            query.status = status;
        }

        if (upcoming === 'true') {
            query.startTime = { $gt: new Date() };
            query.status = 'scheduled';
        }

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query.startTime = { $gte: startDate, $lte: endDate };
        }

        // Users can see meetings they organize or participate in
        query.$or = [
            { organizer: req.user.id },
            { 'participants.user': req.user.id }
        ];

        const meetings = await Meeting.find(query)
            .populate('organizer', 'name email department')
            .populate('participants.user', 'name email department')
            .populate('agenda.presenter', 'name email department')
            .sort({ startTime: 1 });

        res.json({ meetings });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ message: 'Lỗi server khi tải cuộc họp' });
    }
});

// Get single meeting by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id)
            .populate('organizer', 'name email department')
            .populate('participants.user', 'name email department')
            .populate('agenda.presenter', 'name email department');

        if (!meeting) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc họp' });
        }

        // Check if user has access to this meeting
        const hasAccess = 
            meeting.organizer._id.toString() === req.user.id.toString() ||
            meeting.participants.some(p => p.user._id.toString() === req.user.id.toString());

        if (!hasAccess) {
            return res.status(403).json({ message: 'Không có quyền truy cập cuộc họp này' });
        }

        res.json({ meeting });
    } catch (error) {
        console.error('Error fetching meeting:', error);
        res.status(500).json({ message: 'Lỗi server khi tải cuộc họp' });
    }
});

// Create new meeting (only Operations can create)
router.post('/', auth, async (req, res) => {
    try {
        // Check if user is Operations
        if (req.user.department !== 'Operations') {
            return res.status(403).json({ message: 'Chỉ phòng Operations mới có quyền tạo cuộc họp' });
        }

        const {
            title,
            description,
            participants,
            startTime,
            endTime,
            location,
            meetingType,
            onlineMeetingLink,
            agenda
        } = req.body;

        // Validate required fields
        if (!title || !description || !startTime || !endTime || !location || !meetingType) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        // Validate time
        if (new Date(startTime) >= new Date(endTime)) {
            return res.status(400).json({ message: 'Thời gian bắt đầu phải trước thời gian kết thúc' });
        }

        // Check for conflicts
        const participantIds = participants || [];
        const conflicts = await Meeting.checkConflicts(
            new Date(startTime),
            new Date(endTime),
            participantIds
        );

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
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            location,
            meetingType,
            onlineMeetingLink,
            agenda: agenda || []
        });

        await meeting.save();

        // Send notifications to participants
        await meeting.sendNotifications();

        // Populate for response
        await meeting.populate('organizer', 'name email department');
        await meeting.populate('participants.user', 'name email department');

        res.status(201).json({ 
            message: 'Cuộc họp đã được tạo thành công',
            meeting 
        });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo cuộc họp' });
    }
});

// Update meeting (only organizer can update)
router.put('/:id', auth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc họp' });
        }

        // Check if user is organizer or Operations
        if (meeting.organizer.toString() !== req.user.id.toString() && req.user.department !== 'Operations') {
            return res.status(403).json({ message: 'Chỉ người tổ chức hoặc Operations mới có quyền chỉnh sửa' });
        }

        const {
            title,
            description,
            participants,
            startTime,
            endTime,
            location,
            meetingType,
            onlineMeetingLink,
            agenda,
            status
        } = req.body;

        // Update fields
        if (title) meeting.title = title;
        if (description) meeting.description = description;
        if (startTime) meeting.startTime = new Date(startTime);
        if (endTime) meeting.endTime = new Date(endTime);
        if (location) meeting.location = location;
        if (meetingType) meeting.meetingType = meetingType;
        if (onlineMeetingLink) meeting.onlineMeetingLink = onlineMeetingLink;
        if (agenda) meeting.agenda = agenda;
        if (status) meeting.status = status;

        if (participants) {
            meeting.participants = participants.map(id => ({ user: id }));
        }

        await meeting.save();
        await meeting.populate('organizer', 'name email department');
        await meeting.populate('participants.user', 'name email department');

        res.json({ 
            message: 'Cuộc họp đã được cập nhật thành công',
            meeting 
        });
    } catch (error) {
        console.error('Error updating meeting:', error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật cuộc họp' });
    }
});

// Delete meeting (only organizer or Operations can delete)
router.delete('/:id', auth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc họp' });
        }

        // Check permissions
        if (meeting.organizer.toString() !== req.user.id.toString() && req.user.department !== 'Operations') {
            return res.status(403).json({ message: 'Chỉ người tổ chức hoặc Operations mới có quyền xóa' });
        }

        await Meeting.findByIdAndDelete(req.params.id);

        res.json({ message: 'Cuộc họp đã được xóa thành công' });
    } catch (error) {
        console.error('Error deleting meeting:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa cuộc họp' });
    }
});

// Update participant status (accept/decline meeting)
router.put('/:id/participants/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
        }

        const meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc họp' });
        }

        await meeting.updateParticipantStatus(req.user.id, status);

        res.json({ message: `Đã ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} cuộc họp` });
    } catch (error) {
        console.error('Error updating participant status:', error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật trạng thái' });
    }
});

// Get upcoming meetings for current user
router.get('/user/upcoming', auth, async (req, res) => {
    try {
        const meetings = await Meeting.getUpcomingMeetings(req.user.id);
        res.json({ meetings });
    } catch (error) {
        console.error('Error fetching upcoming meetings:', error);
        res.status(500).json({ message: 'Lỗi server khi tải cuộc họp sắp tới' });
    }
});

// Get calendar view (monthly)
router.get('/calendar/:year/:month', auth, async (req, res) => {
    try {
        const { year, month } = req.params;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const meetings = await Meeting.find({
            startTime: { $gte: startDate, $lte: endDate },
            $or: [
                { organizer: req.user.id },
                { 'participants.user': req.user.id }
            ]
        })
        .populate('organizer', 'name email department')
        .populate('participants.user', 'name email department')
        .sort({ startTime: 1 });

        // Group meetings by date
        const calendar = {};
        meetings.forEach(meeting => {
            const dateKey = meeting.startTime.toISOString().split('T')[0];
            if (!calendar[dateKey]) {
                calendar[dateKey] = [];
            }
            calendar[dateKey].push(meeting);
        });

        res.json({ calendar });
    } catch (error) {
        console.error('Error fetching calendar:', error);
        res.status(500).json({ message: 'Lỗi server khi tải lịch' });
    }
});

module.exports = router;

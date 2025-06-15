const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Mailbox = require('../models/Mailbox');

class CalendarQueries {
    // Create a new meeting with conflict checking
    static async createMeeting(organizerId, meetingData) {
        try {
            const {
                title,
                description,
                participantEmails,
                startTime,
                endTime,
                location,
                meetingType = 'in-person',
                onlineMeetingLink,
                agenda = []
            } = meetingData;

            // Find participants by email
            const participants = await User.find({ 
                email: { $in: participantEmails } 
            }).select('_id email name');
            
            const participantIds = participants.map(p => p._id);

            // Check for conflicts
            const conflicts = await Meeting.checkConflicts(
                new Date(startTime),
                new Date(endTime),
                participantIds
            );

            if (conflicts.length > 0) {
                return {
                    success: false,
                    message: 'Có xung đột lịch',
                    conflicts: conflicts.map(c => ({
                        title: c.title,
                        startTime: c.startTime,
                        participants: c.participants.map(p => p.user.name)
                    }))
                };
            }

            // Create meeting
            const meeting = new Meeting({
                title,
                description,
                organizer: organizerId,
                participants: participantIds.map(id => ({ user: id })),
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                location,
                meetingType,
                onlineMeetingLink,
                agenda
            });

            await meeting.save();
            await meeting.sendNotifications();

            return {
                success: true,
                meeting,
                message: 'Cuộc họp đã được tạo thành công'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi tạo cuộc họp',
                error: error.message
            };
        }
    }

    // Get available time slots for a specific date
    static async getAvailableSlots(participantEmails, date, duration = 60, workingHours = { start: 9, end: 17 }) {
        try {
            // Find participants
            const participants = await User.find({ 
                email: { $in: participantEmails } 
            }).select('_id');
            const participantIds = participants.map(p => p._id);

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

            return {
                success: true,
                date,
                availableSlots,
                totalSlots: availableSlots.length
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi tìm thời gian trống',
                error: error.message
            };
        }
    }

    // Get user's schedule for a specific period
    static async getUserSchedule(email, startDate, days = 7) {
        try {
            const user = await User.findOne({ email }).select('_id name email department');
            if (!user) {
                return {
                    success: false,
                    message: 'Không tìm thấy người dùng'
                };
            }

            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + days);

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

            return {
                success: true,
                user: {
                    name: user.name,
                    email: user.email,
                    department: user.department
                },
                schedule: meetings.map(meeting => ({
                    id: meeting._id,
                    title: meeting.title,
                    startTime: meeting.startTime,
                    endTime: meeting.endTime,
                    location: meeting.location,
                    meetingType: meeting.meetingType,
                    organizer: meeting.organizer.name,
                    participantCount: meeting.participants.length
                }))
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi tải lịch người dùng',
                error: error.message
            };
        }
    }

    // Send notifications to multiple users
    static async sendNotifications(senderUserId, recipientEmails, title, content, type = 'notification') {
        try {
            const recipients = await User.find({ 
                email: { $in: recipientEmails } 
            }).select('_id email name');

            if (recipients.length === 0) {
                return {
                    success: false,
                    message: 'Không tìm thấy người nhận nào'
                };
            }

            const results = [];

            for (const recipient of recipients) {
                try {
                    let mailbox = await Mailbox.findOne({ owner: recipient._id });
                    
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
                        sender: senderUserId,
                        labels: ['work']
                    });

                    results.push({
                        recipient: recipient.email,
                        status: 'sent',
                        name: recipient.name
                    });
                } catch (error) {
                    results.push({
                        recipient: recipient.email,
                        status: 'failed',
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.status === 'sent').length;
            const failCount = results.filter(r => r.status === 'failed').length;

            return {
                success: true,
                message: `Đã gửi thông báo: ${successCount} thành công, ${failCount} thất bại`,
                results,
                summary: {
                    total: recipients.length,
                    success: successCount,
                    failed: failCount
                }
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi gửi thông báo',
                error: error.message
            };
        }
    }

    // Get all users for reference
    static async getAllUsers() {
        try {
            const users = await User.find({})
                .select('name email department position role')
                .sort({ department: 1, name: 1 });

            return {
                success: true,
                users: users.map(user => ({
                    name: user.name,
                    email: user.email,
                    department: user.department,
                    position: user.position,
                    role: user.role
                }))
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi tải danh sách người dùng',
                error: error.message
            };
        }
    }

    // Get upcoming meetings for today
    static async getTodayMeetings(userId) {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

            const meetings = await Meeting.find({
                status: 'scheduled',
                startTime: { $gte: startOfDay, $lte: endOfDay },
                $or: [
                    { organizer: userId },
                    { 'participants.user': userId }
                ]
            })
            .populate('organizer', 'name email department')
            .populate('participants.user', 'name email department')
            .sort({ startTime: 1 });

            return {
                success: true,
                meetings: meetings.map(meeting => ({
                    id: meeting._id,
                    title: meeting.title,
                    startTime: meeting.startTime,
                    endTime: meeting.endTime,
                    location: meeting.location,
                    meetingType: meeting.meetingType,
                    organizer: meeting.organizer.name,
                    participants: meeting.participants.map(p => p.user.name)
                }))
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi tải cuộc họp hôm nay',
                error: error.message
            };
        }
    }

    // Get calendar view for a month
    static async getMonthlyCalendar(userId, year, month) {
        try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            const meetings = await Meeting.find({
                startTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { organizer: userId },
                    { 'participants.user': userId }
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
                calendar[dateKey].push({
                    id: meeting._id,
                    title: meeting.title,
                    startTime: meeting.startTime,
                    endTime: meeting.endTime,
                    location: meeting.location,
                    meetingType: meeting.meetingType,
                    organizer: meeting.organizer.name
                });
            });

            return {
                success: true,
                year,
                month,
                calendar
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi tải lịch tháng',
                error: error.message
            };
        }
    }
}

module.exports = CalendarQueries;

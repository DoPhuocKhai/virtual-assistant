const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['invited', 'accepted', 'declined', 'tentative'],
            default: 'invited'
        },
        joinedAt: Date,
        leftAt: Date
    }],
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    location: {
        type: String,
        default: ''
    },
    meetingLink: {
        type: String,
        default: ''
    },
    agenda: [{
        item: String,
        duration: Number, // in minutes
        presenter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    meetingType: {
        type: String,
        enum: ['team_meeting', 'project_review', 'client_meeting', 'training', 'other'],
        default: 'team_meeting'
    },
    department: {
        type: String,
        required: true
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurrencePattern: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'weekly'
        },
        interval: {
            type: Number,
            default: 1
        },
        endDate: Date
    },
    minutes: {
        content: String,
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        recordedAt: Date
    },
    attachments: [{
        name: String,
        url: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    tags: [String]
}, {
    timestamps: true
});

// Validate end time is after start time
meetingSchema.pre('save', function(next) {
    if (this.endTime <= this.startTime) {
        next(new Error('Thời gian kết thúc phải sau thời gian bắt đầu'));
    }
    next();
});

// Tìm các cuộc họp sắp tới của user
meetingSchema.statics.findUpcoming = function(userId) {
    const now = new Date();
    
    return this.find({
        $or: [
            { organizer: userId },
            { 'participants.user': userId }
        ],
        startTime: { $gte: now },
        status: { $in: ['scheduled', 'in_progress'] }
    })
    .populate('organizer', 'name email department')
    .populate('participants.user', 'name email department')
    .sort({ startTime: 1 })
    .limit(10);
};

// Tìm các cuộc họp trong ngày
meetingSchema.statics.findToday = function(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.find({
        $or: [
            { organizer: userId },
            { 'participants.user': userId }
        ],
        startTime: { 
            $gte: today,
            $lt: tomorrow
        },
        status: { $in: ['scheduled', 'in_progress'] }
    })
    .populate('organizer', 'name email department')
    .populate('participants.user', 'name email department')
    .sort({ startTime: 1 });
};

// Kiểm tra xung đột lịch họp
meetingSchema.statics.checkConflict = async function(userId, startTime, endTime, excludeMeetingId = null) {
    const query = {
        $or: [
            { organizer: userId },
            { 'participants.user': userId }
        ],
        status: { $in: ['scheduled', 'in_progress'] },
        $or: [
            {
                startTime: { $lt: endTime },
                endTime: { $gt: startTime }
            }
        ]
    };

    if (excludeMeetingId) {
        query._id = { $ne: excludeMeetingId };
    }

    const conflicts = await this.find(query);
    return conflicts.length > 0;
};

// Thống kê cuộc họp theo phòng ban
meetingSchema.statics.getStatsByDepartment = async function(department, startDate, endDate) {
    const stats = await this.aggregate([
        {
            $match: {
                department,
                startTime: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalDuration: {
                    $sum: {
                        $divide: [
                            { $subtract: ['$endTime', '$startTime'] },
                            1000 * 60 // Convert to minutes
                        ]
                    }
                }
            }
        }
    ]);

    return stats;
};

const Meeting = mongoose.model('Meeting', meetingSchema);

module.exports = Meeting;

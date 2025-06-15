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
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined'],
            default: 'pending'
        },
        notified: {
            type: Boolean,
            default: false
        }
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
        required: true
    },
    meetingType: {
        type: String,
        enum: ['in-person', 'online', 'hybrid'],
        required: true
    },
    onlineMeetingLink: {
        type: String
    },
    agenda: [{
        topic: String,
        duration: Number, // in minutes
        presenter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    reminderSent: {
        type: Boolean,
        default: false
    },
    recurring: {
        isRecurring: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'none'],
            default: 'none'
        },
        endDate: Date
    }
}, {
    timestamps: true
});

// Index for efficient querying
meetingSchema.index({ startTime: 1, status: 1 });
meetingSchema.index({ organizer: 1, status: 1 });
meetingSchema.index({ 'participants.user': 1, status: 1 });

// Virtual for duration in minutes
meetingSchema.virtual('durationMinutes').get(function() {
    return Math.round((this.endTime - this.startTime) / (1000 * 60));
});

// Method to add participant
meetingSchema.methods.addParticipant = async function(userId) {
    if (!this.participants.find(p => p.user.toString() === userId.toString())) {
        this.participants.push({ user: userId });
        return this.save();
    }
    return this;
};

// Method to update participant status
meetingSchema.methods.updateParticipantStatus = async function(userId, status) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (participant) {
        participant.status = status;
        return this.save();
    }
    return this;
};

// Method to check for conflicts
meetingSchema.statics.checkConflicts = async function(startTime, endTime, participants) {
    return this.find({
        status: 'scheduled',
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
        'participants.user': { $in: participants }
    }).populate('participants.user', 'name email department');
};

// Method to get upcoming meetings for a user
meetingSchema.statics.getUpcomingMeetings = async function(userId) {
    return this.find({
        'participants.user': userId,
        status: 'scheduled',
        startTime: { $gt: new Date() }
    })
    .sort({ startTime: 1 })
    .populate('organizer', 'name email department')
    .populate('participants.user', 'name email department');
};

// Method to send meeting notifications
meetingSchema.methods.sendNotifications = async function() {
    const Mailbox = mongoose.model('Mailbox');
    
    // Send to all participants who haven't been notified
    for (const participant of this.participants.filter(p => !p.notified)) {
        const mailbox = await Mailbox.findOne({ owner: participant.user });
        if (mailbox) {
            await mailbox.addMessage({
                type: 'meeting',
                title: `New Meeting: ${this.title}`,
                content: `You have been invited to a meeting "${this.title}" scheduled for ${this.startTime.toLocaleString()}`,
                sender: this.organizer,
                reference: this._id,
                labels: ['work']
            });
            
            participant.notified = true;
        }
    }
    
    return this.save();
};

module.exports = mongoose.model('Meeting', meetingSchema);

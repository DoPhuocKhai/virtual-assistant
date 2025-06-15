const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'on-hold', 'cancelled'],
        default: 'pending'
    },
    dueDate: {
        type: Date,
        required: true
    },
    category: {
        type: String,
        enum: ['development', 'design', 'testing', 'documentation', 'meeting', 'other'],
        default: 'other'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        content: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    subtasks: [{
        title: String,
        completed: {
            type: Boolean,
            default: false
        },
        completedAt: Date
    }],
    dependencies: [{
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task'
        },
        type: {
            type: String,
            enum: ['blocks', 'blocked-by'],
            required: true
        }
    }],
    tags: [{
        type: String,
        trim: true
    }],
    reminderSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ creator: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ tags: 1 });

// Virtual for days until due
taskSchema.virtual('daysUntilDue').get(function() {
    const now = new Date();
    return Math.ceil((this.dueDate - now) / (1000 * 60 * 60 * 24));
});

// Virtual for completion percentage based on subtasks
taskSchema.virtual('completionPercentage').get(function() {
    if (!this.subtasks || this.subtasks.length === 0) {
        return this.progress;
    }
    const completedSubtasks = this.subtasks.filter(st => st.completed).length;
    return Math.round((completedSubtasks / this.subtasks.length) * 100);
});

// Method to add comment
taskSchema.methods.addComment = async function(userId, content) {
    this.comments.push({
        user: userId,
        content: content
    });
    return this.save();
};

// Method to update progress
taskSchema.methods.updateProgress = async function(progress) {
    this.progress = Math.min(100, Math.max(0, progress));
    if (this.progress === 100) {
        this.status = 'completed';
    } else if (this.progress > 0) {
        this.status = 'in-progress';
    }
    return this.save();
};

// Method to add subtask
taskSchema.methods.addSubtask = async function(title) {
    this.subtasks.push({ title });
    return this.save();
};

// Method to complete subtask
taskSchema.methods.completeSubtask = async function(subtaskId) {
    const subtask = this.subtasks.id(subtaskId);
    if (subtask) {
        subtask.completed = true;
        subtask.completedAt = new Date();
        
        // Update overall progress based on subtasks
        const completedCount = this.subtasks.filter(st => st.completed).length;
        this.progress = Math.round((completedCount / this.subtasks.length) * 100);
        
        if (this.progress === 100) {
            this.status = 'completed';
        }
        
        return this.save();
    }
    return this;
};

// Method to notify assignee
taskSchema.methods.notifyAssignee = async function() {
    const Mailbox = mongoose.model('Mailbox');
    const mailbox = await Mailbox.findOne({ owner: this.assignedTo });
    
    if (mailbox) {
        await mailbox.addMessage({
            type: 'task',
            title: `New Task: ${this.title}`,
            content: `You have been assigned a new task: "${this.title}" due on ${this.dueDate.toLocaleDateString()}`,
            sender: this.creator,
            reference: this._id,
            labels: ['work']
        });
    }
};

// Static method to get overdue tasks
taskSchema.statics.getOverdueTasks = async function(userId) {
    return this.find({
        assignedTo: userId,
        status: { $nin: ['completed', 'cancelled'] },
        dueDate: { $lt: new Date() }
    })
    .populate('creator', 'name email department')
    .sort({ dueDate: 1 });
};

// Static method to get tasks by status
taskSchema.statics.getTasksByStatus = async function(userId, status) {
    return this.find({
        assignedTo: userId,
        status: status
    })
    .populate('creator', 'name email department')
    .sort({ dueDate: 1 });
};

module.exports = mongoose.model('Task', taskSchema);

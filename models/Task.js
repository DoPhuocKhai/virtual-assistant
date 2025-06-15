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
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    dueDate: {
        type: Date,
        required: true
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
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
    tags: [String],
    department: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Tìm các task sắp đến hạn
taskSchema.statics.findUpcoming = function(userId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.find({
        assignedTo: userId,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $lte: tomorrow }
    }).sort({ dueDate: 1 });
};

// Tìm các task quá hạn
taskSchema.statics.findOverdue = function(userId) {
    return this.find({
        assignedTo: userId,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $lt: new Date() }
    }).sort({ dueDate: 1 });
};

// Tính tỷ lệ hoàn thành task theo phòng ban
taskSchema.statics.getCompletionRateByDepartment = async function(department) {
    const stats = await this.aggregate([
        { $match: { department } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const total = stats.reduce((acc, curr) => acc + curr.count, 0);
    const completed = stats.find(s => s._id === 'completed')?.count || 0;

    return {
        total,
        completed,
        rate: total ? (completed / total * 100).toFixed(2) : 0
    };
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;

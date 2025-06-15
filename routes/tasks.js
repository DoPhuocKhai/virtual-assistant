const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Mailbox = require('../models/Mailbox');
const { auth } = require('../middleware/auth');

// Get all tasks (with filtering)
router.get('/', auth, async (req, res) => {
    try {
        const { status, priority, category, dueDate } = req.query;
        let query = {};

        // Users can see tasks they created or are assigned to
        query.$or = [
            { creator: req.user._id },
            { assignedTo: req.user._id }
        ];

        // Add filters
        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (category) query.category = category;
        if (dueDate) {
            const date = new Date(dueDate);
            query.dueDate = {
                $gte: date,
                $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
            };
        }

        const tasks = await Task.find(query)
            .populate('creator', 'name email department')
            .populate('assignedTo', 'name email department')
            .sort({ dueDate: 1 });

        res.json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Lỗi server khi tải công việc' });
    }
});

// Get single task by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('creator', 'name email department')
            .populate('assignedTo', 'name email department')
            .populate('comments.user', 'name email department')
            .populate('dependencies.task');

        if (!task) {
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        // Check if user has access to this task
        const hasAccess = 
            task.creator._id.toString() === req.user._id.toString() ||
            task.assignedTo._id.toString() === req.user._id.toString();

        if (!hasAccess) {
            return res.status(403).json({ message: 'Không có quyền truy cập công việc này' });
        }

        res.json({ task });
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ message: 'Lỗi server khi tải công việc' });
    }
});

// Create new task
router.post('/', auth, async (req, res) => {
    try {
        const {
            title,
            description,
            assignedTo,
            priority,
            category,
            dueDate,
            subtasks,
            tags
        } = req.body;

        // Validate required fields
        if (!title || !description || !assignedTo || !dueDate) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        // Create task
        const task = new Task({
            title,
            description,
            creator: req.user._id,
            assignedTo,
            priority: priority || 'medium',
            category: category || 'other',
            dueDate: new Date(dueDate),
            subtasks: subtasks || [],
            tags: tags || []
        });

        await task.save();

        // Send notification to assignee
        await task.notifyAssignee();

        // Populate for response
        await task.populate('creator', 'name email department');
        await task.populate('assignedTo', 'name email department');

        res.status(201).json({ 
            message: 'Công việc đã được tạo thành công',
            task 
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo công việc' });
    }
});

// Update task
router.put('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        // Check if user can edit this task
        const canEdit = 
            task.creator.toString() === req.user._id.toString() ||
            task.assignedTo.toString() === req.user._id.toString();

        if (!canEdit) {
            return res.status(403).json({ message: 'Không có quyền chỉnh sửa công việc này' });
        }

        const {
            title,
            description,
            assignedTo,
            priority,
            status,
            category,
            dueDate,
            progress,
            subtasks,
            tags
        } = req.body;

        // Update fields
        if (title) task.title = title;
        if (description) task.description = description;
        if (assignedTo) task.assignedTo = assignedTo;
        if (priority) task.priority = priority;
        if (status) task.status = status;
        if (category) task.category = category;
        if (dueDate) task.dueDate = new Date(dueDate);
        if (progress !== undefined) task.progress = progress;
        if (subtasks) task.subtasks = subtasks;
        if (tags) task.tags = tags;

        await task.save();

        // If status changed to completed, notify creator
        if (status === 'completed' && task.status !== 'completed') {
            const creatorMailbox = await Mailbox.findOne({ owner: task.creator });
            if (creatorMailbox) {
                await creatorMailbox.addMessage({
                    type: 'task',
                    title: 'Công việc đã hoàn thành',
                    content: `Công việc "${task.title}" đã được hoàn thành bởi ${req.user.name}`,
                    sender: req.user._id,
                    reference: task._id
                });
            }
        }

        await task.populate('creator', 'name email department');
        await task.populate('assignedTo', 'name email department');

        res.json({ 
            message: 'Công việc đã được cập nhật thành công',
            task 
        });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật công việc' });
    }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        // Only creator can delete task
        if (task.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Chỉ người tạo mới có quyền xóa công việc' });
        }

        await Task.findByIdAndDelete(req.params.id);

        res.json({ message: 'Công việc đã được xóa thành công' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa công việc' });
    }
});

// Add comment to task
router.post('/:id/comments', auth, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Nội dung bình luận là bắt buộc' });
        }

        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        await task.addComment(req.user._id, content);
        await task.populate('comments.user', 'name email department');

        res.json({ 
            message: 'Đã thêm bình luận thành công',
            comments: task.comments 
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Lỗi server khi thêm bình luận' });
    }
});

// Complete subtask
router.put('/:id/subtasks/:subtaskId/complete', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        // Check if user is assigned to this task
        if (task.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Chỉ người được giao mới có quyền hoàn thành công việc con' });
        }

        await task.completeSubtask(req.params.subtaskId);

        res.json({ 
            message: 'Đã đánh dấu hoàn thành công việc con',
            progress: task.progress,
            status: task.status
        });
    } catch (error) {
        console.error('Error completing subtask:', error);
        res.status(500).json({ message: 'Lỗi server khi hoàn thành công việc con' });
    }
});

// Get overdue tasks
router.get('/user/overdue', auth, async (req, res) => {
    try {
        const tasks = await Task.getOverdueTasks(req.user._id);
        res.json({ tasks });
    } catch (error) {
        console.error('Error fetching overdue tasks:', error);
        res.status(500).json({ message: 'Lỗi server khi tải công việc quá hạn' });
    }
});

// Get tasks by status
router.get('/user/status/:status', auth, async (req, res) => {
    try {
        const tasks = await Task.getTasksByStatus(req.user._id, req.params.status);
        res.json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks by status:', error);
        res.status(500).json({ message: 'Lỗi server khi tải công việc theo trạng thái' });
    }
});

module.exports = router;

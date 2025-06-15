const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { auth, checkPermission } = require('../middleware/auth');

// Get all tasks (filtered by user's role and department)
router.get('/', auth, async (req, res) => {
    try {
        const query = {};
        
        // If not admin, only show tasks assigned to user or their department
        if (req.user.role !== 'admin') {
            query.$or = [
                { assignedTo: req.user._id },
                { 
                    'assignedTo.department': req.user.department,
                    status: { $ne: 'completed' }
                }
            ];
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name email department')
            .sort({ dueDate: 1 });

        res.json({ tasks });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể lấy danh sách công việc',
            message: error.message
        });
    }
});

// Create new task
router.post('/', auth, checkPermission('manage_tasks'), async (req, res) => {
    try {
        const task = new Task({
            ...req.body,
            createdBy: req.user._id
        });

        await task.save();
        await task.populate('assignedTo', 'name email department');

        res.status(201).json({
            message: 'Tạo công việc thành công',
            task
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể tạo công việc',
            message: error.message
        });
    }
});

// Update task
router.patch('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            throw new Error('Không tìm thấy công việc');
        }

        // Check permissions
        if (req.user.role !== 'admin' && 
            task.assignedTo.toString() !== req.user._id.toString() &&
            !req.user.permissions.includes('manage_tasks')) {
            throw new Error('Không có quyền cập nhật công việc này');
        }

        // Update allowed fields
        const updates = Object.keys(req.body);
        const allowedUpdates = ['title', 'description', 'status', 'progress', 'comments'];
        
        updates.forEach(update => {
            if (allowedUpdates.includes(update)) {
                task[update] = req.body[update];
            }
        });

        await task.save();
        await task.populate('assignedTo', 'name email department');

        res.json({
            message: 'Cập nhật công việc thành công',
            task
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể cập nhật công việc',
            message: error.message
        });
    }
});

// Delete task (admin only)
router.delete('/:id', auth, checkPermission('manage_tasks'), async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            throw new Error('Không tìm thấy công việc');
        }

        if (req.user.role !== 'admin' && task.assignedTo.toString() !== req.user._id.toString()) {
            throw new Error('Không có quyền xóa công việc này');
        }

        await task.remove();

        res.json({
            message: 'Xóa công việc thành công'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể xóa công việc',
            message: error.message
        });
    }
});

module.exports = router;

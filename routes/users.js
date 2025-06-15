const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { auth } = require('../middleware/auth');

// Middleware kiểm tra quyền IT hoặc admin
const requireITOrAdmin = (req, res, next) => {
    if (req.user.department !== 'IT' && req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Chỉ nhân viên IT hoặc admin mới có quyền truy cập thông tin này' 
        });
    }
    next();
};

// Middleware kiểm tra quyền admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Chỉ admin mới có quyền thực hiện hành động này' 
        });
    }
    next();
};

// GET /api/users - Lấy danh sách tất cả users với phân trang và lọc
router.get('/', auth, requireITOrAdmin, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            department, 
            role, 
            status, 
            search 
        } = req.query;

        // Build query
        let query = {};
        
        if (department) query.department = department;
        if (role) query.role = role;
        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;
        if (status === 'suspended') query.isSuspended = true;
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { position: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        
        const users = await User.find(query, '-password -passwordResetAttempts')
            .populate('suspendedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách người dùng'
        });
    }
});

// GET /api/users/:id - Lấy thông tin chi tiết một user
router.get('/:id', auth, requireITOrAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id, '-password -passwordResetAttempts')
            .populate('suspendedBy', 'name email');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin người dùng'
        });
    }
});

// PUT /api/users/:id/status - Cập nhật trạng thái user (chỉ admin)
router.put('/:id/status', auth, requireAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;
        
        // Không cho phép tự deactivate tài khoản của mình
        if (req.params.id === req.user.id && !isActive) {
            return res.status(400).json({
                success: false,
                message: 'Không thể vô hiệu hóa tài khoản của chính mình'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true, select: '-password -passwordResetAttempts' }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        res.json({
            success: true,
            data: user,
            message: `Đã ${isActive ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản thành công`
        });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái người dùng'
        });
    }
});

// POST /api/users/:id/suspend - Đình chỉ tài khoản user
router.post('/:id/suspend', auth, requireAdmin, async (req, res) => {
    try {
        const { reason, endDate } = req.body;
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp lý do đình chỉ'
            });
        }

        // Không cho phép tự đình chỉ tài khoản của mình
        if (req.params.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Không thể đình chỉ tài khoản của chính mình'
            });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        const suspensionEndDate = endDate ? new Date(endDate) : null;
        await user.suspend(req.user.id, reason, suspensionEndDate);

        await user.populate('suspendedBy', 'name email');

        res.json({
            success: true,
            data: user,
            message: 'Đã đình chỉ tài khoản thành công'
        });
    } catch (error) {
        console.error('Error suspending user:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đình chỉ tài khoản'
        });
    }
});

// POST /api/users/:id/unsuspend - Bỏ đình chỉ tài khoản user
router.post('/:id/unsuspend', auth, requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        if (!user.isSuspended) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản này không bị đình chỉ'
            });
        }

        await user.unsuspend();

        res.json({
            success: true,
            data: user,
            message: 'Đã bỏ đình chỉ tài khoản thành công'
        });
    } catch (error) {
        console.error('Error unsuspending user:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi bỏ đình chỉ tài khoản'
        });
    }
});

// PUT /api/users/:id/password - Đổi mật khẩu cho user (admin)
router.put('/:id/password', auth, requireAdmin, async (req, res) => {
    try {
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.changePassword(hashedPassword);

        res.json({
            success: true,
            message: 'Đã đổi mật khẩu thành công'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đổi mật khẩu'
        });
    }
});

// PUT /api/users/profile/password - Đổi mật khẩu của chính mình
router.put('/profile/password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            });
        }

        const user = await User.findById(req.user.id);
        
        // Kiểm tra mật khẩu hiện tại
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu hiện tại không đúng'
            });
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.changePassword(hashedPassword);

        res.json({
            success: true,
            message: 'Đã đổi mật khẩu thành công'
        });
    } catch (error) {
        console.error('Error changing own password:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đổi mật khẩu'
        });
    }
});

// PUT /api/users/:id - Cập nhật thông tin user
router.put('/:id', auth, requireITOrAdmin, async (req, res) => {
    try {
        const { name, department, position, role, permissions } = req.body;
        
        // Không cho phép thay đổi role của chính mình
        if (req.params.id === req.user.id && role && role !== req.user.role) {
            return res.status(400).json({
                success: false,
                message: 'Không thể thay đổi quyền của chính mình'
            });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (department) updateData.department = department;
        if (position) updateData.position = position;
        if (role && req.user.role === 'admin') updateData.role = role;
        if (permissions && req.user.role === 'admin') updateData.permissions = permissions;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, select: '-password -passwordResetAttempts' }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        res.json({
            success: true,
            data: user,
            message: 'Cập nhật thông tin thành công'
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật thông tin người dùng'
        });
    }
});

// GET /api/users/stats/dashboard - Thống kê dashboard cho admin
router.get('/stats/dashboard', auth, requireAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const suspendedUsers = await User.countDocuments({ isSuspended: true });
        
        // Thống kê theo phòng ban
        const departmentStats = await User.aggregate([
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                    suspended: { $sum: { $cond: ['$isSuspended', 1, 0] } }
                }
            }
        ]);

        // Thống kê theo role
        const roleStats = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Người dùng đăng nhập gần đây
        const recentLogins = await User.find({ lastLogin: { $exists: true } })
            .select('name email department lastLogin')
            .sort({ lastLogin: -1 })
            .limit(10);

        res.json({
            success: true,
            data: {
                overview: {
                    total: totalUsers,
                    active: activeUsers,
                    inactive: totalUsers - activeUsers,
                    suspended: suspendedUsers
                },
                departmentStats,
                roleStats,
                recentLogins
            }
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thống kê người dùng'
        });
    }
});

module.exports = router;

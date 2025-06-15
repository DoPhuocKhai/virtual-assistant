const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Đăng ký tài khoản công khai
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, department, position } = req.body;

        // Kiểm tra email đã tồn tại
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                error: 'Email đã được sử dụng',
                message: 'Vui lòng sử dụng email khác'
            });
        }

        // Tạo user mới với role employee mặc định
        const user = new User({
            email,
            password,
            name,
            department,
            position,
            role: 'employee',
            permissions: ['view_company_docs', 'manage_tasks']
        });

        await user.save();

        res.status(201).json({
            message: 'Đăng ký tài khoản thành công',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể tạo tài khoản',
            message: error.message
        });
    }
});

// Đăng ký tài khoản bởi admin (với quyền cao hơn)
router.post('/admin-register', auth, async (req, res) => {
    try {
        // Kiểm tra quyền admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Không có quyền truy cập',
                message: 'Chỉ admin mới có thể tạo tài khoản với quyền đặc biệt'
            });
        }

        const user = new User(req.body);
        await user.save();

        res.status(201).json({
            message: 'Tạo tài khoản thành công',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể tạo tài khoản',
            message: error.message
        });
    }
});

// Đăng nhập
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            throw new Error('Email hoặc mật khẩu không chính xác');
        }

        if (user.status !== 'active') {
            throw new Error('Tài khoản đã bị vô hiệu hóa');
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Cập nhật thời gian đăng nhập cuối
        user.lastLogin = new Date();
        await user.save();

        res.json({
            message: 'Đăng nhập thành công',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: user.permissions
            },
            token
        });
    } catch (error) {
        res.status(401).json({
            error: 'Đăng nhập thất bại',
            message: error.message
        });
    }
});

// Lấy thông tin người dùng hiện tại
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                department: req.user.department,
                permissions: req.user.permissions,
                position: req.user.position,
                avatar: req.user.avatar,
                lastLogin: req.user.lastLogin
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể lấy thông tin người dùng',
            message: error.message
        });
    }
});

// Đổi mật khẩu
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = req.user;

        // Kiểm tra mật khẩu hiện tại
        if (!(await user.comparePassword(currentPassword))) {
            throw new Error('Mật khẩu hiện tại không chính xác');
        }

        // Cập nhật mật khẩu mới
        user.password = newPassword;
        await user.save();

        res.json({
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể đổi mật khẩu',
            message: error.message
        });
    }
});

// Cập nhật thông tin cá nhân
router.patch('/profile', auth, async (req, res) => {
    try {
        const allowedUpdates = ['name', 'avatar'];
        const updates = Object.keys(req.body);
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            throw new Error('Các trường không hợp lệ');
        }

        updates.forEach(update => req.user[update] = req.body[update]);
        await req.user.save();

        res.json({
            message: 'Cập nhật thông tin thành công',
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                avatar: req.user.avatar
            }
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể cập nhật thông tin',
            message: error.message
        });
    }
});

// Admin: Quản lý người dùng
router.get('/users', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            throw new Error('Chỉ admin mới có quyền xem danh sách người dùng');
        }

        const users = await User.find({}, '-password');
        res.json({ users });
    } catch (error) {
        res.status(403).json({
            error: 'Không có quyền truy cập',
            message: error.message
        });
    }
});

// Admin: Cập nhật trạng thái người dùng
router.patch('/users/:userId/status', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            throw new Error('Chỉ admin mới có quyền thay đổi trạng thái người dùng');
        }

        const { status } = req.body;
        const user = await User.findById(req.params.userId);

        if (!user) {
            throw new Error('Không tìm thấy người dùng');
        }

        user.status = status;
        await user.save();

        res.json({
            message: 'Cập nhật trạng thái thành công',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                status: user.status
            }
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể cập nhật trạng thái',
            message: error.message
        });
    }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error('Không tìm thấy token xác thực');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId, status: 'active' });

        if (!user) {
            throw new Error('Người dùng không tồn tại hoặc đã bị vô hiệu hóa');
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({
            error: 'Vui lòng đăng nhập để tiếp tục',
            message: error.message
        });
    }
};

// Middleware to check specific permissions
const checkPermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user.permissions.includes(requiredPermission) && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Không có quyền truy cập',
                message: 'Bạn không có quyền thực hiện hành động này'
            });
        }
        next();
    };
};

// Middleware to check role
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Không có quyền truy cập',
                message: 'Vai trò của bạn không được phép thực hiện hành động này'
            });
        }
        next();
    };
};

// Middleware to check department access
const checkDepartmentAccess = (allowSameDepOnly = true) => {
    return (req, res, next) => {
        // Admins can access all departments
        if (req.user.role === 'admin') {
            return next();
        }

        // Managers can access their own department
        if (req.user.role === 'manager' && req.params.department === req.user.department) {
            return next();
        }

        // For same department only access
        if (allowSameDepOnly && req.params.department !== req.user.department) {
            return res.status(403).json({
                error: 'Không có quyền truy cập',
                message: 'Bạn chỉ có thể truy cập tài liệu trong phòng ban của mình'
            });
        }

        next();
    };
};

module.exports = {
    auth,
    checkPermission,
    checkRole,
    checkDepartmentAccess
};

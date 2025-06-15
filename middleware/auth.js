const jwt = require('jsonwebtoken');

// Authentication middleware
const auth = function(req, res, next) {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // Check if no token
    if (!token) {
        return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Token không hợp lệ' });
    }
};

// Permission check middleware
const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Không có quyền truy cập' });
        }

        // Admin has all permissions
        if (req.user.role === 'admin') {
            return next();
        }

        // Check if user has the required permission
        if (!req.user.permissions || !req.user.permissions.includes(permission)) {
            return res.status(403).json({ 
                message: 'Không có quyền thực hiện hành động này',
                requiredPermission: permission
            });
        }

        next();
    };
};

// Role check middleware
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Không có quyền truy cập' });
        }

        // Convert single role to array
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'Vai trò của bạn không được phép thực hiện hành động này',
                requiredRoles: allowedRoles
            });
        }

        next();
    };
};

// Department check middleware
const checkDepartment = (departments) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Không có quyền truy cập' });
        }

        // Admin has access to all departments
        if (req.user.role === 'admin') {
            return next();
        }

        // Convert single department to array
        const allowedDepartments = Array.isArray(departments) ? departments : [departments];

        if (!allowedDepartments.includes(req.user.department)) {
            return res.status(403).json({ 
                message: 'Phòng ban của bạn không được phép thực hiện hành động này',
                requiredDepartments: allowedDepartments
            });
        }

        next();
    };
};

// Combined department and role check middleware
const checkDepartmentOrRole = (departments, roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Không có quyền truy cập' });
        }

        // Admin has all access
        if (req.user.role === 'admin') {
            return next();
        }

        const allowedDepartments = Array.isArray(departments) ? departments : [departments];
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        // Check if user's department or role is allowed
        if (allowedDepartments.includes(req.user.department) || allowedRoles.includes(req.user.role)) {
            return next();
        }

        return res.status(403).json({ 
            message: 'Bạn không có quyền thực hiện hành động này',
            requiredDepartments: allowedDepartments,
            requiredRoles: allowedRoles
        });
    };
};

module.exports = {
    auth,
    checkPermission,
    checkRole,
    checkDepartment,
    checkDepartmentOrRole
};

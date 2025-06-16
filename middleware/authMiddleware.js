const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Get token from cookie or header
        const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');
        const refreshToken = req.cookies.refreshToken;

        if (!token && !refreshToken) {
            return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
        }

        try {
            // Try to verify access token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded.user;
            return next();
        } catch (tokenError) {
            // Access token invalid, try refresh token
            if (!refreshToken) {
                throw new Error('No refresh token');
            }

            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                throw new Error('User not found');
            }

            // Generate new tokens
            const accessToken = jwt.sign(
                {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        department: user.department,
                        position: user.position
                    }
                },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );

            const newRefreshToken = jwt.sign(
                { userId: user.id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

            // Set new cookies
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000 // 15 minutes
            });

            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            req.user = jwt.verify(accessToken, process.env.JWT_SECRET).user;
            return next();
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }
};

module.exports = auth;

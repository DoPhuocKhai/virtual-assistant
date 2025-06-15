const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/emailService');
const crypto = require('crypto');

// Store verification codes temporarily (in production, use Redis or similar)
const verificationCodes = new Map();

// Generate verification code
const generateVerificationCode = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// Forgot password route
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản với email này' });
        }

        // Generate and store verification code
        const code = generateVerificationCode();
        verificationCodes.set(email, {
            code,
            timestamp: Date.now(),
            attempts: 0
        });

        // Send verification email
        await sendVerificationEmail(email, code);

        res.json({ message: 'Mã xác nhận đã được gửi đến email của bạn' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword, email } = req.body;
        
        // Find email from verification codes if not provided
        let userEmail = email;
        if (!userEmail) {
            // Find email by token
            for (const [storedEmail, verification] of verificationCodes.entries()) {
                if (verification.code === token) {
                    userEmail = storedEmail;
                    break;
                }
            }
        }

        if (!userEmail) {
            return res.status(400).json({ message: 'Mã xác nhận không hợp lệ' });
        }
        
        // Verify the code
        const verification = verificationCodes.get(userEmail);
        if (!verification || verification.code !== token) {
            return res.status(400).json({ message: 'Mã xác nhận không hợp lệ' });
        }

        // Check if code is expired (15 minutes)
        if (Date.now() - verification.timestamp > 15 * 60 * 1000) {
            verificationCodes.delete(userEmail);
            return res.status(400).json({ message: 'Mã xác nhận đã hết hạn' });
        }

        // Update password
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        // Clear verification code
        verificationCodes.delete(userEmail);

        res.json({ message: 'Mật khẩu đã được đặt lại thành công' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Delete account route
router.delete('/delete-account', auth, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id);

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu không đúng' });
        }

        // Delete user
        await User.findByIdAndDelete(req.user.id);

        res.json({ message: 'Tài khoản đã được xóa thành công' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        const payload = {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                department: user.department,
                position: user.position
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Register route
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, department, position } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'Email đã được sử dụng' });
        }

        // Create new user
        user = new User({
            email,
            password,
            name,
            department,
            position
        });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        // Create and return JWT token
        const payload = {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                department: user.department,
                position: user.position
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;

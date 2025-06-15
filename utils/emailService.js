const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send verification email with code
 * @param {string} email - Recipient email address
 * @param {string} code - Verification code
 */
const sendVerificationEmail = async (email, code) => {
    try {
        const mailOptions = {
            from: `"Trợ Lý Ảo - Công ty Khải Đỗ" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Mã xác nhận đặt lại mật khẩu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Đặt lại mật khẩu</h2>
                    <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                    <p>Mã xác nhận của bạn là:</p>
                    <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${code}</span>
                    </div>
                    <p>Mã xác nhận này sẽ hết hạn sau 15 phút.</p>
                    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Email này được gửi tự động, vui lòng không trả lời.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Verification email sent successfully');
    } catch (error) {
        console.error('Send verification email error:', error);
        throw new Error('Failed to send verification email');
    }
};

module.exports = {
    sendVerificationEmail
};

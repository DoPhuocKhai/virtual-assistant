const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendMeetingInvitation(toEmails, meetingDetails) {
    const mailOptions = {
        from: `"Công ty Khải Đỗ" <${process.env.SMTP_USER}>`,
        to: toEmails.join(', '),
        subject: `Lời mời họp: ${meetingDetails.title}`,
        html: `
            <p>Xin chào,</p>
            <p>Bạn được mời tham gia cuộc họp với các thông tin sau:</p>
            <ul>
                <li><strong>Tiêu đề:</strong> ${meetingDetails.title}</li>
                <li><strong>Mô tả:</strong> ${meetingDetails.description}</li>
                <li><strong>Thời gian bắt đầu:</strong> ${new Date(meetingDetails.startTime).toLocaleString()}</li>
                <li><strong>Thời gian kết thúc:</strong> ${new Date(meetingDetails.endTime).toLocaleString()}</li>
                <li><strong>Địa điểm:</strong> ${meetingDetails.location}</li>
            </ul>
            <p>Vui lòng tham gia đúng giờ.</p>
            <p>Trân trọng,</p>
            <p>Công ty Khải Đỗ</p>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = {
    sendMeetingInvitation
};

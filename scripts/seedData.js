const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const CompanyDocument = require('../models/CompanyDocument');
const dotenv = require('dotenv');

dotenv.config();

// Sample users for Khai Do company
const sampleUsers = [
    {
        email: 'admin@khaido.com',
        password: 'admin123',
        name: 'Nguyễn Văn Admin',
        role: 'admin',
        department: 'IT',
        position: 'Quản trị hệ thống',
        permissions: ['view_company_docs', 'edit_company_docs', 'manage_users', 'view_reports', 'manage_meetings', 'manage_tasks']
    },
    {
        email: 'manager.it@khaido.com',
        password: 'manager123',
        name: 'Trần Thị Manager IT',
        role: 'manager',
        department: 'IT',
        position: 'Trưởng phòng IT',
        permissions: ['view_company_docs', 'edit_company_docs', 'view_reports', 'manage_meetings', 'manage_tasks']
    },
    {
        email: 'manager.hr@khaido.com',
        password: 'manager123',
        name: 'Lê Văn Manager HR',
        role: 'manager',
        department: 'HR',
        position: 'Trưởng phòng Nhân sự',
        permissions: ['view_company_docs', 'edit_company_docs', 'view_reports', 'manage_meetings', 'manage_tasks']
    },
    {
        email: 'employee.it@khaido.com',
        password: 'employee123',
        name: 'Phạm Thị Employee IT',
        role: 'employee',
        department: 'IT',
        position: 'Lập trình viên',
        permissions: ['view_company_docs', 'manage_tasks']
    },
    {
        email: 'employee.hr@khaido.com',
        password: 'employee123',
        name: 'Hoàng Văn Employee HR',
        role: 'employee',
        department: 'HR',
        position: 'Chuyên viên Nhân sự',
        permissions: ['view_company_docs', 'manage_tasks']
    }
];

// Read company handbook
const fs = require('fs');
const path = require('path');

const companyHandbook = fs.readFileSync(path.join(__dirname, '../documents/KhaiDo_Company_Handbook.docx'), 'utf8');

// Sample company documents
const sampleDocuments = [
    {
        title: 'Sổ tay nhân viên Công ty Khải Đỗ',
        content: companyHandbook,
        category: 'company_policy',
        department: 'All',
        accessLevel: 'public',
        tags: ['sổ tay', 'hướng dẫn', 'quy định', 'chính sách'],
        status: 'published',
        metadata: {
            keywords: ['sổ tay', 'nhân viên', 'quy định', 'chính sách', 'phúc lợi'],
            documentNumber: 'HANDBOOK-001'
        }
    },
    {
        title: 'Quy chế làm việc công ty Khải Đỗ',
        content: `
        QUY CHẾ LÀM VIỆC CÔNG TY KHẢI ĐỖ

        1. THỜI GIAN LÀM VIỆC
        - Giờ làm việc: 8:00 - 17:00 (Thứ 2 - Thứ 6)
        - Nghỉ trưa: 12:00 - 13:00
        - Thứ 7: 8:00 - 12:00 (tùy theo dự án)

        2. QUY ĐỊNH VỀ TRANG PHỤC
        - Trang phục lịch sự, gọn gàng
        - Thứ 6: Casual Friday (trang phục thoải mái)
        - Các sự kiện quan trọng: Formal dress code

        3. QUY ĐỊNH VỀ NGHỈ PHÉP
        - Nhân viên được nghỉ phép 12 ngày/năm
        - Đăng ký nghỉ phép trước ít nhất 3 ngày
        - Nghỉ ốm: Cần có giấy xác nhận của bác sĩ

        4. QUY ĐỊNH VỀ CÔNG NGHỆ
        - Sử dụng email công ty cho công việc
        - Không truy cập các trang web không liên quan đến công việc
        - Bảo mật thông tin công ty

        5. QUY ĐỊNH VỀ HỌP
        - Đúng giờ tham gia họp
        - Tắt điện thoại hoặc chuyển chế độ im lặng
        - Chuẩn bị đầy đủ tài liệu trước khi họp
        `,
        category: 'company_policy',
        department: 'All',
        accessLevel: 'public',
        tags: ['quy chế', 'làm việc', 'chính sách'],
        status: 'published',
        metadata: {
            keywords: ['quy chế', 'làm việc', 'thời gian', 'trang phục', 'nghỉ phép'],
            documentNumber: 'QC-001'
        }
    },
    {
        title: 'Hướng dẫn sử dụng hệ thống IT',
        content: `
        HƯỚNG DẪN SỬ DỤNG HỆ THỐNG IT - CÔNG TY KHẢI ĐỖ

        1. ĐĂNG NHẬP HỆ THỐNG
        - Sử dụng email công ty làm username
        - Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số
        - Thay đổi mật khẩu mỗi 3 tháng

        2. EMAIL CÔNG TY
        - Kiểm tra email ít nhất 2 lần/ngày
        - Sử dụng chữ ký email chuẩn của công ty
        - Không gửi email cá nhân qua hệ thống công ty

        3. VPN VÀ BẢO MẬT
        - Sử dụng VPN khi làm việc từ xa
        - Không chia sẻ thông tin đăng nhập
        - Khóa máy tính khi rời khỏi chỗ làm việc

        4. BACKUP DỮ LIỆU
        - Backup dữ liệu quan trọng hàng tuần
        - Sử dụng Google Drive công ty để lưu trữ
        - Không lưu dữ liệu công ty trên thiết bị cá nhân

        5. HỖ TRỢ KỸ THUẬT
        - Liên hệ IT Helpdesk: ext 101
        - Email: it-support@khaido.com
        - Thời gian hỗ trợ: 8:00 - 17:00
        `,
        category: 'guidelines',
        department: 'IT',
        accessLevel: 'public',
        tags: ['IT', 'hệ thống', 'hướng dẫn', 'bảo mật'],
        status: 'published',
        metadata: {
            keywords: ['IT', 'hệ thống', 'đăng nhập', 'email', 'VPN', 'backup'],
            documentNumber: 'IT-001'
        }
    },
    {
        title: 'Quy trình tuyển dụng',
        content: `
        QUY TRÌNH TUYỂN DỤNG - PHÒNG NHÂN SỰ

        1. XÁC ĐỊNH NHU CẦU TUYỂN DỤNG
        - Phòng ban đề xuất nhu cầu tuyển dụng
        - HR xem xét và phê duyệt
        - Tạo job description chi tiết

        2. ĐĂNG TIN TUYỂN DỤNG
        - Đăng trên website công ty
        - Đăng trên các trang tuyển dụng: VietnamWorks, TopCV
        - Chia sẻ trên mạng xã hội công ty

        3. SÀNG LỌC HỒ SƠ
        - Thu thập và phân loại hồ sơ
        - Sàng lọc theo tiêu chí cơ bản
        - Liên hệ ứng viên phù hợp

        4. PHỎNG VẤN
        - Vòng 1: HR phỏng vấn sơ bộ
        - Vòng 2: Trưởng phòng phỏng vấn chuyên môn
        - Vòng 3: Giám đốc phỏng vấn cuối (nếu cần)

        5. QUYẾT ĐỊNH TUYỂN DỤNG
        - Đánh giá tổng hợp
        - Thương lượng lương và phúc lợi
        - Gửi thư mời làm việc

        6. ONBOARDING
        - Chuẩn bị workspace
        - Orientation về công ty
        - Training cơ bản
        `,
        category: 'procedures',
        department: 'HR',
        accessLevel: 'department',
        tags: ['tuyển dụng', 'HR', 'quy trình'],
        status: 'published',
        metadata: {
            keywords: ['tuyển dụng', 'phỏng vấn', 'onboarding', 'HR'],
            documentNumber: 'HR-001'
        }
    },
    {
        title: 'Báo cáo tài chính Q1 2024',
        content: `
        BÁO CÁO TÀI CHÍNH QUÝ 1/2024 - CÔNG TY KHẢI ĐỖ

        1. TỔNG QUAN
        - Doanh thu: 2.5 tỷ VNĐ (tăng 15% so với cùng kỳ)
        - Lợi nhuận: 450 triệu VNĐ (tăng 20% so với cùng kỳ)
        - Chi phí vận hành: 2.05 tỷ VNĐ

        2. PHÂN TÍCH DOANH THU
        - Dự án phần mềm: 1.8 tỷ VNĐ (72%)
        - Dịch vụ tư vấn: 500 triệu VNĐ (20%)
        - Bảo trì hệ thống: 200 triệu VNĐ (8%)

        3. CHI PHÍ CHÍNH
        - Lương và phúc lợi: 1.5 tỷ VNĐ
        - Chi phí văn phòng: 300 triệu VNĐ
        - Marketing: 150 triệu VNĐ
        - Khác: 100 triệu VNĐ

        4. DỰ BÁO Q2/2024
        - Doanh thu dự kiến: 2.8 tỷ VNĐ
        - Lợi nhuận dự kiến: 500 triệu VNĐ
        - Kế hoạch mở rộng: Tuyển thêm 10 nhân viên

        * Báo cáo chi tiết chỉ dành cho Ban Giám đốc
        `,
        category: 'reports',
        department: 'Finance',
        accessLevel: 'management',
        tags: ['tài chính', 'báo cáo', 'Q1 2024'],
        status: 'published',
        metadata: {
            keywords: ['tài chính', 'doanh thu', 'lợi nhuận', 'Q1 2024'],
            documentNumber: 'FIN-Q1-2024'
        }
    },
    {
        title: 'Kế hoạch bảo mật thông tin',
        content: `
        KẾ HOẠCH BẢO MẬT THÔNG TIN - CÔNG TY KHẢI ĐỖ

        1. MỤC TIÊU
        - Bảo vệ thông tin khách hàng và công ty
        - Tuân thủ các quy định về bảo mật
        - Nâng cao nhận thức bảo mật của nhân viên

        2. PHÂN LOẠI THÔNG TIN
        - Công khai: Thông tin marketing, website
        - Nội bộ: Quy chế, hướng dẫn làm việc
        - Bí mật: Thông tin khách hàng, tài chính
        - Tuyệt mật: Chiến lược kinh doanh, mã nguồn

        3. BIỆN PHÁP BẢO MẬT
        - Mã hóa dữ liệu quan trọng
        - Kiểm soát truy cập theo vai trò
        - Backup và khôi phục dữ liệu
        - Giám sát và audit hệ thống

        4. TRAINING BẢO MẬT
        - Đào tạo nhận thức bảo mật cho tất cả nhân viên
        - Kiểm tra định kỳ 6 tháng/lần
        - Cập nhật kiến thức về các mối đe dọa mới

        5. XỬ LÝ SỰ CỐ
        - Quy trình báo cáo sự cố bảo mật
        - Đội ứng phó sự cố 24/7
        - Phân tích và rút kinh nghiệm

        * Tài liệu mật - Chỉ dành cho cấp quản lý
        `,
        category: 'company_policy',
        department: 'IT',
        accessLevel: 'confidential',
        tags: ['bảo mật', 'thông tin', 'an ninh'],
        status: 'published',
        metadata: {
            keywords: ['bảo mật', 'thông tin', 'an ninh', 'mã hóa'],
            documentNumber: 'SEC-001'
        }
    }
];

async function seedDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual_assistant');
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await CompanyDocument.deleteMany({});
        console.log('Cleared existing data');

        // Create users
        const createdUsers = [];
        for (const userData of sampleUsers) {
            const user = new User(userData);
            await user.save();
            createdUsers.push(user);
            console.log(`Created user: ${user.email}`);
        }

        // Create documents with proper author references
        for (const docData of sampleDocuments) {
            // Assign random author from appropriate department or admin
            let author;
            if (docData.department === 'All') {
                author = createdUsers.find(u => u.role === 'admin');
            } else {
                author = createdUsers.find(u => u.department === docData.department && u.role !== 'employee') ||
                        createdUsers.find(u => u.role === 'admin');
            }

            const document = new CompanyDocument({
                ...docData,
                author: author._id,
                lastModifiedBy: author._id
            });

            await document.save();
            console.log(`Created document: ${document.title}`);
        }

        console.log('\n=== SEED DATA COMPLETED ===');
        console.log('\nSample login credentials:');
        console.log('Admin: admin@khaido.com / admin123');
        console.log('IT Manager: manager.it@khaido.com / manager123');
        console.log('HR Manager: manager.hr@khaido.com / manager123');
        console.log('IT Employee: employee.it@khaido.com / employee123');
        console.log('HR Employee: employee.hr@khaido.com / employee123');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

// Run the seed function
seedDatabase();

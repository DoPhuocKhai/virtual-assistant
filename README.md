# Trợ Lý Ảo Doanh Nghiệp - Công ty Khải Đỗ

Hệ thống trợ lý ảo thông minh được xây dựng riêng cho Công ty Khải Đỗ, giúp quản lý tài liệu, công việc và cuộc họp với tính năng phân quyền và bảo mật cao.

## Tính Năng Chính

- 🔐 Hệ thống xác thực và phân quyền người dùng
- 📄 Quản lý tài liệu công ty với các mức độ truy cập
- 🤖 Trợ lý ảo thông minh tích hợp AI (OpenAI GPT-4)
- 📅 Quản lý lịch họp và cuộc họp
- ✅ Quản lý công việc và nhiệm vụ
- 🔍 Tìm kiếm thông minh trong tài liệu công ty
- 🌙 Giao diện Dark mode
- 📱 Responsive trên mọi thiết bị

## Cấu Trúc Phân Quyền

### Vai trò người dùng
1. Admin
   - Quản lý toàn bộ hệ thống
   - Truy cập tất cả tài liệu
   - Tạo và quản lý tài khoản người dùng

2. Manager
   - Quản lý tài liệu phòng ban
   - Xem báo cáo quản lý
   - Tạo và quản lý cuộc họp

3. Employee
   - Xem tài liệu được phép
   - Tham gia cuộc họp
   - Quản lý công việc cá nhân

### Mức độ truy cập tài liệu
- Public: Tất cả nhân viên
- Department: Chỉ trong phòng ban
- Management: Cấp quản lý trở lên
- Confidential: Chỉ admin

## Cài Đặt

1. Clone repository:
```bash
git clone <repository-url>
cd virtual-assistant
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file môi trường:
```bash
cp .env.example .env
```

4. Cấu hình các biến môi trường trong file `.env`:
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
```

5. Seed dữ liệu mẫu:
```bash
node scripts/seedData.js
```

6. Khởi động server:
```bash
npm start
```

## Tài Khoản Mẫu

1. Admin
   - Email: admin@khaido.com
   - Password: admin123

2. IT Manager
   - Email: manager.it@khaido.com
   - Password: manager123

3. HR Manager
   - Email: manager.hr@khaido.com
   - Password: manager123

4. IT Employee
   - Email: employee.it@khaido.com
   - Password: employee123

5. HR Employee
   - Email: employee.hr@khaido.com
   - Password: employee123

## API Endpoints

### Authentication
- POST `/api/auth/login` - Đăng nhập
- POST `/api/auth/register` - Đăng ký (chỉ admin)
- GET `/api/auth/me` - Lấy thông tin người dùng
- POST `/api/auth/change-password` - Đổi mật khẩu

### Documents
- GET `/api/documents` - Lấy danh sách tài liệu
- POST `/api/documents` - Tạo tài liệu mới
- GET `/api/documents/:id` - Xem chi tiết tài liệu
- PATCH `/api/documents/:id` - Cập nhật tài liệu
- DELETE `/api/documents/:id` - Xóa tài liệu

### Assistant
- POST `/api/assistant/chat` - Tương tác với trợ lý ảo
- GET `/api/assistant/search` - Tìm kiếm thông tin

### Meetings & Tasks
- Các endpoint quản lý cuộc họp và công việc
- Chức năng đang được phát triển

## Công Nghệ Sử Dụng

- **Backend:**
  - Node.js & Express
  - MongoDB & Mongoose
  - JWT Authentication
  - OpenAI GPT-4

- **Frontend:**
  - HTML5 & CSS3
  - TailwindCSS
  - Vanilla JavaScript

## Bảo Mật

- JWT cho xác thực
- Mã hóa mật khẩu với bcrypt
- Phân quyền chi tiết theo vai trò
- Kiểm soát truy cập tài liệu
- Rate limiting cho API

## Phát Triển

1. Fork repository
2. Tạo branch mới (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## License

MIT License - xem [LICENSE](LICENSE) để biết thêm chi tiết.

## Liên Hệ

Nếu bạn có câu hỏi hoặc góp ý, vui lòng tạo issue trong repository hoặc liên hệ qua email: contact@khaido.com

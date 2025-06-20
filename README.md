# Trợ Lý Ảo Doanh Nghiệp - Công ty VNG

Hệ thống trợ lý ảo thông minh được xây dựng riêng cho Công ty Khải Đỗ, giúp quản lý tài liệu, công việc và cuộc họp với tính năng phân quyền và bảo mật cao.

## Tính Năng Chính

- 🔐 Hệ thống xác thực và phân quyền người dùng
- 📄 Quản lý tài liệu công ty với các mức độ truy cập
- 🤖 Trợ lý ảo thông minh tích hợp AI (Gemini 2.5 flash)
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

### Yêu cầu hệ thống
- Node.js (v14 trở lên)
- MongoDB (cài đặt local hoặc sử dụng MongoDB Atlas)

### Cài đặt MongoDB Local (khuyến nghị)

1. **Windows:**
   - Tải MongoDB Community Server từ: https://www.mongodb.com/try/download/community
   - Cài đặt và khởi động MongoDB service

2. **macOS:**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb/brew/mongodb-community
   ```

3. **Linux (Ubuntu):**
   ```bash
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   sudo systemctl start mongod
   ```

### Cài đặt ứng dụng

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
# Để trống để sử dụng MongoDB local, hoặc điền MongoDB Atlas URI
MONGODB_URI=

# JWT Secret key (tạo chuỗi ngẫu nhiên)
JWT_SECRET=your_jwt_secret_key_here

# Google Gemini API Key (thay thế OpenAI)
GEMINI_API_KEY=your_gemini_api_key_here
```

5. Thiết lập cơ sở dữ liệu và tạo tài khoản admin:
```bash
npm run setup
```

6. Khởi động server:
```bash
npm start
```

Hoặc chạy ở chế độ development:
```bash
npm run dev
```

### Kiểm tra cài đặt
- Truy cập: http://localhost:3000
- Đăng nhập với tài khoản admin mặc định:
  - Email: admin@company.com
  - Password: admin123

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

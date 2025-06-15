// MongoDB Queries for Virtual Assistant Application

// 1. Document Queries

// Tìm tất cả tài liệu của một phòng ban
db.documents.find({ department: "IT" })

// Tìm tài liệu theo từ khóa
db.documents.find({
    $or: [
        { title: { $regex: "keyword", $options: "i" } },
        { content: { $regex: "keyword", $options: "i" } },
        { tags: { $in: ["keyword"] } }
    ]
})

// Tìm tài liệu theo mức độ truy cập
db.documents.find({
    $or: [
        { accessLevel: "public" },
        {
            accessLevel: "department",
            department: "IT"
        }
    ]
})

// 2. Meeting Queries

// Tìm cuộc họp sắp tới
db.meetings.find({
    startTime: { $gte: new Date() },
    status: { $in: ["scheduled", "in_progress"] }
}).sort({ startTime: 1 })

// Tìm cuộc họp của một người dùng
db.meetings.find({
    $or: [
        { organizer: userId },
        { "participants.user": userId }
    ]
})

// Tìm cuộc họp theo phòng ban
db.meetings.find({
    department: "IT",
    startTime: {
        $gte: new Date(),
        $lte: new Date(new Date().setDate(new Date().getDate() + 7))
    }
})

// Thống kê cuộc họp theo trạng thái
db.meetings.aggregate([
    {
        $match: { department: "IT" }
    },
    {
        $group: {
            _id: "$status",
            count: { $sum: 1 }
        }
    }
])

// 3. Chat Queries

// Lấy tin nhắn giữa hai người dùng
db.chats.find({
    $or: [
        { sender: user1Id, receiver: user2Id },
        { sender: user2Id, receiver: user1Id }
    ]
}).sort({ createdAt: 1 })

// Lấy tin nhắn chứa từ khóa
db.chats.find({
    message: { $regex: "keyword", $options: "i" }
})

// 4. Task Queries

// Tìm task quá hạn
db.tasks.find({
    status: { $in: ["pending", "in_progress"] },
    dueDate: { $lt: new Date() }
})

// Thống kê task theo trạng thái và phòng ban
db.tasks.aggregate([
    {
        $match: { department: "IT" }
    },
    {
        $group: {
            _id: "$status",
            count: { $sum: 1 }
        }
    }
])

// 5. User Queries

// Tìm người dùng theo phòng ban
db.users.find({ department: "IT" })

// Thống kê người dùng theo vai trò
db.users.aggregate([
    {
        $group: {
            _id: "$role",
            count: { $sum: 1 }
        }
    }
])

// Ví dụ sử dụng trong Node.js với Mongoose:

/*
// 1. Tìm tài liệu
const docs = await CompanyDocument.find({
    department: "IT",
    accessLevel: { $in: ["public", "department"] }
}).populate('author');

// 2. Tạo cuộc họp
const meeting = new Meeting({
    title: "Họp team IT",
    description: "Weekly sync-up",
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    organizer: userId,
    participants: [{ user: participantId }],
    department: "IT"
});
await meeting.save();

// 3. Lưu tin nhắn chat
const chat = new Chat({
    sender: senderId,
    receiver: receiverId,
    message: "Nội dung tin nhắn",
    attachments: []
});
await chat.save();

// 4. Cập nhật trạng thái task
await Task.findByIdAndUpdate(taskId, {
    $set: {
        status: "completed",
        progress: 100
    }
});
*/

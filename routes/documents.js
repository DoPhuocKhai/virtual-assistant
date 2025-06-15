const express = require('express');
const router = express.Router();
const CompanyDocument = require('../models/CompanyDocument');
const { auth, checkPermission, checkRole } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// Process Word document
async function processWordDocument(filePath) {
    try {
        const buffer = await fs.readFile(filePath);
        const content = buffer.toString('utf8');
        return content;
    } catch (error) {
        throw new Error(`Error processing Word document: ${error.message}`);
    }
}

// Lấy danh sách tài liệu (có phân quyền)
router.get('/', auth, async (req, res) => {
    try {
        const { category, department, status, search } = req.query;
        const query = {};

        // Xây dựng query dựa trên filter
        if (category) query.category = category;
        if (status) query.status = status;
        
        // Tìm kiếm theo từ khóa
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'metadata.keywords': { $regex: search, $options: 'i' } }
            ];
        }

        // Phân quyền theo department và role
        if (req.user.role !== 'admin') {
            query.$or = [
                { accessLevel: 'public' },
                { 
                    accessLevel: 'department',
                    department: req.user.department
                }
            ];

            if (req.user.role === 'manager') {
                query.$or.push({ accessLevel: 'management' });
            }
        }

        if (department && (req.user.role === 'admin' || 
            (req.user.role === 'manager' && department === req.user.department))) {
            query.department = department;
        }

        const documents = await CompanyDocument.find(query)
            .populate('author', 'name department')
            .populate('lastModifiedBy', 'name department')
            .sort({ updatedAt: -1 });

        res.json({ documents });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể lấy danh sách tài liệu',
            message: error.message
        });
    }
});

// Tạo tài liệu mới
router.post('/', auth, checkPermission('edit_company_docs'), async (req, res) => {
    try {
        const document = new CompanyDocument({
            ...req.body,
            author: req.user._id,
            lastModifiedBy: req.user._id
        });

        // Kiểm tra quyền truy cập department
        if (req.user.role !== 'admin' && document.department !== req.user.department) {
            throw new Error('Bạn chỉ có thể tạo tài liệu cho phòng ban của mình');
        }

        await document.save();

        res.status(201).json({
            message: 'Tạo tài liệu thành công',
            document: await document.populate('author', 'name department')
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể tạo tài liệu',
            message: error.message
        });
    }
});

// Lấy chi tiết tài liệu
// Lấy nội dung tài liệu Word
router.get('/word/:filename', auth, async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '..', 'documents', filename);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            throw new Error('Tài liệu không tồn tại');
        }

        const content = await processWordDocument(filePath);
        
        res.json({ 
            filename,
            content,
            message: 'Đọc tài liệu thành công'
        });
    } catch (error) {
        res.status(404).json({
            error: 'Không thể đọc tài liệu',
            message: error.message
        });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const document = await CompanyDocument.findById(req.params.id)
            .populate('author', 'name department')
            .populate('lastModifiedBy', 'name department')
            .populate('versionHistory.modifiedBy', 'name department');

        if (!document) {
            throw new Error('Không tìm thấy tài liệu');
        }

        // Kiểm tra quyền truy cập
        if (!document.canAccess(req.user)) {
            throw new Error('Bạn không có quyền truy cập tài liệu này');
        }

        res.json({ document });
    } catch (error) {
        res.status(404).json({
            error: 'Không thể lấy thông tin tài liệu',
            message: error.message
        });
    }
});

// Cập nhật tài liệu
router.patch('/:id', auth, checkPermission('edit_company_docs'), async (req, res) => {
    try {
        const document = await CompanyDocument.findById(req.params.id);
        
        if (!document) {
            throw new Error('Không tìm thấy tài liệu');
        }

        // Kiểm tra quyền chỉnh sửa
        if (req.user.role !== 'admin' && document.department !== req.user.department) {
            throw new Error('Bạn chỉ có thể chỉnh sửa tài liệu trong phòng ban của mình');
        }

        // Lưu version history
        document.versionHistory.push({
            version: document.version + 1,
            modifiedBy: req.user._id,
            modifiedAt: new Date(),
            changes: req.body.changes || 'Cập nhật nội dung'
        });

        // Cập nhật thông tin
        const allowedUpdates = [
            'title', 'content', 'category', 'tags', 'accessLevel', 
            'status', 'expiryDate', 'metadata', 'attachments'
        ];
        
        const updates = Object.keys(req.body);
        updates.forEach(update => {
            if (allowedUpdates.includes(update)) {
                document[update] = req.body[update];
            }
        });

        document.version += 1;
        document.lastModifiedBy = req.user._id;
        await document.save();

        res.json({
            message: 'Cập nhật tài liệu thành công',
            document: await document.populate('lastModifiedBy', 'name department')
        });
    } catch (error) {
        res.status(400).json({
            error: 'Không thể cập nhật tài liệu',
            message: error.message
        });
    }
});

// Xóa tài liệu (chỉ admin)
router.delete('/:id', auth, checkRole(['admin']), async (req, res) => {
    try {
        const document = await CompanyDocument.findById(req.params.id);
        
        if (!document) {
            throw new Error('Không tìm thấy tài liệu');
        }

        await document.remove();

        res.json({
            message: 'Xóa tài liệu thành công'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Không thể xóa tài liệu',
            message: error.message
        });
    }
});

// Lấy lịch sử phiên bản
router.get('/:id/history', auth, async (req, res) => {
    try {
        const document = await CompanyDocument.findById(req.params.id)
            .populate('versionHistory.modifiedBy', 'name department');

        if (!document) {
            throw new Error('Không tìm thấy tài liệu');
        }

        // Kiểm tra quyền truy cập
        if (!document.canAccess(req.user)) {
            throw new Error('Bạn không có quyền truy cập tài liệu này');
        }

        res.json({
            history: document.versionHistory
        });
    } catch (error) {
        res.status(404).json({
            error: 'Không thể lấy lịch sử phiên bản',
            message: error.message
        });
    }
});

module.exports = router;

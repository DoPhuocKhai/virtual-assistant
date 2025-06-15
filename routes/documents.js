const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');
const { upload, deleteFile, getFileStream, getMimeType } = require('../utils/fileUpload');
const path = require('path');
const fs = require('fs');

// Get all documents with filtering
router.get('/', auth, async function(req, res) {
    try {
        const { category, search, department } = req.query;
        const user = req.user;
        
        // Build query based on user's access level and filters
        let query = {};
        
        // Access control based on user's department and role
        if (user.role !== 'admin' && user.department !== 'Operations') {
            query.$or = [
                { accessLevel: 'public' },
                { department: user.department },
                { department: 'All' },
                { author: user._id }
            ];
        }
        
        // Add category filter
        if (category) {
            query.category = category;
        }
        
        // Add department filter
        if (department && department !== 'All') {
            query.department = department;
        }
        
        // Add search filter
        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { content: { $regex: search, $options: 'i' } },
                    { tags: { $in: [new RegExp(search, 'i')] } }
                ]
            });
        }
        
        const documents = await Document.find(query)
            .populate('author', 'name email department')
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({ documents });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ message: 'Lỗi server khi tải tài liệu' });
    }
});

// Get single document by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id)
            .populate('author', 'name email department');
        
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }
        
        // Check access permissions
        const user = req.user;
        const hasAccess = 
            user.role === 'admin' ||
            user.department === 'Operations' ||
            document.accessLevel === 'public' ||
            document.department === user.department ||
            document.department === 'All' ||
            document.author._id.toString() === user._id.toString();
        
        if (!hasAccess) {
            return res.status(403).json({ message: 'Không có quyền truy cập tài liệu này' });
        }
        
        res.json({ document });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ message: 'Lỗi server khi tải tài liệu' });
    }
});

// Create new document
router.post('/', auth, async (req, res) => {
    try {
        const { title, category, department, accessLevel, content, tags, status } = req.body;
        
        // Validate required fields
        if (!title || !category || !department || !accessLevel || !content || !status) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }
        
        // Create new document
        const document = new Document({
            title,
            category,
            department,
            accessLevel,
            content,
            tags: tags || [],
            status,
            author: req.user._id,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await document.save();
        
        // Populate author info for response
        await document.populate('author', 'name email department');
        
        res.status(201).json({ 
            message: 'Tài liệu đã được tạo thành công',
            document 
        });
    } catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo tài liệu' });
    }
});

// Update document
router.put('/:id', auth, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }
        
        // Check if user can edit this document
        const user = req.user;
        const canEdit = 
            user.role === 'admin' ||
            user.department === 'Operations' ||
            document.author.toString() === user._id.toString();
        
        if (!canEdit) {
            return res.status(403).json({ message: 'Không có quyền chỉnh sửa tài liệu này' });
        }
        
        const { title, category, department, accessLevel, content, tags, status } = req.body;
        
        // Update document fields
        if (title) document.title = title;
        if (category) document.category = category;
        if (department) document.department = department;
        if (accessLevel) document.accessLevel = accessLevel;
        if (content) document.content = content;
        if (tags !== undefined) document.tags = tags;
        if (status) document.status = status;
        
        document.updatedAt = new Date();
        
        await document.save();
        await document.populate('author', 'name email department');
        
        res.json({ 
            message: 'Tài liệu đã được cập nhật thành công',
            document 
        });
    } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật tài liệu' });
    }
});

// Delete document
router.delete('/:id', auth, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }
        
        // Check if user can delete this document
        const user = req.user;
        const canDelete = 
            user.role === 'admin' ||
            user.department === 'Operations' ||
            document.author.toString() === user._id.toString();
        
        if (!canDelete) {
            return res.status(403).json({ message: 'Không có quyền xóa tài liệu này' });
        }
        
        // Delete associated files
        for (const attachment of document.attachments) {
            if (attachment.path) {
                await deleteFile(attachment.path);
            }
        }
        
        await Document.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'Tài liệu đã được xóa thành công' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa tài liệu' });
    }
});

// Upload file attachment to document
router.post('/:id/upload', auth, upload.single('file'), async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }
        
        // Check if user can edit this document
        const user = req.user;
        const canEdit = 
            user.role === 'admin' ||
            user.department === 'Operations' ||
            user.department === 'IT' ||
            document.author.toString() === user._id.toString();
        
        if (!canEdit) {
            return res.status(403).json({ message: 'Không có quyền upload file cho tài liệu này' });
        }
        
        if (!req.file) {
            return res.status(400).json({ message: 'Không có file được upload' });
        }
        
        // Create attachment object
        const attachment = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            uploadedBy: user._id,
            accessibleBy: []
        };
        
        // Set access permissions based on department
        if (user.department === 'Operations' || user.department === 'IT') {
            // Operations and IT can make files accessible to all
            attachment.accessibleBy = [];
        } else {
            // Other departments: only uploader, IT, and Operations can access
            attachment.accessibleBy = [user._id];
        }
        
        document.attachments.push(attachment);
        await document.save();
        
        res.json({ 
            message: 'File đã được upload thành công',
            attachment: {
                filename: attachment.filename,
                originalName: attachment.originalName,
                size: attachment.size,
                uploadedAt: attachment.uploadedAt
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Lỗi server khi upload file' });
    }
});

// Download file attachment
router.get('/:id/download/:attachmentId', auth, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id)
            .populate('attachments.uploadedBy', 'name department')
            .populate('attachments.accessibleBy', 'name department');
        
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }
        
        const attachment = document.attachments.id(req.params.attachmentId);
        if (!attachment) {
            return res.status(404).json({ message: 'Không tìm thấy file đính kèm' });
        }
        
        // Check access permissions
        const user = req.user;
        const canAccess = 
            user.department === 'Operations' ||
            user.department === 'IT' ||
            attachment.uploadedBy._id.toString() === user._id.toString() ||
            attachment.accessibleBy.some(userId => userId._id.toString() === user._id.toString()) ||
            document.accessLevel === 'public';
        
        if (!canAccess) {
            return res.status(403).json({ message: 'Không có quyền tải file này' });
        }
        
        // Check if file exists
        if (!fs.existsSync(attachment.path)) {
            return res.status(404).json({ message: 'File không tồn tại trên server' });
        }
        
        // Increment download count
        await document.incrementDownloadCount();
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
        res.setHeader('Content-Type', attachment.mimetype);
        
        // Stream file to response
        const fileStream = getFileStream(attachment.path);
        if (fileStream) {
            fileStream.pipe(res);
        } else {
            res.status(404).json({ message: 'Không thể đọc file' });
        }
        
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ message: 'Lỗi server khi tải file' });
    }
});

// Grant access to a user for a document
router.post('/:id/grant-access', auth, async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ message: 'User ID là bắt buộc' });
        }
        
        const document = await Document.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }
        
        // Only IT, Operations, and document author can grant access
        const user = req.user;
        const canGrantAccess = 
            user.department === 'Operations' ||
            user.department === 'IT' ||
            document.author.toString() === user._id.toString();
        
        if (!canGrantAccess) {
            return res.status(403).json({ message: 'Không có quyền cấp quyền truy cập' });
        }
        
        await document.grantAccess(userId);
        
        res.json({ message: 'Đã cấp quyền truy cập thành công' });
    } catch (error) {
        console.error('Error granting access:', error);
        res.status(500).json({ message: 'Lỗi server khi cấp quyền truy cập' });
    }
});

// Revoke access from a user for a document
router.post('/:id/revoke-access', auth, async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ message: 'User ID là bắt buộc' });
        }
        
        const document = await Document.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }
        
        // Only IT, Operations, and document author can revoke access
        const user = req.user;
        const canRevokeAccess = 
            user.department === 'Operations' ||
            user.department === 'IT' ||
            document.author.toString() === user._id.toString();
        
        if (!canRevokeAccess) {
            return res.status(403).json({ message: 'Không có quyền thu hồi quyền truy cập' });
        }
        
        await document.revokeAccess(userId);
        
        res.json({ message: 'Đã thu hồi quyền truy cập thành công' });
    } catch (error) {
        console.error('Error revoking access:', error);
        res.status(500).json({ message: 'Lỗi server khi thu hồi quyền truy cập' });
    }
});

// Search documents with enhanced permissions
router.get('/search', auth, async (req, res) => {
    try {
        const { q, category, department, limit = 20, skip = 0 } = req.query;
        
        if (!q) {
            return res.status(400).json({ message: 'Query parameter "q" là bắt buộc' });
        }
        
        const documents = await Document.searchDocuments(q, {
            category,
            department,
            limit: parseInt(limit),
            skip: parseInt(skip),
            user: req.user
        });
        
        res.json({ documents });
    } catch (error) {
        console.error('Error searching documents:', error);
        res.status(500).json({ message: 'Lỗi server khi tìm kiếm tài liệu' });
    }
});

// Get document categories
router.get('/meta/categories', auth, async (req, res) => {
    try {
        const categories = [
            { value: 'company_policy', label: 'Chính sách công ty' },
            { value: 'procedures', label: 'Quy trình' },
            { value: 'guidelines', label: 'Hướng dẫn' },
            { value: 'reports', label: 'Báo cáo' },
            { value: 'training', label: 'Đào tạo' },
            { value: 'templates', label: 'Mẫu biểu' },
            { value: 'contracts', label: 'Hợp đồng' },
            { value: 'hr_documents', label: 'Tài liệu HR' },
            { value: 'financial_documents', label: 'Tài liệu tài chính' },
            { value: 'meeting_minutes', label: 'Biên bản họp' }
        ];
        
        res.json({ categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;

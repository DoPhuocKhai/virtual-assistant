const mongoose = require('mongoose');

const CompanyDocumentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Tiêu đề tài liệu là bắt buộc'],
        trim: true
    },
    content: {
        type: String,
        required: [true, 'Nội dung tài liệu là bắt buộc']
    },
    category: {
        type: String,
        required: true,
        enum: [
            'company_policy',
            'procedures',
            'guidelines',
            'reports',
            'training',
            'templates',
            'contracts',
            'hr_documents',
            'financial_documents',
            'meeting_minutes'
        ]
    },
    department: {
        type: String,
        required: true,
        enum: ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations', 'All']
    },
    accessLevel: {
        type: String,
        required: true,
        enum: ['public', 'department', 'management', 'confidential'],
        default: 'public'
    },
    tags: [{
        type: String,
        trim: true
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    version: {
        type: Number,
        default: 1
    },
    versionHistory: [{
        version: Number,
        modifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        modifiedAt: Date,
        changes: String
    }],
    attachments: [{
        name: String,
        url: String,
        type: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    expiryDate: {
        type: Date
    },
    isTemplate: {
        type: Boolean,
        default: false
    },
    metadata: {
        keywords: [String],
        documentNumber: String,
        relatedDocuments: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CompanyDocument'
        }]
    }
}, {
    timestamps: true
});

// Indexes for better query performance
CompanyDocumentSchema.index({ category: 1 });
CompanyDocumentSchema.index({ department: 1 });
CompanyDocumentSchema.index({ accessLevel: 1 });
CompanyDocumentSchema.index({ status: 1 });
CompanyDocumentSchema.index({ tags: 1 });

// Virtual for checking if document is expired
CompanyDocumentSchema.virtual('isExpired').get(function() {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
});

// Method to check if user has access to document
CompanyDocumentSchema.methods.canAccess = function(user) {
    // Public documents are accessible to all active users
    if (this.accessLevel === 'public' && user.status === 'active') {
        return true;
    }

    // Department-level access
    if (this.accessLevel === 'department') {
        return this.department === user.department || user.role === 'admin';
    }

    // Management-level access
    if (this.accessLevel === 'management') {
        return ['admin', 'manager'].includes(user.role);
    }

    // Confidential documents - only admins
    if (this.accessLevel === 'confidential') {
        return user.role === 'admin';
    }

    return false;
};

// Static method to find accessible documents
CompanyDocumentSchema.statics.findAccessible = function(user) {
    const query = {
        status: 'published'
    };

    if (user.role !== 'admin') {
        query.$or = [
            { accessLevel: 'public' },
            { 
                accessLevel: 'department',
                department: user.department
            }
        ];

        if (user.role === 'manager') {
            query.$or.push({ accessLevel: 'management' });
        }
    }

    return this.find(query)
        .sort({ updatedAt: -1 })
        .populate('author', 'name department')
        .populate('lastModifiedBy', 'name department');
};

module.exports = mongoose.model('CompanyDocument', CompanyDocumentSchema);

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
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
        enum: ['All', 'IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations']
    },
    accessLevel: {
        type: String,
        required: true,
        enum: ['public', 'department', 'management', 'confidential'],
        default: 'public'
    },
    content: {
        type: String,
        required: true
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    status: {
        type: String,
        required: true,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    version: {
        type: Number,
        default: 1
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    lastViewedBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        viewedAt: {
            type: Date,
            default: Date.now
        }
    }],
    attachments: [{
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        accessibleBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    }],
    metadata: {
        fileSize: Number,
        wordCount: Number,
        readingTime: Number // in minutes
    }
}, {
    timestamps: true
});

// Indexes for better query performance
documentSchema.index({ title: 'text', content: 'text', tags: 'text' });
documentSchema.index({ category: 1, department: 1 });
documentSchema.index({ author: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ createdAt: -1 });

// Virtual for calculating reading time
documentSchema.virtual('estimatedReadingTime').get(function() {
    const wordsPerMinute = 200;
    const wordCount = this.content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
});

// Pre-save middleware to calculate metadata
documentSchema.pre('save', function(next) {
    if (this.isModified('content')) {
        const wordCount = this.content.split(/\s+/).length;
        this.metadata = {
            ...this.metadata,
            wordCount,
            readingTime: Math.ceil(wordCount / 200) // 200 words per minute
        };
    }
    next();
});

// Method to increment view count
documentSchema.methods.incrementViewCount = function(userId) {
    this.viewCount += 1;
    
    // Add to lastViewedBy if not already viewed by this user recently
    const recentView = this.lastViewedBy.find(
        view => view.user.toString() === userId.toString() && 
        Date.now() - view.viewedAt < 24 * 60 * 60 * 1000 // 24 hours
    );
    
    if (!recentView) {
        this.lastViewedBy.push({
            user: userId,
            viewedAt: new Date()
        });
        
        // Keep only last 10 viewers
        if (this.lastViewedBy.length > 10) {
            this.lastViewedBy = this.lastViewedBy.slice(-10);
        }
    }
    
    return this.save();
};

// Method to increment download count
documentSchema.methods.incrementDownloadCount = function() {
    this.downloadCount += 1;
    return this.save();
};

// Static method to get popular documents
documentSchema.statics.getPopularDocuments = function(limit = 10) {
    return this.find({ status: 'published' })
        .sort({ viewCount: -1, downloadCount: -1 })
        .limit(limit)
        .populate('author', 'name department');
};

// Static method to get recent documents
documentSchema.statics.getRecentDocuments = function(limit = 10) {
    return this.find({ status: 'published' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('author', 'name department');
};

// Static method to search documents
documentSchema.statics.searchDocuments = function(query, options = {}) {
    const {
        category,
        department,
        accessLevel,
        status = 'published',
        limit = 20,
        skip = 0,
        user
    } = options;
    
    let searchQuery = {
        status,
        $text: { $search: query }
    };
    
    if (category) searchQuery.category = category;
    
    // Access control based on user's department and role
    if (user.department !== 'Operations' && user.department !== 'IT') {
        // Regular users can only see:
        // 1. Public documents
        // 2. Their department's documents
        // 3. Documents they authored
        // 4. Documents where they are explicitly given access
        searchQuery.$or = [
            { accessLevel: 'public' },
            { department: user.department },
            { author: user._id },
            { 'attachments.accessibleBy': user._id }
        ];
    }
    // IT and Operations have full access
    
    return this.find(searchQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('author', 'name department')
        .populate('attachments.uploadedBy', 'name department')
        .populate('attachments.accessibleBy', 'name department');
};

// Method to check if user has access to document
documentSchema.methods.canAccess = function(user) {
    // IT and Operations have full access
    if (user.department === 'Operations' || user.department === 'IT') {
        return true;
    }
    
    // Check if user is the author
    if (this.author.toString() === user._id.toString()) {
        return true;
    }
    
    // Check if document is public
    if (this.accessLevel === 'public') {
        return true;
    }
    
    // Check if user is in the same department
    if (this.department === user.department) {
        return true;
    }
    
    // Check if user has explicit access to any attachments
    const hasAttachmentAccess = this.attachments.some(attachment => 
        attachment.accessibleBy.some(userId => 
            userId.toString() === user._id.toString()
        )
    );
    
    return hasAttachmentAccess;
};

// Method to grant access to a user
documentSchema.methods.grantAccess = function(userId) {
    this.attachments.forEach(attachment => {
        if (!attachment.accessibleBy.includes(userId)) {
            attachment.accessibleBy.push(userId);
        }
    });
    return this.save();
};

// Method to revoke access from a user
documentSchema.methods.revokeAccess = function(userId) {
    this.attachments.forEach(attachment => {
        attachment.accessibleBy = attachment.accessibleBy.filter(
            id => id.toString() !== userId.toString()
        );
    });
    return this.save();
};

module.exports = mongoose.model('Document', documentSchema);

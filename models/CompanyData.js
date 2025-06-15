const mongoose = require('mongoose');

const companyDataSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    tradingName: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        trim: true
    },
    founded: {
        type: String,
        trim: true
    },
    headquarters: {
        type: String,
        trim: true
    },
    keyPeople: [{
        type: String,
        trim: true
    }],
    industry: [{
        type: String,
        trim: true
    }],
    products: [{
        type: String,
        trim: true
    }],
    revenue: {
        type: String,
        trim: true
    },
    employees: {
        type: String,
        trim: true
    },
    website: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    history: {
        type: String,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    // News and recent information fields
    financialInfo: {
        type: String,
        default: ''
    },
    recentNews: {
        type: String,
        default: ''
    },
    achievements: {
        type: String,
        default: ''
    },
    partnerships: {
        type: String,
        default: ''
    },
    businessUpdates: {
        type: String,
        default: ''
    },
    newsLastCrawled: {
        type: Date
    },
    sourceUrl: {
        type: String,
        required: true
    },
    lastCrawled: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for text search
companyDataSchema.index({ 
    name: 'text', 
    description: 'text', 
    content: 'text',
    industry: 'text',
    products: 'text'
});

// Static method to get active company data
companyDataSchema.statics.getActiveCompanyData = function() {
    return this.findOne({ isActive: true }).sort({ lastCrawled: -1 });
};

// Method to format company info for chatbot context
companyDataSchema.methods.formatForContext = function() {
    return `
Thông tin về ${this.name}:
- Tên giao dịch: ${this.tradingName || 'N/A'}
- Loại hình: ${this.type || 'N/A'}
- Thành lập: ${this.founded || 'N/A'}
- Trụ sở: ${this.headquarters || 'N/A'}
- Ngành: ${this.industry.join(', ') || 'N/A'}
- Sản phẩm chính: ${this.products.slice(0, 5).join(', ') || 'N/A'}
- Số nhân viên: ${this.employees || 'N/A'}
- Website: ${this.website || 'N/A'}

Mô tả: ${this.description}

${this.history ? `Lịch sử: ${this.history.substring(0, 1000)}...` : ''}

${this.financialInfo ? `=== THÔNG TIN TÀI CHÍNH MỚI NHẤT ===\n${this.financialInfo}\n` : ''}

${this.achievements ? `=== THÀNH TỰU VÀ GIẢI THƯỞNG ===\n${this.achievements}\n` : ''}

${this.partnerships ? `=== ĐỐI TÁC VÀ HỢP TÁC ===\n${this.partnerships}\n` : ''}

${this.businessUpdates ? `=== CẬP NHẬT KINH DOANH ===\n${this.businessUpdates}\n` : ''}

${this.recentNews ? `=== TIN TỨC GẦN ĐÂY ===\n${this.recentNews}\n` : ''}
    `.trim();
};

module.exports = mongoose.model('CompanyData', companyDataSchema);

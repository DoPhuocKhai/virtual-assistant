const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email là bắt buộc'],
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Mật khẩu là bắt buộc'],
        minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự']
    },
    name: {
        type: String,
        required: [true, 'Tên là bắt buộc'],
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'employee'],
        default: 'employee'
    },
    department: {
        type: String,
        required: true,
        enum: ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations']
    },
    position: {
        type: String,
        required: true
    },
    permissions: [{
        type: String,
        enum: [
            'view_company_docs',
            'edit_company_docs',
            'manage_users',
            'view_reports',
            'manage_meetings',
            'manage_tasks'
        ]
    }],
    avatar: {
        type: String
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

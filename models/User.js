const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email không hợp lệ']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    department: {
        type: String,
        required: true,
        enum: ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations']
    },
    position: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        required: true,
        enum: ['admin', 'manager', 'employee'],
        default: 'employee'
    },
    permissions: [{
        type: String,
        enum: ['view_company_docs', 'edit_company_docs', 'manage_users', 'view_reports', 'manage_meetings', 'manage_tasks']
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    passwordResetAttempts: {
        type: Number,
        default: 0
    },
    lastPasswordReset: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    suspendedAt: {
        type: Date
    },
    suspendedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    suspensionReason: {
        type: String
    },
    suspensionEndDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Update lastLogin when user logs in
UserSchema.methods.updateLastLogin = function() {
    this.lastLogin = Date.now();
    return this.save();
};

// Track password reset attempts
UserSchema.methods.incrementResetAttempts = function() {
    this.passwordResetAttempts += 1;
    return this.save();
};

// Reset password reset attempts counter
UserSchema.methods.resetAttempts = function() {
    this.passwordResetAttempts = 0;
    this.lastPasswordReset = Date.now();
    return this.save();
};

// Check if user has exceeded maximum reset attempts
UserSchema.methods.hasExceededResetAttempts = function() {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_PERIOD = 30 * 60 * 1000; // 30 minutes

    if (this.passwordResetAttempts >= MAX_ATTEMPTS) {
        const timeSinceLastReset = Date.now() - (this.lastPasswordReset || 0);
        if (timeSinceLastReset < LOCKOUT_PERIOD) {
            return true;
        }
        // Reset attempts if lockout period has passed
        this.resetAttempts();
    }
    return false;
};

// Suspend user account
UserSchema.methods.suspend = function(suspendedBy, reason, endDate) {
    this.isSuspended = true;
    this.suspendedAt = Date.now();
    this.suspendedBy = suspendedBy;
    this.suspensionReason = reason;
    this.suspensionEndDate = endDate;
    return this.save();
};

// Unsuspend user account
UserSchema.methods.unsuspend = function() {
    this.isSuspended = false;
    this.suspendedAt = null;
    this.suspendedBy = null;
    this.suspensionReason = null;
    this.suspensionEndDate = null;
    return this.save();
};

// Check if user is currently suspended
UserSchema.methods.isCurrentlySuspended = function() {
    if (!this.isSuspended) return false;
    
    // Check if suspension has expired
    if (this.suspensionEndDate && new Date() > this.suspensionEndDate) {
        this.unsuspend();
        return false;
    }
    
    return true;
};

// Change password
UserSchema.methods.changePassword = function(newPassword) {
    this.password = newPassword;
    this.lastPasswordReset = Date.now();
    this.passwordResetAttempts = 0;
    return this.save();
};

// Pre-save middleware to handle email case and trimming
UserSchema.pre('save', function(next) {
    if (this.isModified('email')) {
        this.email = this.email.toLowerCase().trim();
    }
    if (this.isModified('name')) {
        this.name = this.name.trim();
    }
    if (this.isModified('position')) {
        this.position = this.position.trim();
    }
    next();
});

module.exports = mongoose.model('User', UserSchema);

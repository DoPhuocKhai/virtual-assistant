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

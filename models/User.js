const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Invalid email'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['superAdmin', 'admin', 'moderator'],
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  tokens: [{
    token: {
      type: String,
      required: true
    },
    ipAddress: String,
    userAgent: String,
    deviceId: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: '30d' // Auto-expire tokens after 30 days
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.tokens;
      return ret;
    }
  }
});

// Account locking for brute force protection
userSchema.virtual('isLocked').get(function() {
  return this.lockUntil && this.lockUntil > Date.now();
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods = {
  comparePassword: async function(candidatePassword) {
    if (this.isLocked) {
      throw new Error('Account temporarily locked');
    }
    return await bcrypt.compare(candidatePassword, this.password);
  },

  incrementLoginAttempts: async function() {
    const MAX_ATTEMPTS = 5;
    const LOCK_TIME = 15 * 60 * 1000; // 15 minutes
    
    if (this.lockUntil && this.lockUntil < Date.now()) {
      return await this.updateOne({
        $set: { loginAttempts: 1 },
        $unset: { lockUntil: 1 }
      });
    }

    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= MAX_ATTEMPTS) {
      updates.$set = { lockUntil: Date.now() + LOCK_TIME };
    }

    return await this.updateOne(updates);
  },

  resetLoginAttempts: async function() {
    return await this.updateOne({
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 }
    });
  }
};

module.exports = mongoose.model('User', userSchema);
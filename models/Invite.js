const mongoose = require('mongoose');
const validator = require('validator');
const crypto = require('crypto');

const inviteSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    validate: [validator.isEmail, 'Invalid email']
  },
  role: {
    type: String,
    enum: ['admin', 'moderator'],
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expires: '24h' }
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'accepted', 'expired', 'revoked'],
    default: 'pending'
  },
  usedAt: Date,
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.isExpired = doc.isExpired;
      return ret;
    }
  }
});

// Virtual for checking expiration status
inviteSchema.virtual('isExpired').get(function() {
  return this.expiresAt < Date.now();
});

// Indexes for faster queries
inviteSchema.index({ email: 1, status: 1 });
inviteSchema.index({ code: 1, status: 1 });

// Pre-save hook to update status if expired
inviteSchema.pre('save', function(next) {
  if (this.isExpired && this.status !== 'accepted') {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('Invite', inviteSchema);

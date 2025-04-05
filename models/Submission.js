const mongoose = require('mongoose');
const validator = require('validator');
const generateCode = require('../utils/generateCode.js');

const submissionSchema = new mongoose.Schema({
  projectName: { 
    type: String, 
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  description: { 
    type: String, 
    required: [true, 'Project description is required'],
    minlength: [50, 'Description should be at least 50 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  email: {
    type: String,
    validate: {
      validator: v => !v || validator.isEmail(v),
      message: 'Invalid email address'
    },
    lowercase: true,
    trim: true
  },
  socials: {
    x: { 
      type: String, 
      required: [true, 'X (Twitter) handle is required'],
      match: [/^\w{1,15}$/, 'Invalid X handle (1-15 letters/numbers)'],
      trim: true
    },
    telegram: { 
      type: String, 
      required: [true, 'Telegram handle is required'],
      match: [/^@[\w]{5,32}$/, 'Must start with @ and 5-32 characters'],
      trim: true
    },
    discord: { 
      type: String, 
      required: [true, 'Discord server is required'],
      match: [/^https?:\/\/discord\.gg\/[\w-]{2,}$/, 'Invalid Discord invite link'],
      trim: true
    },
    founderTg: {
      type: String,
      match: [/^@[\w]{5,32}$/, 'Must start with @ and 5-32 characters'],
      trim: true
    }
  },
  submissionCode: { 
    type: String, 
    unique: true,
    index: true,
    default: generateCode,
    uppercase: true
  },

  statusHistory: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now }
  }],
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  statusLocked: {
    type: Boolean,
    default: false
  },
  submittedAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Custom validation for contact methods
submissionSchema.pre('validate', function(next) {
  // Auto-format discord URL
  if (this.socials?.discord && !this.socials.discord.startsWith('http')) {
    this.socials.discord = `https://discord.gg/${this.socials.discord}`;
  }

  // Contact method validation
  if (!this.email && !this.socials?.founderTg) {
    this.invalidate('socials.founderTg', 'Either email or founder Telegram required');
  }
  
  next();
});

// Add text indexes for better search
submissionSchema.index({
  projectName: 'text',
  description: 'text'
});

module.exports = mongoose.model('Submission', submissionSchema);

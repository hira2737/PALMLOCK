/**
 * PALMLOCK — User Model
 * Includes authentication, role separation, and salted PIN storage.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address format']
    },
    phone: {
      type: String,
      trim: true,
      default: '+91 98765 43210'
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true
    },
    standardPinHash: {
      type: String,
      select: false
    },
    duressPinHash: {
      type: String,
      select: false
    },
    pinFailedAttempts: {
      type: Number,
      default: 0
    },
    pinLockUntil: {
      type: Date,
      default: null
    },
    visionLevel: {
      type: String,
      enum: ['total_blindness', 'low_vision', 'normal'],
      default: 'total_blindness'
    },
    balance: {
      type: Number,
      default: 5000.00,
      min: 0
    },
    settings: {
      audioSpeed: { type: Number, default: 1.0 },
      hapticIntensity: { type: String, default: 'high' },
      screenCurtain: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: Hash password if modified
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Instance method: Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Set Standard PIN
userSchema.methods.setStandardPin = async function (pin) {
  const salt = await bcrypt.genSalt(10);
  this.standardPinHash = await bcrypt.hash(pin, salt);
};

// Instance method: Set Duress PIN
userSchema.methods.setDuressPin = async function (pin) {
  const salt = await bcrypt.genSalt(10);
  this.duressPinHash = await bcrypt.hash(pin, salt);
};

// Instance method: Compare Standard PIN
userSchema.methods.compareStandardPin = async function (candidatePin) {
  if (!this.standardPinHash) return false;
  return bcrypt.compare(candidatePin, this.standardPinHash);
};

// Instance method: Compare Duress PIN
userSchema.methods.compareDuressPin = async function (candidatePin) {
  if (!this.duressPinHash) return false;
  return bcrypt.compare(candidatePin, this.duressPinHash);
};

// Instance method: Check if PIN entry is temporarily locked
userSchema.methods.isPinLocked = function () {
  return this.pinLockUntil && this.pinLockUntil > new Date();
};

// Instance method: Record failed PIN attempt with exponential lock
userSchema.methods.recordFailedPin = async function () {
  this.pinFailedAttempts += 1;
  if (this.pinFailedAttempts >= 5) {
    // Lock for 15 minutes after 5 consecutive failures
    this.pinLockUntil = new Date(Date.now() + 15 * 60 * 1000);
  } else if (this.pinFailedAttempts >= 3) {
    // Lock for 2 minutes after 3 consecutive failures
    this.pinLockUntil = new Date(Date.now() + 2 * 60 * 1000);
  }
  await this.save();
  return {
    attempts: this.pinFailedAttempts,
    locked: this.isPinLocked(),
    lockUntil: this.pinLockUntil
  };
};

// Instance method: Reset failed PIN attempts on successful verification
userSchema.methods.resetFailedPin = async function () {
  if (this.pinFailedAttempts > 0 || this.pinLockUntil) {
    this.pinFailedAttempts = 0;
    this.pinLockUntil = null;
    await this.save();
  }
};

module.exports = mongoose.model('User', userSchema);

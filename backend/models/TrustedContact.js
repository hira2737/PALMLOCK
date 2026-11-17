
/**
 * PALMLOCK — Touch Beyond Vision
 * Trusted Contact MongoDB Model
 *
 * Stores emergency guardians belonging to registered users.
 *
 * Features:
 * - User-specific trusted contacts
 * - Indian mobile number validation
 * - Primary and secondary guardian designation
 * - Simulated OTP verification
 * - OTP expiry support
 * - Emergency notification preferences
 * - Notification delivery status tracking
 * - Indexed contact retrieval
 *
 * IMPORTANT:
 * OTP verification is simulated in the current prototype.
 * No real SMS is delivered.
 */

const mongoose = require('mongoose');

const trustedContactSchema = new mongoose.Schema(
  {
    /* ========================================================
       CONTACT OWNERSHIP
    ======================================================== */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Contact owner is required'],
      index: true,
      immutable: true
    },

    /* ========================================================
       GUARDIAN INFORMATION
    ======================================================== */

    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
      minlength: [2, 'Contact name must have at least 2 characters'],
      maxlength: [100, 'Contact name cannot exceed 100 characters']
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,

      // Indian mobile numbers in international format.
      // Example: +919876543210
      match: [
        /^\+91[6-9]\d{9}$/,
        'Enter a valid Indian mobile number in +91XXXXXXXXXX format'
      ]
    },

    relationship: {
      type: String,
      trim: true,
      default: 'Guardian',
      maxlength: [
        60,
        'Relationship cannot exceed 60 characters'
      ]
    },

    /* ========================================================
       GUARDIAN PRIORITY
    ======================================================== */

    isPrimary: {
      type: Boolean,
      default: false
    },

    /* ========================================================
       EMERGENCY NOTIFICATION PREFERENCES
    ======================================================== */

    notifyOnDuress: {
      type: Boolean,
      default: true
    },

    /* ========================================================
       OTP VERIFICATION
    ======================================================== */

    verificationStatus: {
      type: String,
      enum: {
        values: ['pending', 'verified'],
        message: 'Invalid contact verification status'
      },
      default: 'pending',
      required: true
    },

    // Hidden from normal Mongoose queries.
    // Your contactRoutes.js explicitly selects these fields
    // when verifying an OTP.
    otpCode: {
      type: String,
      select: false,
      default: undefined
    },

    otpExpiresAt: {
      type: Date,
      select: false,
      default: undefined
    },

    /* ========================================================
       EMERGENCY NOTIFICATION TRACKING
    ======================================================== */

    notificationStatus: {
      type: String,
      enum: {
        values: [
          'idle',
          'sent',
          'delivered',
          'failed'
        ],
        message: 'Invalid notification status'
      },
      default: 'idle'
    },

    lastNotifiedAt: {
      type: Date,
      default: null
    }
  },

  /* ==========================================================
     SCHEMA OPTIONS
  ========================================================== */

  {
    timestamps: true,
    versionKey: '__v'
  }
);

/* ============================================================
   DATABASE INDEXES
============================================================ */

// Efficiently retrieve contacts belonging to one user,
// with the primary guardian first.
trustedContactSchema.index({
  userId: 1,
  isPrimary: -1,
  createdAt: 1
});

// Useful for looking up verified guardians during emergencies.
trustedContactSchema.index({
  userId: 1,
  verificationStatus: 1,
  isPrimary: -1
});

/* ============================================================
   MODEL EXPORT
============================================================ */

module.exports = mongoose.model(
  'TrustedContact',
  trustedContactSchema
);

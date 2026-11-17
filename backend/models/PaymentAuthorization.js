
/**
 * PALMLOCK — Payment Authorization Model
 *
 * Secure, short-lived, single-use authorization
 * for simulated QR payments.
 *
 * No real money is transferred.
 */

const mongoose = require('mongoose');

const paymentAuthorizationSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    merchantName: {
      type: String,
      required: true,
      trim: true
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1
    },

    paymentRequestId: {
      type: String,
      default: null
    },

    expiresAt: {
      type: Date,
      required: true
    },

    consumedAt: {
      type: Date,
      default: null
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    }
  },
  {
    timestamps: true
  }
);

/**
 * TTL Index
 *
 * MongoDB automatically removes authorization
 * documents 24 hours after their expiry.
 *
 * Important:
 * The payment routes must independently check
 * expiresAt before accepting authorization.
 */
paymentAuthorizationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 86400 }
);

module.exports = mongoose.model(
  'PaymentAuthorization',
  paymentAuthorizationSchema
);

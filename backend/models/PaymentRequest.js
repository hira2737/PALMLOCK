/**
 * PALMLOCK — Payment Request Model
 * Simulated QR bill / payment requests.
 */

const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema(
  {
    paymentRequestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    merchantId: {
      type: String,
      required: true,
      index: true
    },
    merchantName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'General'
    },
    upiId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    currency: {
      type: String,
      default: 'INR'
    },
    description: {
      type: String,
      default: 'Payment request'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'duress_intercepted', 'expired', 'failed'],
      default: 'pending'
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 mins default
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);

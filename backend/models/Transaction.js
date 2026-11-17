/**
 * PALMLOCK — Transaction Model
 * Records transactions, including covertly intercepted duress transactions.
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    reference: {
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
    userName: {
      type: String,
      default: 'Authorized User'
    },
    paymentRequestId: {
      type: String,
      default: null
    },
    merchantId: {
      type: String,
      default: null
    },
    merchantName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'General'
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
    status: {
      type: String,
      enum: ['completed', 'duress_intercepted', 'failed', 'cancelled'],
      default: 'completed',
      index: true
    },
    isDuress: {
      type: Boolean,
      default: false,
      index: true
    },
    authMethod: {
      type: String,
      enum: ['GESTURE_PIN', 'STANDARD_PIN', 'BIOMETRIC', 'EMERGENCY_OVERRIDE'],
      default: 'GESTURE_PIN'
    },
    notes: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);

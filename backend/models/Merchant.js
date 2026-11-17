/**
 * PALMLOCK — Merchant Model
 * Demo verified merchants for QR simulation and payment flow.
 */

const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema(
  {
    merchantId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: 'General'
    },
    upiId: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      default: 'Chennai, Tamil Nadu'
    },
    verified: {
      type: Boolean,
      default: true
    },
    suggestedAmount: {
      type: Number,
      default: 100.00
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Merchant', merchantSchema);

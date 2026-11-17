/**
 * PALMLOCK — Audit Log Model
 * Immutable record of administrative operations, security actions, and incident handlings.
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    performedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      name: {
        type: String,
        default: 'System'
      },
      role: {
        type: String,
        default: 'system'
      },
      ip: {
        type: String,
        default: '127.0.0.1'
      }
    },
    targetType: {
      type: String,
      enum: ['ALERT', 'USER', 'TRANSACTION', 'CONTACT', 'SECURITY', 'SYSTEM'],
      required: true,
      index: true
    },
    targetId: {
      type: String,
      default: null,
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

// Index for chronological querying
auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

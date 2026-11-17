
/**
 * PALMLOCK — Alert / Emergency Incident Model
 *
 * Stores emergency incidents, trusted-contact
 * notifications, acknowledgements, and escalation history.
 *
 * IMPORTANT:
 * "simulated" means no real SMS was sent.
 */

const mongoose = require('mongoose');

const {
  ALERT_SEVERITY,
  ALERT_STATUS,
  ALERT_TYPES
} = require('../config/constants');

const guardianSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrustedContact'
    },

    name: {
      type: String,
      default: ''
    },

    phone: {
      type: String,
      default: ''
    },

    relationship: {
      type: String,
      default: ''
    },

    isPrimary: {
      type: Boolean,
      default: false
    },

    notifiedAt: {
      type: Date,
      default: null
    },

    deliveryStatus: {
      type: String,
      enum: [
        'pending',
        'simulated',
        'sent',
        'delivered',
        'failed'
      ],
      default: 'pending'
    },

    acknowledgedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: true
  }
);

const alertSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },

    userName: {
      type: String,
      default: 'Unknown User'
    },

    userPhone: {
      type: String,
      default: ''
    },

    type: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      default: ALERT_TYPES.DURESS,
      index: true
    },

    severity: {
      type: String,
      enum: Object.values(ALERT_SEVERITY),
      default: ALERT_SEVERITY.CRITICAL,
      index: true
    },

    status: {
      type: String,
      enum: Object.values(ALERT_STATUS),
      default: ALERT_STATUS.ACTIVE,
      index: true
    },

    location: {
      lat: {
        type: Number,
        min: -90,
        max: 90,
        default: null
      },

      lng: {
        type: Number,
        min: -180,
        max: 180,
        default: null
      },

      accuracyMeters: {
        type: Number,
        min: 0,
        default: null
      },

      address: {
        type: String,
        default: 'Location unavailable'
      }
    },

    guardians: {
      type: [guardianSchema],
      default: []
    },

    escalationTier: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
      index: true
    },

    escalationTimestamps: {
      tier1At: {
        type: Date,
        default: Date.now
      },

      tier2At: {
        type: Date,
        default: null
      },

      tier3At: {
        type: Date,
        default: null
      }
    },

    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    acknowledgedByName: {
      type: String,
      default: null
    },

    acknowledgedAt: {
      type: Date,
      default: null
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    resolvedByName: {
      type: String,
      default: null
    },

    resolvedAt: {
      type: Date,
      default: null
    },

    resolutionNotes: {
      type: String,
      default: ''
    },

    notes: [
      {
        author: {
          type: String,
          required: true
        },

        authorId: {
          type: mongoose.Schema.Types.ObjectId
        },

        text: {
          type: String,
          required: true
        },

        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],

    timeline: [
      {
        event: {
          type: String,
          required: true
        },

        details: {
          type: String,
          default: ''
        },

        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],

    falseAlarm: {
      isFalseAlarm: {
        type: Boolean,
        default: false
      },

      verifiedAt: {
        type: Date,
        default: null
      },

      verifiedBy: {
        type: String,
        default: null
      },

      reason: {
        type: String,
        default: ''
      }
    }
  },
  {
    timestamps: true
  }
);

// Dashboard and escalation indexes
alertSchema.index({
  status: 1,
  createdAt: -1
});

alertSchema.index({
  escalationTier: 1,
  status: 1
});

module.exports = mongoose.model(
  'Alert',
  alertSchema
);


/**
 * PALMLOCK — Secure Emergency Alert Routes
 *
 * Emergency creation, trusted-contact notifications,
 * false-alarm handling and admin incident management.
 *
 * Real SMS delivery is NOT implemented.
 */

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const router = express.Router();

const { Alert, TrustedContact, User } = require('../models');
const { verifyToken, requireRole } = require('../middleware/auth');
const { broadcastToAdmins } = require('../sockets/socketHandler');
const { logAudit } = require('../services/auditService');
const { sendGuardianAlertSMS } = require('../services/notificationService');
const { isDbConnected } = require('../config/db');

const {
  ALERT_TYPES,
  ALERT_SEVERITY,
  ALERT_STATUS
} = require('../config/constants');

function requireDatabase(req, res, next) {
  if (!isDbConnected()) {
    return res.status(503).json({
      success: false,
      error: 'Emergency service temporarily unavailable.',
      retryable: true
    });
  }

  next();
}

function safeBroadcast(event, payload) {
  try {
    broadcastToAdmins(event, payload);
  } catch (error) {
    console.error('[ALERT] Broadcast failed:', error.message);
  }
}

async function safeAudit(data) {
  try {
    await logAudit(data);
  } catch (error) {
    console.error('[ALERT] Audit failed:', error.message);
  }
}

function getLocation(body = {}) {
  const source = body.location || body;

  const lat = Number(source.lat);
  const lng = Number(source.lng);

  if (
    source.lat === undefined ||
    source.lng === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return {
      lat: null,
      lng: null,
      accuracyMeters: null,
      address: 'Location unavailable'
    };
  }

  const accuracy = Number(source.accuracyMeters);

  return {
    lat,
    lng,
    accuracyMeters:
      Number.isFinite(accuracy) && accuracy >= 0
        ? accuracy
        : null,
    address:
      typeof source.address === 'string'
        ? source.address.slice(0, 300)
        : 'Location unavailable'
  };
}

function findAlertById(id) {
  const conditions = [{ incidentId: id }];

  if (mongoose.isValidObjectId(id)) {
    conditions.push({ _id: id });
  }

  return Alert.findOne({ $or: conditions });
}

function getNotificationStatus(result) {
  if (!result || !result.success) {
    return 'failed';
  }

  if (result.simulated || result.status === 'simulated') {
    return 'simulated';
  }

  return 'pending';
}

function newIncidentId() {
  return (
    'INC-' +
    new Date().getFullYear() +
    '-' +
    crypto.randomBytes(6).toString('hex').toUpperCase()
  );
}

async function notifyPrimaryContacts(alert, user) {
  const contacts = await TrustedContact.find({
    userId: user._id,
    isPrimary: true,
    notifyOnDuress: true,
    verificationStatus: 'verified'
  });

  for (const contact of contacts) {
    let result;

    try {
      result = await sendGuardianAlertSMS({
        guardian: contact,
        user: {
          name: user.name,
          phone: user.phone || ''
        },
        incident: {
          incidentId: alert.incidentId,
          escalationTier: 1
        },
        location: alert.location
      });
    } catch (error) {
      console.error(
        '[ALERT] Contact notification failed:',
        error.message
      );

      result = { success: false, status: 'failed' };
    }

    alert.guardians.push({
      contactId: contact._id,
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      isPrimary: true,
      notifiedAt: new Date(),
      deliveryStatus: getNotificationStatus(result)
    });
  }

  await alert.save();
}

async function createEmergency(req, res, next, type) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found.'
      });
    }

    const rawKey =
      req.get('X-Idempotency-Key') ||
      req.body.idempotencyKey;

    if (
      rawKey !== undefined &&
      (
        typeof rawKey !== 'string' ||
        rawKey.length > 128 ||
        rawKey.length < 8
      )
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid idempotency key.'
      });
    }

    // Scope retry keys to the authenticated user and event type.
    const idempotencyKey = rawKey
      ? crypto
          .createHash('sha256')
          .update(`${user._id}:${type}:${rawKey}`)
          .digest('hex')
      : undefined;

    if (idempotencyKey) {
      const existing = await Alert.findOne({ idempotencyKey });

      if (existing) {
        return res.json({
          success: true,
          deduplicated: true,
          incidentId: existing.incidentId,
          alert: existing
        });
      }
    }

    const incidentId = newIncidentId();

    let alert;

    try {
      alert = await Alert.create({
        incidentId,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        userId: user._id,
        userName: user.name,
        userPhone: user.phone || '',
        type,
        severity: ALERT_SEVERITY.CRITICAL,
        status: ALERT_STATUS.ACTIVE,
        escalationTier: 1,
        location: getLocation(req.body),
        guardians: [],
        timeline: [{
          event:
            type === ALERT_TYPES.DURESS
              ? 'Duress Alert Created'
              : 'Manual SOS Created',
          details: 'Authenticated emergency request recorded.',
          timestamp: new Date()
        }]
      });
    } catch (error) {
      if (error.code === 11000 && idempotencyKey) {
        const existing = await Alert.findOne({ idempotencyKey });

        if (existing) {
          return res.json({
            success: true,
            deduplicated: true,
            incidentId: existing.incidentId,
            alert: existing
          });
        }
      }

      throw error;
    }

    // Incident is persisted before notification attempts.
    safeBroadcast('incident:created', {
      incidentId,
      alert
    });

    try {
      await notifyPrimaryContacts(alert, user);
    } catch (error) {
      console.error(
        '[ALERT] Contact processing failed:',
        error.message
      );

      alert.timeline.push({
        event: 'Contact Notification Error',
        details: 'Some contact notifications could not be processed.',
        timestamp: new Date()
      });

      await alert.save().catch(console.error);
    }

    await safeAudit({
      action:
        type === ALERT_TYPES.DURESS
          ? 'DURESS_ALERT_CREATED'
          : 'MANUAL_SOS_CREATED',
      performedBy: {
        userId: user._id,
        name: user.name,
        role: 'user',
        ip: req.ip
      },
      targetType: 'ALERT',
      targetId: incidentId,
      details: {
        notificationMode: 'development_simulation'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Emergency incident recorded.',
      incidentId,
      alert,
      notificationMode: 'development_simulation'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/alerts/duress
 */
router.post(
  '/duress',
  verifyToken,
  requireDatabase,
  (req, res, next) =>
    createEmergency(req, res, next, ALERT_TYPES.DURESS)
);

/**
 * POST /api/alerts/sos
 */
router.post(
  '/sos',
  verifyToken,
  requireDatabase,
  (req, res, next) =>
    createEmergency(req, res, next, ALERT_TYPES.SOS)
);

/**
 * POST /api/alerts/false-alarm
 *
 * Only the incident owner can cancel their alert.
 * PIN re-verification must be enforced separately
 * before production use.
 */
router.post(
  '/false-alarm',
  verifyToken,
  requireDatabase,
  async (req, res, next) => {
    try {
      const { incidentId, reason } = req.body;

      if (
        typeof incidentId !== 'string' ||
        !incidentId.trim()
      ) {
        return res.status(400).json({
          success: false,
          error: 'incidentId is required.'
        });
      }

      const alert = await Alert.findOne({
        incidentId,
        userId: req.user.id
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Incident not found.'
        });
      }

      if (alert.status === ALERT_STATUS.RESOLVED) {
        return res.status(409).json({
          success: false,
          error: 'Incident is already resolved.'
        });
      }

      const user = await User.findById(req.user.id);

      const safeReason =
        typeof reason === 'string' && reason.trim()
          ? reason.trim().slice(0, 500)
          : 'Accidental activation reported';

      const now = new Date();

      alert.status = ALERT_STATUS.RESOLVED;
      alert.resolvedAt = now;
      alert.resolvedByName = user?.name || 'User';
      alert.resolutionNotes = safeReason;

      alert.falseAlarm = {
        isFalseAlarm: true,
        verifiedAt: now,
        verifiedBy: user?.name || 'User',
        reason: safeReason
      };

      alert.timeline.push({
        event: 'False Alarm Reported',
        details: safeReason,
        timestamp: now
      });

      await alert.save();

      safeBroadcast('incident:false_alarm', {
        incidentId,
        alert
      });

      await safeAudit({
        action: 'FALSE_ALARM_REPORTED',
        performedBy: {
          userId: req.user.id,
          name: user?.name || 'User',
          role: 'user',
          ip: req.ip
        },
        targetType: 'ALERT',
        targetId: incidentId,
        details: { reason: safeReason }
      });

      return res.json({
        success: true,
        message: 'False alarm recorded.',
        alert
      });
    } catch (error) {
      next(error);
    }
  }
);

// All routes below require administrator access.
router.use(
  '/admin',
  verifyToken,
  requireRole('admin'),
  requireDatabase
);

/**
 * GET /api/admin/alerts
 */
router.get('/admin/alerts', async (req, res, next) => {
  try {
    const {
      status,
      severity,
      tier,
      search
    } = req.query;

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 50)
    );

    const skip = Math.max(
      0,
      Number(req.query.skip) || 0
    );

    const query = {};

    if (status) query.status = status;
    if (severity) query.severity = severity;

    if (tier) {
      const parsedTier = Number(tier);

      if (![1, 2, 3].includes(parsedTier)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid escalation tier.'
        });
      }

      query.escalationTier = parsedTier;
    }

    if (typeof search === 'string' && search.trim()) {
      const escaped = search
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      query.$or = [
        { incidentId: { $regex: escaped, $options: 'i' } },
        { userName: { $regex: escaped, $options: 'i' } },
        { userPhone: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [total, alerts] = await Promise.all([
      Alert.countDocuments(query),
      Alert.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.json({
      success: true,
      total,
      alerts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/alerts/:id
 */
router.get('/admin/alerts/:id', async (req, res, next) => {
  try {
    const alert = await findAlertById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found.'
      });
    }

    res.json({ success: true, alert });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/alerts/:id/acknowledge
 */
router.post(
  '/admin/alerts/:id/acknowledge',
  async (req, res, next) => {
    try {
      const alert = await findAlertById(req.params.id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Incident not found.'
        });
      }

      if (alert.status === ALERT_STATUS.RESOLVED) {
        return res.status(409).json({
          success: false,
          error: 'Resolved incidents cannot be acknowledged.'
        });
      }

      if (alert.acknowledgedAt) {
        return res.json({
          success: true,
          message: 'Incident already acknowledged.',
          alert
        });
      }

      const user = await User.findById(req.user.id);

      const adminName = user?.name || 'Security Operator';
      const now = new Date();

      alert.status = ALERT_STATUS.ACKNOWLEDGED;
      alert.acknowledgedBy = req.user.id;
      alert.acknowledgedByName = adminName;
      alert.acknowledgedAt = now;

      alert.timeline.push({
        event: 'Incident Acknowledged',
        details: `Acknowledged by ${adminName}`,
        timestamp: now
      });

      await alert.save();

      safeBroadcast('incident:acknowledged', {
        incidentId: alert.incidentId,
        adminName,
        alert
      });

      await safeAudit({
        action: 'INCIDENT_ACKNOWLEDGED',
        performedBy: {
          userId: req.user.id,
          name: adminName,
          role: 'admin',
          ip: req.ip
        },
        targetType: 'ALERT',
        targetId: alert.incidentId
      });

      res.json({
        success: true,
        message: 'Incident acknowledged.',
        alert
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/admin/alerts/:id/status
 */
router.patch(
  '/admin/alerts/:id/status',
  async (req, res, next) => {
    try {
      const { status, resolutionNotes } = req.body;

      if (!Object.values(ALERT_STATUS).includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid incident status.'
        });
      }

      const alert = await findAlertById(req.params.id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Incident not found.'
        });
      }

      if (alert.status === ALERT_STATUS.RESOLVED) {
        return res.status(409).json({
          success: false,
          error: 'Resolved incidents cannot be reopened here.'
        });
      }

      const user = await User.findById(req.user.id);
      const adminName = user?.name || 'Security Operator';

      alert.status = status;

      if (status === ALERT_STATUS.RESOLVED) {
        alert.resolvedAt = new Date();
        alert.resolvedBy = req.user.id;
        alert.resolvedByName = adminName;
        alert.resolutionNotes =
          typeof resolutionNotes === 'string'
            ? resolutionNotes.slice(0, 1000)
            : '';
      }

      alert.timeline.push({
        event: `Status Changed to ${status.toUpperCase()}`,
        details: `Updated by ${adminName}`,
        timestamp: new Date()
      });

      await alert.save();

      safeBroadcast('incident:status_changed', {
        incidentId: alert.incidentId,
        status,
        alert
      });

      res.json({
        success: true,
        message: 'Incident status updated.',
        alert
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/alerts/:id/notes
 */
router.post(
  '/admin/alerts/:id/notes',
  async (req, res, next) => {
    try {
      const { text } = req.body;

      if (
        typeof text !== 'string' ||
        !text.trim() ||
        text.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          error: 'A note of 1–2000 characters is required.'
        });
      }

      const alert = await findAlertById(req.params.id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Incident not found.'
        });
      }

      const user = await User.findById(req.user.id);

      alert.notes.push({
        author: user?.name || 'Security Operator',
        authorId: req.user.id,
        text: text.trim(),
        timestamp: new Date()
      });

      await alert.save();

      res.json({
        success: true,
        message: 'Response note added.',
        notes: alert.notes
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

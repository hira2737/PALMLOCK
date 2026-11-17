
/**
 * PALMLOCK — Emergency Escalation Service
 *
 * Tier 1: Initial emergency notification
 * Tier 2: Secondary contact escalation after 5 minutes
 * Tier 3: Critical admin escalation after 10 minutes
 *
 * Development SMS notifications are simulations.
 * No automatic police dispatch is performed.
 */

const { Alert, TrustedContact } = require('../models');
const { ALERT_STATUS } = require('../config/constants');
const { broadcastToAdmins } = require('../sockets/socketHandler');
const { logAudit } = require('./auditService');
const { sendGuardianAlertSMS } = require('./notificationService');
const { isDbConnected } = require('../config/db');

const TIER_2_THRESHOLD_MS = 5 * 60 * 1000;
const TIER_3_THRESHOLD_MS = 10 * 60 * 1000;

let escalationInterval = null;
let checkInProgress = false;

function hasAcknowledgement(alert) {
  if (alert.status === ALERT_STATUS.ACKNOWLEDGED) {
    return true;
  }

  if (alert.acknowledgedAt) {
    return true;
  }

  if (Array.isArray(alert.guardians)) {
    return alert.guardians.some((guardian) =>
      Boolean(guardian.acknowledgedAt)
    );
  }

  return false;
}

function notificationStatus(result) {
  if (!result || !result.success) {
    return 'failed';
  }

  if (result.simulated || result.status === 'simulated') {
    return 'simulated';
  }

  // A successful provider request does not prove delivery.
  return 'pending';
}

async function safeAudit(event) {
  try {
    await logAudit(event);
  } catch (error) {
    console.error(
      '[ESCALATION] Audit logging failed:',
      error.message
    );
  }
}

function safeBroadcast(eventName, payload) {
  try {
    broadcastToAdmins(eventName, payload);
  } catch (error) {
    console.error(
      '[ESCALATION] Dashboard broadcast failed:',
      error.message
    );
  }
}

async function notifySecondaryContacts(alert, now) {
  if (!alert.userId) {
    return;
  }

  const contacts = await TrustedContact.find({
    userId: alert.userId,
    isPrimary: false,
    notifyOnDuress: true,
    verificationStatus: 'verified'
  });

  if (!Array.isArray(alert.guardians)) {
    alert.guardians = [];
  }

  for (const contact of contacts) {
    const alreadyRecorded = alert.guardians.some(
      (guardian) =>
        String(guardian.contactId) === String(contact._id)
    );

    if (alreadyRecorded) {
      continue;
    }

    let result;

    try {
      result = await sendGuardianAlertSMS({
        guardian: contact,
        user: {
          name: alert.userName,
          phone: alert.userPhone
        },
        incident: {
          incidentId: alert.incidentId,
          escalationTier: 2
        },
        location: alert.location
      });
    } catch (error) {
      console.error(
        '[ESCALATION] Secondary notification failed:',
        error.message
      );

      result = {
        success: false,
        status: 'failed'
      };
    }

    alert.guardians.push({
      contactId: contact._id,
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      isPrimary: false,
      notifiedAt: now,
      deliveryStatus: notificationStatus(result)
    });
  }
}

async function escalateToTier2(alert, now, elapsedMs) {
  alert.escalationTier = 2;

  if (!alert.escalationTimestamps) {
    alert.escalationTimestamps = {};
  }

  alert.escalationTimestamps.tier2At = now;
  alert.status = ALERT_STATUS.ESCALATED;

  alert.timeline.push({
    event: 'Tier 2 Escalation',
    details:
      'Five minutes elapsed without acknowledgement. ' +
      'Secondary trusted contact notification attempted.',
    timestamp: now
  });

  await notifySecondaryContacts(alert, now);
  await alert.save();

  safeBroadcast('incident:escalated', {
    incidentId: alert.incidentId,
    tier: 2,
    alert
  });

  await safeAudit({
    action: 'INCIDENT_ESCALATED_TIER_2',
    targetType: 'ALERT',
    targetId: alert.incidentId,
    details: {
      incidentId: alert.incidentId,
      elapsedMinutes: Math.round(elapsedMs / 60000),
      notificationMode: 'development_simulation'
    }
  });

  console.log(
    `[ESCALATION] ${alert.incidentId} escalated to Tier 2.`
  );
}

async function escalateToTier3(alert, now, elapsedMs) {
  alert.escalationTier = 3;

  if (!alert.escalationTimestamps) {
    alert.escalationTimestamps = {};
  }

  alert.escalationTimestamps.tier3At = now;
  alert.status = ALERT_STATUS.ESCALATED;

  alert.timeline.push({
    event: 'Tier 3 Critical Escalation',
    details:
      'Ten minutes elapsed without acknowledgement. ' +
      'Critical administrator intervention required. ' +
      'No automatic emergency-service dispatch performed.',
    timestamp: now
  });

  await alert.save();

  safeBroadcast('incident:escalated', {
    incidentId: alert.incidentId,
    tier: 3,
    critical: true,
    alert
  });

  await safeAudit({
    action: 'INCIDENT_ESCALATED_TIER_3',
    targetType: 'ALERT',
    targetId: alert.incidentId,
    details: {
      incidentId: alert.incidentId,
      elapsedMinutes: Math.round(elapsedMs / 60000),
      requiresHumanResponse: true
    }
  });

  console.log(
    `[ESCALATION] ${alert.incidentId} escalated to Tier 3 CRITICAL.`
  );
}

async function checkAndEscalateAlerts(referenceDate = new Date()) {
  if (!isDbConnected()) {
    return {
      evaluated: 0,
      escalated: 0,
      reason: 'database_unavailable'
    };
  }

  if (checkInProgress) {
    return {
      evaluated: 0,
      escalated: 0,
      reason: 'check_already_running'
    };
  }

  const now = new Date(referenceDate);

  if (Number.isNaN(now.getTime())) {
    throw new Error('Invalid escalation reference date.');
  }

  checkInProgress = true;

  let evaluated = 0;
  let escalated = 0;
  let failed = 0;

  try {
    const pendingAlerts = await Alert.find({
      status: {
        $in: [
          ALERT_STATUS.ACTIVE,
          ALERT_STATUS.ESCALATED
        ]
      },
      escalationTier: { $lt: 3 },
      'falseAlarm.isFalseAlarm': { $ne: true }
    });

    for (const alert of pendingAlerts) {
      evaluated++;

      try {
        if (hasAcknowledgement(alert)) {
          continue;
        }

        const createdAt = new Date(alert.createdAt);
        const elapsedMs =
          now.getTime() - createdAt.getTime();

        if (
          !Number.isFinite(elapsedMs) ||
          elapsedMs < 0
        ) {
          continue;
        }

        // Catch up directly to Tier 3 after a restart
        // when the incident is already 10+ minutes old.
        if (elapsedMs >= TIER_3_THRESHOLD_MS) {
          if (alert.escalationTier === 1) {
            await escalateToTier2(
              alert,
              now,
              elapsedMs
            );

            escalated++;
          }

          if (alert.escalationTier === 2) {
            await escalateToTier3(
              alert,
              now,
              elapsedMs
            );

            escalated++;
          }
        } else if (
          elapsedMs >= TIER_2_THRESHOLD_MS &&
          alert.escalationTier === 1
        ) {
          await escalateToTier2(
            alert,
            now,
            elapsedMs
          );

          escalated++;
        }
      } catch (error) {
        failed++;

        console.error(
          `[ESCALATION] Incident ${alert.incidentId} failed:`,
          error.message
        );
      }
    }

    return {
      evaluated,
      escalated,
      failed
    };
  } catch (error) {
    console.error(
      '[ESCALATION SERVICE ERROR]',
      error.message
    );

    return {
      evaluated,
      escalated,
      failed,
      error: error.message
    };
  } finally {
    checkInProgress = false;
  }
}

function startEscalationScheduler(intervalMs = 30000) {
  if (
    !Number.isFinite(intervalMs) ||
    intervalMs < 1000
  ) {
    throw new Error(
      'Escalation scheduler interval must be at least 1000ms.'
    );
  }

  stopEscalationScheduler();

  escalationInterval = setInterval(() => {
    checkAndEscalateAlerts().catch((error) => {
      console.error(
        '[ESCALATION SCHEDULER TICK ERROR]',
        error.message
      );
    });
  }, intervalMs);

  console.log(
    `[ESCALATION] Scheduler started. ` +
    `Checking every ${intervalMs / 1000}s ` +
    `for 5m/10m escalation triggers.`
  );
}

function stopEscalationScheduler() {
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;

    console.log('[ESCALATION] Scheduler stopped.');
  }
}

module.exports = {
  checkAndEscalateAlerts,
  startEscalationScheduler,
  stopEscalationScheduler,
  TIER_2_THRESHOLD_MS,
  TIER_3_THRESHOLD_MS
};

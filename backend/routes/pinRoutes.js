
/**
 * PALMLOCK — Secure Gesture PIN Routes
 *
 * POST /api/pin/setup
 * POST /api/pin/verify
 *
 * Simulated payments only.
 */

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const router = express.Router();

const {
  User,
  Alert,
  Transaction,
  TrustedContact,
  PaymentRequest
} = require('../models');

const PaymentAuthorization = require(
  '../models/PaymentAuthorization'
);

const { verifyToken } = require('../middleware/auth');
const { pinLimiter } = require('../middleware/rateLimiter');
const { isDbConnected } = require('../config/db');

const {
  ALERT_TYPES,
  ALERT_SEVERITY,
  ALERT_STATUS
} = require('../config/constants');

const {
  broadcastToAdmins
} = require('../sockets/socketHandler');

const { logAudit } = require('../services/auditService');

const {
  sendGuardianAlertSMS
} = require('../services/notificationService');

const MAX_PAYMENT = 100000;
const AUTHORIZATION_TTL_MS = 120000;

function requireDatabase(req, res, next) {
  if (!isDbConnected()) {
    return res.status(503).json({
      success: false,
      error: 'Security service unavailable.'
    });
  }

  next();
}

function validPin(pin) {
  return (
    typeof pin === 'string' &&
    /^\d{4}$/.test(pin)
  );
}

function amountToPaise(value) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_PAYMENT
  ) {
    return null;
  }

  const paise = Math.round(value * 100);

  if (Math.abs(value * 100 - paise) > 1e-6) {
    return null;
  }

  return paise;
}

function locationOrNull(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    value.lat == null ||
    value.lng == null
  ) {
    return null;
  }

  const lat = Number(value.lat);
  const lng = Number(value.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }

  const accuracy = Number(
    value.accuracyMeters
  );

  return {
    lat,
    lng,
    accuracyMeters:
      Number.isFinite(accuracy) &&
      accuracy >= 0
        ? accuracy
        : null,
    address:
      typeof value.address === 'string'
        ? value.address.slice(0, 300)
        : ''
  };
}

async function getUser(req, includePassword = false) {
  const userId = req.user?.id;

  if (!mongoose.isValidObjectId(userId)) {
    return null;
  }

  return User.findById(userId).select(
    includePassword
      ? '+standardPinHash +duressPinHash +password'
      : '+standardPinHash +duressPinHash'
  );
}

async function safeAudit(event) {
  try {
    await logAudit(event);
  } catch (error) {
    console.error(
      '[PIN AUDIT]',
      error.message
    );
  }
}

function normalizeMerchantName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim();

  return name && name.length <= 150
    ? name
    : null;
}

function createIncidentId() {
  return (
    `INC-${Date.now()}-` +
    crypto.randomBytes(4).toString('hex')
  ).toUpperCase();
}

function sendDuressResponse(res) {
  return res.status(504).json({
    success: false,
    error:
      'Payment gateway timeout. No payment was completed.',
    code: 'GATEWAY_TIMEOUT'
  });
}

router.use(verifyToken, requireDatabase);

/* ============================================================
   PIN SETUP
============================================================ */

router.post(
  '/setup',
  pinLimiter,
  async (req, res, next) => {
    try {
      const {
        standardPin,
        duressPin,
        currentPassword
      } = req.body || {};

      if (
        standardPin === undefined &&
        duressPin === undefined
      ) {
        return res.status(400).json({
          success: false,
          error: 'At least one PIN is required.'
        });
      }

      if (
        (standardPin !== undefined &&
          !validPin(standardPin)) ||
        (duressPin !== undefined &&
          !validPin(duressPin))
      ) {
        return res.status(400).json({
          success: false,
          error: 'PIN must contain exactly four digits.'
        });
      }

      const user = await getUser(req, true);

      if (!user || user.role !== 'user') {
        return res.status(403).json({
          success: false,
          error: 'User account required.'
        });
      }

      const hasExistingPin =
        Boolean(user.standardPinHash) ||
        Boolean(user.duressPinHash);

      if (hasExistingPin) {
        if (
          typeof currentPassword !== 'string' ||
          !currentPassword
        ) {
          return res.status(403).json({
            success: false,
            error:
              'Current password required to change existing PINs.'
          });
        }

        const passwordMatches =
          await user.comparePassword(currentPassword);

        if (!passwordMatches) {
          return res.status(403).json({
            success: false,
            error: 'Current password is incorrect.'
          });
        }
      }

      if (
        standardPin !== undefined &&
        duressPin !== undefined &&
        standardPin === duressPin
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Normal and duress PINs must differ.'
        });
      }

      if (
        standardPin !== undefined &&
        duressPin === undefined &&
        user.duressPinHash &&
        await user.compareDuressPin(standardPin)
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Normal PIN cannot equal the existing duress PIN.'
        });
      }

      if (
        duressPin !== undefined &&
        standardPin === undefined &&
        user.standardPinHash &&
        await user.compareStandardPin(duressPin)
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Duress PIN cannot equal the existing normal PIN.'
        });
      }

      if (standardPin !== undefined) {
        await user.setStandardPin(standardPin);
      }

      if (duressPin !== undefined) {
        await user.setDuressPin(duressPin);
      }

      await user.save();

      // Revoke any unconsumed authorizations.
      await PaymentAuthorization.updateMany(
        {
          userId: user._id,
          consumedAt: null
        },
        {
          $set: {
            consumedAt: new Date()
          }
        }
      );

      await safeAudit({
        action: 'PIN_UPDATED',
        performedBy: {
          userId: user._id,
          role: user.role
        },
        targetType: 'SECURITY',
        targetId: user._id
      });

      return res.json({
        success: true,
        message:
          'Security PIN configuration saved.'
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ============================================================
   PIN VERIFICATION
============================================================ */

router.post(
  '/verify',
  pinLimiter,
  async (req, res, next) => {
    try {
      const {
        pin,
        merchantName,
        amount,
        paymentRequestId,
        location
      } = req.body || {};

      if (!validPin(pin)) {
        return res.status(400).json({
          success: false,
          error:
            'A valid four-digit gesture PIN is required.'
        });
      }

      const user = await getUser(req);

      if (!user || user.role !== 'user') {
        return res.status(403).json({
          success: false,
          error: 'User account required.'
        });
      }

      if (
        !user.standardPinHash ||
        !user.duressPinHash
      ) {
        return res.status(409).json({
          success: false,
          error: 'Complete PIN setup first.'
        });
      }

      /*
       * Preserve the existing account lockout policy.
       * Lockout must not be bypassed by an ordinary PIN.
       */
      if (user.isPinLocked()) {
        return res.status(423).json({
          success: false,
          locked: true,
          error: 'PIN temporarily locked.'
        });
      }

      /*
       * Compare duress first so the emergency path
       * does not depend on payment details being valid.
       */
      const isDuress =
        await user.compareDuressPin(pin);

      if (isDuress) {
        await user.resetFailedPin();

        const incidentId = createIncidentId();

        const incidentLocation =
          locationOrNull(location);

        const alert = await Alert.create({
          incidentId,
          userId: user._id,
          userName: user.name,
          userPhone: user.phone || '',
          type: ALERT_TYPES.DURESS,
          severity: ALERT_SEVERITY.CRITICAL,
          status: ALERT_STATUS.ACTIVE,
          ...(incidentLocation
            ? { location: incidentLocation }
            : {}),
          guardians: [],
          escalationTier: 1,
          timeline: [
            {
              event: 'Duress PIN Activated',
              details:
                'Covert emergency triggered.',
              timestamp: new Date()
            }
          ]
        });

        // Incident is now persisted.
        // Notifications and transaction logging
        // are best-effort secondary operations.

        try {
          broadcastToAdmins(
            'incident:created',
            {
              incidentId,
              alert
            }
          );
        } catch (error) {
          console.error(
            '[PIN BROADCAST]',
            error.message
          );
        }

        const amountPaise =
          amountToPaise(amount);

        if (amountPaise) {
          try {
            await Transaction.create({
              reference:
                `DUR-${crypto.randomBytes(8).toString('hex')}`,
              userId: user._id,
              userName: user.name,
              paymentRequestId:
                typeof paymentRequestId === 'string' &&
                paymentRequestId.trim()
                  ? paymentRequestId.trim()
                  : null,
              merchantName:
                normalizeMerchantName(merchantName) ||
                'Unspecified Merchant',
              category:
                'Security Duress Intercepted',
              amount: amountPaise / 100,
              currency: 'INR',
              status: 'duress_intercepted',
              isDuress: true,
              notes:
                `Emergency incident ${incidentId}`
            });
          } catch (error) {
            console.error(
              '[PIN DURESS TRANSACTION]',
              error.message
            );
          }
        }

        try {
          const contacts =
            await TrustedContact.find({
              userId: user._id,
              isPrimary: true,
              notifyOnDuress: true,
              verificationStatus: 'verified'
            });

          for (const contact of contacts) {
            let deliveryStatus = 'failed';

            try {
              const result =
                await sendGuardianAlertSMS({
                  guardian: contact,
                  user: {
                    name: user.name,
                    phone: user.phone || ''
                  },
                  incident: {
                    escalationTier: 1
                  },
                  location: {
                    address:
                      incidentLocation?.address ||
                      'Location unavailable'
                  }
                });

              deliveryStatus =
                result?.simulated
                  ? 'simulated'
                  : result?.success
                    ? 'pending'
                    : 'failed';
            } catch (error) {
              console.error(
                '[PIN GUARDIAN]',
                error.message
              );
            }

            alert.guardians.push({
              contactId: contact._id,
              name: contact.name,
              phone: contact.phone,
              relationship:
                contact.relationship,
              isPrimary: true,
              notifiedAt: new Date(),
              deliveryStatus
            });
          }

          await alert.save();
        } catch (error) {
          console.error(
            '[PIN CONTACTS]',
            error.message
          );
        }

        await safeAudit({
          action: 'DURESS_PIN_ACTIVATED',
          performedBy: {
            userId: user._id,
            role: user.role
          },
          targetType: 'ALERT',
          targetId: incidentId
        });

        return sendDuressResponse(res);
      }

      /* NORMAL PIN */

      const isStandard =
        await user.compareStandardPin(pin);

      if (isStandard) {
        await user.resetFailedPin();

        const name =
          normalizeMerchantName(merchantName);

        const amountPaise =
          amountToPaise(amount);

        if (!name || amountPaise === null) {
          return res.status(400).json({
            success: false,
            error:
              'Merchant name and valid payment amount required.'
          });
        }

        let requestId = null;

        /*
         * An omitted ID is allowed for simulated
         * standalone payments.
         *
         * A supplied ID MUST match an existing,
         * pending, unexpired database request.
         */
        if (paymentRequestId != null) {
          if (
            typeof paymentRequestId !== 'string' ||
            !paymentRequestId.trim()
          ) {
            return res.status(400).json({
              success: false,
              error: 'Invalid payment request ID.'
            });
          }

          requestId = paymentRequestId.trim();

          const paymentRequest =
            await PaymentRequest.findOne({
              paymentRequestId: requestId,
              status: 'pending',
              expiresAt: {
                $gt: new Date()
              }
            });

          if (
            !paymentRequest ||
            paymentRequest.currency !== 'INR' ||
            Math.round(
              paymentRequest.amount * 100
            ) !== amountPaise ||
            String(paymentRequest.merchantName)
              .trim()
              .toLowerCase() !==
              name.toLowerCase()
          ) {
            return res.status(409).json({
              success: false,
              error:
                'Payment request unavailable or details mismatch.'
            });
          }
        }

        const token =
          crypto.randomBytes(32).toString('hex');

        const tokenHash =
          crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        await PaymentAuthorization.create({
          tokenHash,
          userId: user._id,
          merchantName: name,
          amountPaise,
          paymentRequestId: requestId,
          expiresAt: new Date(
            Date.now() + AUTHORIZATION_TTL_MS
          )
        });

        return res.json({
          success: true,
          verified: true,
          isDuress: false,
          authorizationToken: token,
          expiresInSeconds: 120,
          simulationOnly: true,
          message:
            'PIN verified. Simulated payment authorized for two minutes.'
        });
      }

      /* INCORRECT PIN */

      const lock =
        await user.recordFailedPin();

      return res.status(
        lock.locked ? 423 : 401
      ).json({
        success: false,
        verified: false,
        locked: Boolean(lock.locked),
        attemptsRemaining: Math.max(
          0,
          5 - lock.attempts
        ),
        error: lock.locked
          ? 'PIN temporarily locked.'
          : 'Incorrect PIN sequence.'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;


/**
 * PALMLOCK — Secure Trusted Contacts Routes
 *
 * Features:
 * - Authenticated contact management
 * - Contact ownership enforcement
 * - Simulated OTP verification
 * - OTP expiry and attempt limits
 * - No universal verification OTP
 * - No unauthenticated demo fallback
 *
 * NOTE: Simulated OTP is logged by notificationService.
 * No real SMS is delivered.
 */

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const router = express.Router();

const { TrustedContact } = require('../models');
const { verifyToken } = require('../middleware/auth');
const { validateContact } = require('../middleware/validation');
const {
  sendContactVerificationOTP
} = require('../services/notificationService');
const { logAudit } = require('../services/auditService');
const { isDbConnected } = require('../config/db');

const MAX_CONTACTS = 5;
const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const otpAttempts = new Map();
const otpLastSent = new Map();

function databaseRequired(req, res, next) {
  if (!isDbConnected()) {
    return res.status(503).json({
      success: false,
      error: 'Trusted contact service temporarily unavailable.',
      retryable: true
    });
  }

  next();
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s()-]/g, '');
}

function publicContact(contact) {
  return {
    id: contact._id,
    _id: contact._id,
    name: contact.name,
    phone: contact.phone,
    relationship: contact.relationship,
    isPrimary: contact.isPrimary,
    verificationStatus: contact.verificationStatus,
    notifyOnDuress: contact.notifyOnDuress,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
  };
}

function validBoolean(value) {
  return typeof value === 'boolean';
}

function otpMatches(stored, supplied) {
  if (
    typeof stored !== 'string' ||
    typeof supplied !== 'string' ||
    !/^\d{6}$/.test(stored) ||
    !/^\d{6}$/.test(supplied)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(stored),
    Buffer.from(supplied)
  );
}

async function safeAudit(data) {
  try {
    await logAudit(data);
  } catch (error) {
    console.error('[CONTACT AUDIT]', error.message);
  }
}

async function findOwnedContact(contactId, userId, withOtp = false) {
  if (!validId(contactId)) {
    return null;
  }

  const query = TrustedContact.findOne({
    _id: contactId,
    userId
  });

  if (withOtp) {
    query.select('+otpCode +otpExpiresAt');
  }

  return query;
}

async function issueOtp(contact) {
  const key = String(contact._id);
  const now = Date.now();

  const lastSent = otpLastSent.get(key) || 0;

  if (now - lastSent < OTP_RESEND_COOLDOWN_MS) {
    return {
      success: false,
      cooldown: true
    };
  }

  const result = await sendContactVerificationOTP({
    contact
  });

  if (
    !result ||
    !/^\d{6}$/.test(String(result.otp || ''))
  ) {
    throw new Error('OTP generation failed.');
  }

  const expiresAt = new Date(
    Math.min(
      new Date(result.expiresAt).getTime() || Infinity,
      now + OTP_TTL_MS
    )
  );

  contact.otpCode = String(result.otp);
  contact.otpExpiresAt = expiresAt;
  contact.verificationStatus = 'pending';

  await contact.save();

  otpAttempts.delete(key);
  otpLastSent.set(key, now);

  return {
    success: true,
    simulated: true,
    expiresAt
  };
}

// Require authentication and MongoDB for every contact route.
router.use(verifyToken, databaseRequired);

/**
 * GET /api/contacts
 */
router.get('/', async (req, res, next) => {
  try {
    const contacts = await TrustedContact.find({
      userId: req.user.id
    }).sort({
      isPrimary: -1,
      createdAt: 1
    });

    return res.json({
      success: true,
      contacts: contacts.map(publicContact)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contacts
 */
router.post('/', validateContact, async (req, res, next) => {
  try {
    const {
      name,
      phone,
      relationship,
      isPrimary,
      notifyOnDuress
    } = req.body;

    const userId = req.user.id;

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof phone !== 'string' ||
      !phone.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: 'Contact name and phone are required.'
      });
    }

    if (
      isPrimary !== undefined &&
      !validBoolean(isPrimary)
    ) {
      return res.status(400).json({
        success: false,
        error: 'isPrimary must be a boolean.'
      });
    }

    if (
      notifyOnDuress !== undefined &&
      !validBoolean(notifyOnDuress)
    ) {
      return res.status(400).json({
        success: false,
        error: 'notifyOnDuress must be a boolean.'
      });
    }

    const count = await TrustedContact.countDocuments({
      userId
    });

    if (count >= MAX_CONTACTS) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_CONTACTS} trusted contacts allowed.`
      });
    }

    const normalizedPhone = normalizePhone(phone);

    const existingContacts = await TrustedContact.find({
      userId
    });

    const duplicate = existingContacts.some(
      (contact) =>
        normalizePhone(contact.phone) === normalizedPhone
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'This phone number is already a trusted contact.'
      });
    }

    const primaryRequested =
      isPrimary === undefined
        ? count === 0
        : isPrimary;

    const contact = await TrustedContact.create({
      userId,
      name: name.trim(),
      phone: phone.trim(),
      relationship:
        typeof relationship === 'string' && relationship.trim()
          ? relationship.trim()
          : 'Guardian',
      isPrimary: Boolean(primaryRequested),
      notifyOnDuress:
        notifyOnDuress === undefined
          ? true
          : notifyOnDuress,
      verificationStatus: 'pending'
    });

    if (primaryRequested) {
      await TrustedContact.updateMany(
        {
          userId,
          _id: { $ne: contact._id }
        },
        {
          $set: { isPrimary: false }
        }
      );
    }

    let otpGenerated = false;

    try {
      const result = await issueOtp(contact);
      otpGenerated = result.success;
    } catch (error) {
      console.error(
        '[CONTACT] Simulated OTP generation failed:',
        error.message
      );
    }

    await safeAudit({
      action: 'CONTACT_ADDED',
      performedBy: {
        userId,
        role: 'user'
      },
      targetType: 'CONTACT',
      targetId: contact._id,
      details: {
        verificationStatus: 'pending',
        notificationMode: 'simulation'
      }
    });

    return res.status(201).json({
      success: true,
      message: otpGenerated
        ? 'Contact added. Development OTP generated; no real SMS sent.'
        : 'Contact added. OTP generation pending.',
      contact: publicContact(contact),
      verification: {
        status: 'pending',
        simulated: true,
        otpGenerated
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contacts/verify
 *
 * Must appear before /:id routes.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { contactId, otp } = req.body;

    if (
      !validId(contactId) ||
      typeof otp !== 'string' ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Valid contactId and six-digit OTP required.'
      });
    }

    const contact = await findOwnedContact(
      contactId,
      req.user.id,
      true
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found.'
      });
    }

    if (contact.verificationStatus === 'verified') {
      return res.json({
        success: true,
        message: 'Contact already verified.',
        contact: publicContact(contact)
      });
    }

    const key = String(contact._id);
    const attempts = otpAttempts.get(key) || 0;

    if (attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        error: 'Too many OTP attempts. Request a new OTP.'
      });
    }

    const expiresAt = contact.otpExpiresAt
      ? new Date(contact.otpExpiresAt).getTime()
      : 0;

    if (
      !contact.otpCode ||
      !expiresAt ||
      Date.now() > expiresAt
    ) {
      return res.status(400).json({
        success: false,
        error: 'OTP expired or not generated.'
      });
    }

    if (!otpMatches(contact.otpCode, otp)) {
      otpAttempts.set(key, attempts + 1);

      return res.status(400).json({
        success: false,
        error: 'Invalid or expired OTP.'
      });
    }

    contact.verificationStatus = 'verified';
    contact.otpCode = undefined;
    contact.otpExpiresAt = undefined;

    await contact.save();

    otpAttempts.delete(key);
    otpLastSent.delete(key);

    await safeAudit({
      action: 'CONTACT_VERIFIED',
      performedBy: {
        userId: req.user.id,
        role: 'user'
      },
      targetType: 'CONTACT',
      targetId: contact._id,
      details: {
        verificationMode: 'development_simulation'
      }
    });

    return res.json({
      success: true,
      message: 'Contact verified using development OTP.',
      contact: publicContact(contact)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contacts/:id/resend-otp
 */
router.post('/:id/resend-otp', async (req, res, next) => {
  try {
    const contact = await findOwnedContact(
      req.params.id,
      req.user.id,
      true
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found.'
      });
    }

    if (contact.verificationStatus === 'verified') {
      return res.status(409).json({
        success: false,
        error: 'Contact is already verified.'
      });
    }

    const result = await issueOtp(contact);

    if (result.cooldown) {
      return res.status(429).json({
        success: false,
        error: 'Please wait before requesting another OTP.'
      });
    }

    return res.json({
      success: true,
      message: 'New development OTP generated. No real SMS sent.',
      simulated: true
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/contacts/:id
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const contact = await findOwnedContact(
      req.params.id,
      req.user.id,
      true
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found.'
      });
    }

    const allowed = [
      'name',
      'phone',
      'relationship',
      'isPrimary',
      'notifyOnDuress'
    ];

    const keys = Object.keys(req.body);

    if (
      keys.length === 0 ||
      keys.some((key) => !allowed.includes(key))
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contact update fields.'
      });
    }

    const {
      name,
      phone,
      relationship,
      isPrimary,
      notifyOnDuress
    } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid contact name.'
        });
      }

      contact.name = name.trim();
    }

    if (relationship !== undefined) {
      if (
        typeof relationship !== 'string' ||
        !relationship.trim()
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid relationship.'
        });
      }

      contact.relationship = relationship.trim();
    }

    if (
      isPrimary !== undefined &&
      !validBoolean(isPrimary)
    ) {
      return res.status(400).json({
        success: false,
        error: 'isPrimary must be a boolean.'
      });
    }

    if (
      notifyOnDuress !== undefined &&
      !validBoolean(notifyOnDuress)
    ) {
      return res.status(400).json({
        success: false,
        error: 'notifyOnDuress must be a boolean.'
      });
    }

    if (notifyOnDuress !== undefined) {
      contact.notifyOnDuress = notifyOnDuress;
    }

    let phoneChanged = false;

    if (phone !== undefined) {
      if (typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number.'
        });
      }

      const normalizedPhone = normalizePhone(phone);

      const otherContacts = await TrustedContact.find({
        userId: req.user.id,
        _id: { $ne: contact._id }
      });

      if (
        otherContacts.some(
          (item) =>
            normalizePhone(item.phone) === normalizedPhone
        )
      ) {
        return res.status(409).json({
          success: false,
          error: 'Phone number already belongs to another contact.'
        });
      }

      phoneChanged =
        normalizePhone(contact.phone) !== normalizedPhone;

      contact.phone = phone.trim();

      if (phoneChanged) {
        contact.verificationStatus = 'pending';
        contact.otpCode = undefined;
        contact.otpExpiresAt = undefined;
      }
    }

    if (isPrimary === true) {
      await TrustedContact.updateMany(
        {
          userId: req.user.id,
          _id: { $ne: contact._id }
        },
        {
          $set: { isPrimary: false }
        }
      );

      contact.isPrimary = true;
    } else if (isPrimary === false) {
      contact.isPrimary = false;
    }

    await contact.save();

    let otpGenerated = false;

    if (phoneChanged) {
      otpAttempts.delete(String(contact._id));
      otpLastSent.delete(String(contact._id));

      try {
        const result = await issueOtp(contact);
        otpGenerated = result.success;
      } catch (error) {
        console.error(
          '[CONTACT] OTP regeneration failed:',
          error.message
        );
      }
    }

    await safeAudit({
      action: 'CONTACT_UPDATED',
      performedBy: {
        userId: req.user.id,
        role: 'user'
      },
      targetType: 'CONTACT',
      targetId: contact._id,
      details: {
        phoneChanged,
        otpGenerated
      }
    });

    return res.json({
      success: true,
      message: phoneChanged
        ? 'Contact updated. New phone requires verification.'
        : 'Contact updated successfully.',
      contact: publicContact(contact)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/contacts/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contact ID.'
      });
    }

    const deleted = await TrustedContact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found.'
      });
    }

    otpAttempts.delete(String(deleted._id));
    otpLastSent.delete(String(deleted._id));

    await safeAudit({
      action: 'CONTACT_DELETED',
      performedBy: {
        userId: req.user.id,
        role: 'user'
      },
      targetType: 'CONTACT',
      targetId: deleted._id
    });

    return res.json({
      success: true,
      message: 'Trusted contact removed.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

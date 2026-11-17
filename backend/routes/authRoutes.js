
/**
 * PALMLOCK — Secure Authentication Routes
 *
 * Registration, login, logout and profile retrieval.
 * Demo accounts must be created separately for development.
 */

const express = require('express');
const jwt = require('jsonwebtoken');

const { User } = require('../models');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  validateRegistration,
  validateLogin
} = require('../middleware/validation');
const { logAudit } = require('../services/auditService');
const { isDbConnected } = require('../config/db');

const router = express.Router();

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function ensureAuthReady(req, res, next) {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    return res.status(503).json({
      success: false,
      error: 'Authentication service is not configured.'
    });
  }

  if (!isDbConnected()) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable. Please try again later.'
    });
  }

  next();
}

function createSession(res, user) {
  const token = jwt.sign(
    {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '7d'
    }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/'
  });

  return token;
}

function formatUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    visionLevel: user.visionLevel,
    balance: user.balance,
    settings: user.settings,
    hasStandardPin: Boolean(user.standardPinHash),
    hasDuressPin: Boolean(user.duressPinHash)
  };
}

async function writeAuthAudit(action, user, ip) {
  await logAudit({
    action,
    performedBy: {
      userId: user._id,
      name: user.name,
      role: user.role,
      ip
    },
    targetType: 'USER',
    targetId: user._id,
    details: {
      email: user.email
    }
  });
}

/**
 * POST /api/auth/register
 *
 * New accounts are always ordinary users.
 * Security PINs and trusted contacts are set during onboarding.
 */
router.post(
  '/register',
  authLimiter,
  validateRegistration,
  ensureAuthReady,
  async (req, res, next) => {
    try {
      const { name, email, password, phone } = req.body;

      const normalizedEmail = email.trim().toLowerCase();

      const existing = await User.findOne({
        email: normalizedEmail
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists.'
        });
      }

      const user = new User({
        name: name.trim(),
        email: normalizedEmail,
        password,
        phone:
          typeof phone === 'string' && phone.trim()
            ? phone.trim()
            : undefined,
        role: 'user'
      });

      await user.save();

      const token = createSession(res, user);

      await writeAuthAudit('USER_REGISTERED', user, req.ip);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user: formatUser(user),
        onboardingRequired: true
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists.'
        });
      }

      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 *
 * Only real MongoDB accounts can authenticate.
 */
router.post(
  '/login',
  authLimiter,
  validateLogin,
  ensureAuthReady,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (
        typeof email !== 'string' ||
        typeof password !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Valid email and password are required.'
        });
      }

      const user = await User.findOne({
        email: email.trim().toLowerCase()
      }).select('+password +standardPinHash +duressPinHash');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }

      const matches = await user.comparePassword(password);

      if (!matches) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }

      const token = createSession(res, user);

      await writeAuthAudit('USER_LOGGED_IN', user, req.ip);

      return res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: formatUser(user),
        onboardingRequired:
          !user.standardPinHash || !user.duressPinHash
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/**
 * GET /api/auth/me
 */
router.get(
  '/me',
  verifyToken,
  ensureAuthReady,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id)
        .select('+standardPinHash +duressPinHash');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Account not found. Please log in again.'
        });
      }

      return res.json({
        success: true,
        user: formatUser(user),
        onboardingRequired:
          !user.standardPinHash || !user.duressPinHash
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

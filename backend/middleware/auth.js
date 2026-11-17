
/**
 * PALMLOCK — Authentication & Authorization Middleware
 *
 * Verifies JWT access tokens and enforces role-based access.
 * Never uses a hardcoded JWT signing or verification secret.
 */

const jwt = require('jsonwebtoken');

/**
 * Retrieve the configured JWT secret.
 * Authentication must not silently fall back to a known secret.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== 'string' || !secret.trim()) {
    return null;
  }

  return secret;
}

/**
 * Extract an authentication token from an HttpOnly cookie
 * or an Authorization: Bearer header.
 */
function extractToken(req) {
  if (
    req.cookies &&
    typeof req.cookies.token === 'string' &&
    req.cookies.token.trim()
  ) {
    return req.cookies.token.trim();
  }

  const authHeader = req.headers.authorization;

  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(\S+)$/i);

    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Verify a JWT with the configured secret.
 * Only HS256 tokens are accepted.
 */
function decodeToken(token) {
  const secret = getJwtSecret();

  if (!secret) {
    const error = new Error('JWT_SECRET is not configured.');
    error.code = 'JWT_CONFIG_MISSING';
    throw error;
  }

  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256']
  });

  if (
    !decoded ||
    typeof decoded !== 'object' ||
    !decoded.id ||
    !decoded.role
  ) {
    const error = new Error('Invalid authentication payload.');
    error.code = 'JWT_INVALID_PAYLOAD';
    throw error;
  }

  return decoded;
}

/**
 * Require an authenticated user.
 */
function verifyToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }

  try {
    req.user = decodeToken(token);
    return next();
  } catch (error) {
    if (error.code === 'JWT_CONFIG_MISSING') {
      console.error('[AUTH] JWT_SECRET is not configured.');

      return res.status(503).json({
        success: false,
        error: 'Authentication service is temporarily unavailable.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.'
    });
  }
}

/**
 * Optional authentication.
 *
 * A missing or invalid token does not grant any permissions.
 * Routes requiring identity must explicitly use verifyToken.
 */
function optionalAuth(req, res, next) {
  req.user = null;

  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    req.user = decodeToken(token);
    return next();
  } catch (error) {
    if (error.code === 'JWT_CONFIG_MISSING') {
      console.error('[AUTH] JWT_SECRET is not configured.');

      return res.status(503).json({
        success: false,
        error: 'Authentication service is temporarily unavailable.'
      });
    }

    req.user = null;
    return next();
  }
}

/**
 * Require one of the permitted roles.
 *
 * Use after verifyToken:
 * verifyToken, requireRole('admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: insufficient privileges.'
      });
    }

    return next();
  };
}

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
  extractToken
};

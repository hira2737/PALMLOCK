
/**
 * PALMLOCK — Secure Administrative Audit Log Routes
 *
 * Audit logs contain security-sensitive information.
 * Access is restricted to authenticated administrators.
 */

const express = require('express');
const router = express.Router();

const { AuditLog } = require('../models');
const {
  verifyToken,
  requireRole
} = require('../middleware/auth');

const { isDbConnected } = require('../config/db');

/**
 * GET /api/admin/audit-logs
 *
 * Only authenticated administrators can view audit records.
 */
router.get(
  '/admin/audit-logs',
  verifyToken,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      if (!isDbConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Audit records are temporarily unavailable.'
        });
      }

      const { action, targetType } = req.query;

      const parsedLimit = Number(req.query.limit ?? 50);
      const parsedSkip = Number(req.query.skip ?? 0);

      if (
        !Number.isSafeInteger(parsedLimit) ||
        parsedLimit < 1 ||
        !Number.isSafeInteger(parsedSkip) ||
        parsedSkip < 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pagination parameters.'
        });
      }

      const limit = Math.min(parsedLimit, 100);
      const skip = parsedSkip;

      const query = {};

      if (typeof action === 'string' && action.trim()) {
        query.action = action.trim();
      }

      if (typeof targetType === 'string' && targetType.trim()) {
        query.targetType = targetType.trim();
      }

      const [total, logs] = await Promise.all([
        AuditLog.countDocuments(query),
        AuditLog.find(query)
          .sort({ timestamp: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      return res.status(200).json({
        success: true,
        total,
        limit,
        skip,
        logs
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;

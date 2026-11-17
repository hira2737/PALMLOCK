/**
 * PALMLOCK — Audit Service
 * Persists administrative and security operations to the database with safe fallback.
 */

const { AuditLog } = require('../models');
const { isDbConnected } = require('../config/db');

async function logAudit({ action, performedBy = {}, targetType = 'SYSTEM', targetId = null, details = {} }) {
  const logEntry = {
    action,
    performedBy: {
      userId: performedBy.userId || null,
      name: performedBy.name || 'System',
      role: performedBy.role || 'system',
      ip: performedBy.ip || '127.0.0.1'
    },
    targetType,
    targetId: targetId ? String(targetId) : null,
    details,
    timestamp: new Date()
  };

  try {
    if (isDbConnected()) {
      await AuditLog.create(logEntry);
    } else {
      console.log(`[AUDIT-LOG] [${logEntry.timestamp.toISOString()}] ${action} by ${logEntry.performedBy.name}:`, JSON.stringify(details));
    }
  } catch (err) {
    console.error('[AUDIT-LOG ERROR]', err.message);
  }

  return logEntry;
}

module.exports = {
  logAudit
};

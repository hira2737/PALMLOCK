
/**
 * PALMLOCK — Authenticated Simulated Transactions
 *
 * No real money moves.
 */

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const {
  Transaction,
  User,
  PaymentRequest
} = require('../models');

const PaymentAuthorization = require(
  '../models/PaymentAuthorization'
);

const {
  verifyToken,
  requireRole
} = require('../middleware/auth');

const { isDbConnected } = require('../config/db');

const {
  broadcastToAdmins
} = require('../sockets/socketHandler');

const { logAudit } = require('../services/auditService');

function requireDatabase(req, res, next) {
  if (!isDbConnected()) {
    return res.status(503).json({
      success: false,
      error: 'Transaction database unavailable.',
      retryable: true
    });
  }

  next();
}

function amountToPaise(amount) {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 100000 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) >= 1e-6
  ) {
    return null;
  }

  return Math.round(amount * 100);
}

function safe(value, max = 150) {
  return typeof value === 'string'
    ? value.trim().slice(0, max)
    : '';
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function present(tx) {
  return {
    _id: tx._id,
    reference: tx.reference,
    userId: tx.userId,
    userName: tx.userName,
    merchantId: tx.merchantId,
    merchantName: tx.merchantName,
    category: tx.category,
    paymentRequestId: tx.paymentRequestId,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    isDuress: tx.isDuress,
    authMethod: tx.authMethod,
    notes: tx.notes,
    timestamp: tx.timestamp,
    simulationOnly: true
  };
}

async function safeAudit(data) {
  try {
    await logAudit(data);
  } catch (error) {
    console.error(
      '[TRANSACTION AUDIT]',
      error.message
    );
  }
}

router.use(verifyToken, requireDatabase);

/**
 * POST /api/transactions/simulate
 */
router.post('/simulate', async (req, res, next) => {
  const {
    merchantName,
    amount,
    paymentRequestId,
    authorizationToken,
    category,
    notes
  } = req.body || {};

  const name = safe(merchantName);
  const paise = amountToPaise(amount);

  if (!name || !paise) {
    return res.status(400).json({
      success: false,
      error:
        'Valid merchantName and numeric amount required.'
    });
  }

  if (
    typeof authorizationToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(authorizationToken)
  ) {
    return res.status(403).json({
      success: false,
      error:
        'Valid payment authorization required. Verify gesture PIN first.'
    });
  }

  if (
    paymentRequestId != null &&
    (
      typeof paymentRequestId !== 'string' ||
      !paymentRequestId.trim()
    )
  ) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payment request ID.'
    });
  }

  const requestId =
    paymentRequestId == null
      ? null
      : paymentRequestId.trim();

  const tokenHash = crypto
    .createHash('sha256')
    .update(authorizationToken)
    .digest('hex');

  const session = await Transaction.startSession();

  let created;

  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({
        _id: req.user.id,
        role: 'user'
      }).session(session);

      if (!user) {
        const error = new Error(
          'Valid user account required.'
        );
        error.httpStatus = 403;
        throw error;
      }

      const authorization =
        await PaymentAuthorization.findOneAndUpdate(
          {
            tokenHash,
            userId: user._id,
            merchantName: name,
            amountPaise: paise,
            paymentRequestId: requestId,
            consumedAt: null,
            expiresAt: {
              $gt: new Date()
            }
          },
          {
            $set: {
              consumedAt: new Date()
            }
          },
          {
            new: true,
            session
          }
        );

      if (!authorization) {
        const error = new Error(
          'Authorization expired, used, or does not match payment details.'
        );
        error.httpStatus = 403;
        throw error;
      }

      let paymentRequest = null;

      if (requestId) {
        paymentRequest =
          await PaymentRequest.findOneAndUpdate(
            {
              paymentRequestId: requestId,
              status: 'pending',
              expiresAt: {
                $gt: new Date()
              },
              merchantName: name,
              amount,
              currency: 'INR'
            },
            {
              $set: {
                status: 'completed'
              }
            },
            {
              new: true,
              session
            }
          );

        if (!paymentRequest) {
          const error = new Error(
            'Payment request expired, already used, or details mismatch.'
          );
          error.httpStatus = 409;
          throw error;
        }
      }

      const documents = await Transaction.create(
        [
          {
            reference:
              `TXN-PLM-${crypto
                .randomBytes(12)
                .toString('hex')
                .toUpperCase()}`,
            userId: user._id,
            userName: user.name,
            paymentRequestId: requestId,
            merchantId:
              paymentRequest?.merchantId || null,
            merchantName: name,
            category:
              paymentRequest?.category ||
              safe(category) ||
              'General',
            amount: paise / 100,
            currency: 'INR',
            status: 'completed',
            isDuress: false,
            authMethod: 'GESTURE_PIN',
            notes: safe(notes, 500),
            timestamp: new Date()
          }
        ],
        {
          session
        }
      );

      authorization.transactionId =
        documents[0]._id;

      await authorization.save({
        session
      });

      created = present(documents[0]);
    });

    try {
      broadcastToAdmins(
        'transaction:created',
        {
          transaction: created
        }
      );
    } catch (error) {
      console.error(
        '[TRANSACTION BROADCAST]',
        error.message
      );
    }

    await safeAudit({
      action: 'TRANSACTION_COMPLETED',
      performedBy: {
        userId: req.user.id,
        role: 'user'
      },
      targetType: 'TRANSACTION',
      targetId: created.reference,
      details: {
        amount: created.amount,
        simulationOnly: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Simulated payment recorded.',
      transaction: created,
      simulationOnly: true,
      balanceDeducted: false,
      realPaymentProcessed: false
    });
  } catch (error) {
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({
        success: false,
        error: error.message
      });
    }

    if (
      /Transaction numbers are only allowed|replica set/i
        .test(error.message)
    ) {
      return res.status(503).json({
        success: false,
        error:
          'MongoDB transactions require a replica set.',
        retryable: true
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
});

/**
 * GET /api/transactions/user
 */
router.get('/user', async (req, res, next) => {
  try {
    const transactions =
      await Transaction.find({
        userId: req.user.id
      })
        .sort({
          timestamp: -1
        })
        .limit(100);

    return res.json({
      success: true,
      total: transactions.length,
      transactions:
        transactions.map(present),
      simulationOnly: true
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/transactions
 */
router.get(
  '/admin/transactions',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const query = {};

      if (req.query.status) {
        const allowed = [
          'completed',
          'duress_intercepted',
          'failed',
          'cancelled'
        ];

        if (!allowed.includes(req.query.status)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid status.'
          });
        }

        query.status = req.query.status;
      }

      if (req.query.isDuress !== undefined) {
        if (
          !['true', 'false'].includes(
            req.query.isDuress
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              'Invalid isDuress.'
          });
        }

        query.isDuress =
          req.query.isDuress === 'true';
      }

      if (
        typeof req.query.search === 'string' &&
        req.query.search.trim()
      ) {
        const pattern = escapeRegex(
          req.query.search.trim().slice(0, 100)
        );

        query.$or = [
          'reference',
          'merchantName',
          'userName'
        ].map((key) => ({
          [key]: {
            $regex: pattern,
            $options: 'i'
          }
        }));
      }

      const limit = Math.min(
        100,
        Math.max(
          1,
          parseInt(req.query.limit, 10) || 50
        )
      );

      const skip = Math.min(
        100000,
        Math.max(
          0,
          parseInt(req.query.skip, 10) || 0
        )
      );

      const [
        total,
        transactions
      ] = await Promise.all([
        Transaction.countDocuments(query),
        Transaction.find(query)
          .sort({
            timestamp: -1
          })
          .skip(skip)
          .limit(limit)
      ]);

      return res.json({
        success: true,
        total,
        limit,
        skip,
        transactions:
          transactions.map(present),
        simulationOnly: true
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

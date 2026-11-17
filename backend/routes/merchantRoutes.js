
/**
 * PALMLOCK — Merchant & Simulated QR Payment Routes
 *
 * Security:
 * - Exact merchant identity matching
 * - No empty-query verification bypass
 * - Only explicitly verified database merchants
 * - Demo merchant identities are simulation-only
 * - No fabricated payment requests for unknown IDs
 * - Expired payment requests cannot be paid
 * - No real UPI or bank payment processing
 */

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const { Merchant, PaymentRequest } = require('../models');
const { DEMO_MERCHANTS } = require('../config/constants');
const { isDbConnected } = require('../config/db');

function clean(value, maxLength = 150) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : '';
}

function normalized(value) {
  return clean(value).toLowerCase();
}

function publicMerchant(merchant, demo = false) {
  const source =
    typeof merchant.toObject === 'function'
      ? merchant.toObject()
      : merchant;

  return {
    merchantId: source.merchantId,
    name: source.name,
    category: source.category,
    upiId: source.upiId,
    location: source.location,
    verified: source.verified === true,
    suggestedAmount: source.suggestedAmount,
    simulationOnly: demo
  };
}

function findDemoMerchant({ merchantId, merchantName, upiId }) {
  const id = normalized(merchantId);
  const name = normalized(merchantName);
  const upi = normalized(upiId);

  if (!id && !name && !upi) {
    return null;
  }

  return DEMO_MERCHANTS.find((merchant) => {
    if (id && normalized(merchant.merchantId) !== id) {
      return false;
    }

    if (name && normalized(merchant.name) !== name) {
      return false;
    }

    if (upi && normalized(merchant.upiId) !== upi) {
      return false;
    }

    return true;
  }) || null;
}

function validPaymentRequestId(value) {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

function publicPaymentRequest(doc) {
  return {
    paymentRequestId: doc.paymentRequestId,
    merchantId: doc.merchantId,
    merchantName: doc.merchantName,
    category: doc.category,
    upiId: doc.upiId,
    amount: doc.amount,
    currency: doc.currency,
    description: doc.description,
    status: doc.status,
    expiresAt: doc.expiresAt,
    simulationOnly: true
  };
}

/**
 * GET /api/merchants
 *
 * Returns the verified merchant catalogue.
 * Demo entries are labelled as simulations.
 */
router.get('/', async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.json({
        success: true,
        mode: 'demo',
        merchants: DEMO_MERCHANTS.map((merchant) =>
          publicMerchant(merchant, true)
        )
      });
    }

    const merchants = await Merchant.find({
      verified: true
    }).sort({ name: 1 });

    if (merchants.length === 0) {
      return res.json({
        success: true,
        mode: 'demo',
        merchants: DEMO_MERCHANTS.map((merchant) =>
          publicMerchant(merchant, true)
        )
      });
    }

    return res.json({
      success: true,
      mode: 'database',
      merchants: merchants.map((merchant) =>
        publicMerchant(merchant)
      )
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/merchants/verify
 *
 * Exact matching only.
 * Does not verify real-world UPI ownership.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const body = req.body || {};

    const merchantId = clean(body.merchantId);
    const merchantName = clean(body.merchantName);
    const upiId = clean(body.upiId);

    if (!merchantId && !merchantName && !upiId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Provide a merchant ID, name or UPI ID.'
      });
    }

    const demo = findDemoMerchant({
      merchantId,
      merchantName,
      upiId
    });

    if (demo) {
      return res.json({
        success: true,
        verified: true,
        verificationScope: 'palmlock_demo_catalogue',
        merchant: publicMerchant(demo, true),
        message:
          'Matched a PALMLOCK demonstration merchant. Real UPI ownership was not verified.'
      });
    }

    if (isDbConnected()) {
      const conditions = [];

      if (merchantId) {
        conditions.push({
          merchantId: merchantId.toUpperCase()
        });
      }

      if (merchantName) {
        conditions.push({
          name: new RegExp(
            '^' +
              merchantName.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
              ) +
              '$',
            'i'
          )
        });
      }

      if (upiId) {
        conditions.push({
          upiId: new RegExp(
            '^' +
              upiId.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
              ) +
              '$',
            'i'
          )
        });
      }

      const merchant = await Merchant.findOne({
        verified: true,
        $and: conditions
      });

      if (merchant) {
        return res.json({
          success: true,
          verified: true,
          verificationScope: 'palmlock_database',
          merchant: publicMerchant(merchant),
          message:
            'Merchant matched the PALMLOCK verified database.'
        });
      }
    }

    return res.json({
      success: true,
      verified: false,
      verificationScope: 'palmlock_catalogue',
      merchant: {
        merchantId: 'MERCH_UNVERIFIED',
        name: merchantName || 'Unknown Merchant',
        upiId: upiId || '',
        category: 'Unverified Merchant',
        verified: false,
        simulationOnly: true
      },
      message:
        'Merchant not found in the PALMLOCK verified catalogue.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/merchants/:id
 *
 * Retrieve a merchant using its merchantId or MongoDB ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = clean(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required.'
      });
    }

    const demo = findDemoMerchant({
      merchantId: id
    });

    if (demo) {
      return res.json({
        success: true,
        merchant: publicMerchant(demo, true)
      });
    }

    if (!isDbConnected()) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found.'
      });
    }

    const conditions = [{
      merchantId: id.toUpperCase()
    }];

    if (mongoose.isValidObjectId(id)) {
      conditions.push({ _id: id });
    }

    const merchant = await Merchant.findOne({
      verified: true,
      $or: conditions
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Verified merchant not found.'
      });
    }

    return res.json({
      success: true,
      merchant: publicMerchant(merchant)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payment-requests/:id
 *
 * Only retrieves existing payment requests.
 * Never creates a bill for an arbitrary ID.
 */
router.get(
  '/payment-requests/:id',
  async (req, res, next) => {
    try {
      const id = req.params.id;

      if (!validPaymentRequestId(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment request ID.'
        });
      }

      if (!isDbConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Payment request service unavailable.',
          retryable: true
        });
      }

      const paymentRequest = await PaymentRequest.findOne({
        paymentRequestId: id
      });

      if (!paymentRequest) {
        return res.status(404).json({
          success: false,
          error: 'Payment request not found.'
        });
      }

      const expired =
        paymentRequest.expiresAt &&
        new Date(paymentRequest.expiresAt).getTime() <=
          Date.now();

      if (expired && paymentRequest.status === 'pending') {
        paymentRequest.status = 'expired';
        await paymentRequest.save();
      }

      if (expired || paymentRequest.status === 'expired') {
        return res.status(410).json({
          success: false,
          error: 'Payment request expired.',
          paymentRequest: publicPaymentRequest(paymentRequest)
        });
      }

      if (paymentRequest.status !== 'pending') {
        return res.status(409).json({
          success: false,
          error: 'Payment request is no longer pending.',
          paymentRequest: publicPaymentRequest(paymentRequest)
        });
      }

      if (
        paymentRequest.currency !== 'INR' ||
        !Number.isFinite(paymentRequest.amount) ||
        paymentRequest.amount <= 0
      ) {
        return res.status(422).json({
          success: false,
          error: 'Invalid payment request details.'
        });
      }

      return res.json({
        success: true,
        paymentRequest: publicPaymentRequest(paymentRequest)
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

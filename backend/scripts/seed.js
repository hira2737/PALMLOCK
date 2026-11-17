/**
 * PALMLOCK — Database Seed Script
 * Populates MongoDB with default security admin, demo users, contacts, merchants, and transactions.
 * Usage: node backend/scripts/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, TrustedContact, Merchant, PaymentRequest, Transaction, Alert } = require('../models');
const { DEMO_MERCHANTS, PIN_MAPPINGS, ALERT_TYPES, ALERT_SEVERITY, ALERT_STATUS } = require('../config/constants');

async function runSeed() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('YOUR_MONGODB_ATLAS')) {
    console.error('[SEED ERROR] Please provide a valid MONGODB_URI in backend/.env before running seed.');
    process.exit(1);
  }

  try {
    console.log('[SEED] Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('[SEED] Connected to database:', mongoose.connection.name);

    // 1. Seed Administrator Account
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@palmlock.security').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Palmlock@Admin2026';
    const adminName = process.env.ADMIN_NAME || 'PALMLOCK Security Operations';

    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      admin = await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        phone: '+91 90000 00000',
        role: 'admin'
      });
      console.log(`[SEED] Created Security Admin: ${adminEmail}`);
    } else {
      console.log(`[SEED] Admin already exists: ${adminEmail}`);
    }

    // 2. Seed Demo User (Kavitha Raman)
    const userEmail = 'kavitha@example.com';
    let user = await User.findOne({ email: userEmail });
    const standardPin = PIN_MAPPINGS.STANDARD_DEMO_PIN; // '2520'
    const duressPin = PIN_MAPPINGS.DURESS_DEMO_PIN;     // '7744'

    const pinSalt = await bcrypt.genSalt(10);
    const standardPinHash = await bcrypt.hash(standardPin, pinSalt);
    const duressPinHash = await bcrypt.hash(duressPin, pinSalt);

    if (!user) {
      const passSalt = await bcrypt.genSalt(12);
      const userPassword = await bcrypt.hash('Kavitha@2026', passSalt);

      user = await User.create({
        name: 'Kavitha Raman',
        email: userEmail,
        password: userPassword,
        phone: '+91 98765 43210',
        role: 'user',
        visionLevel: 'total_blindness',
        balance: 4500.00,
        standardPinHash,
        duressPinHash
      });
      console.log(`[SEED] Created Demo User: ${userEmail} (Standard PIN: ${standardPin}, Duress: ${duressPin})`);
    } else {
      user.standardPinHash = standardPinHash;
      user.duressPinHash = duressPinHash;
      await user.save();
      console.log(`[SEED] Updated demo user PINs: ${userEmail}`);
    }

    // 3. Seed Trusted Contacts
    await TrustedContact.deleteMany({ userId: user._id });
    const contacts = await TrustedContact.insertMany([
      {
        userId: user._id,
        name: 'Ravi Raman',
        phone: '+91 94440 12345',
        relationship: 'Father',
        isPrimary: true,
        verificationStatus: 'verified',
        notifyOnDuress: true
      },
      {
        userId: user._id,
        name: 'Dr. Priya Sundaram',
        phone: '+91 98401 56789',
        relationship: 'Sister',
        isPrimary: false,
        verificationStatus: 'verified',
        notifyOnDuress: true
      }
    ]);
    console.log(`[SEED] Seeded ${contacts.length} trusted contacts for ${user.name}`);

    // 4. Seed Verified Merchants
    for (const merchantData of DEMO_MERCHANTS) {
      await Merchant.findOneAndUpdate(
        { merchantId: merchantData.merchantId },
        merchantData,
        { upsert: true, new: true }
      );
    }
    console.log(`[SEED] Seeded ${DEMO_MERCHANTS.length} verified Indian merchants.`);

    // 5. Seed Payment Requests
    await PaymentRequest.deleteMany({});
    const paymentReqs = await PaymentRequest.insertMany([
      {
        paymentRequestId: 'PAY-REQ-CMRL-001',
        merchantId: 'MERCH_CMRL_01',
        merchantName: 'Chennai Metro Rail (CMRL)',
        category: 'Transit & Travel',
        upiId: 'cmrl.chennai@sbi',
        amount: 40.00,
        currency: 'INR',
        description: 'Central Metro single token fare'
      },
      {
        paymentRequestId: 'PAY-REQ-NILGIRIS-002',
        merchantId: 'MERCH_NILGIRIS_02',
        merchantName: 'Nilgiris 1905 Supermarket',
        category: 'Groceries & Essentials',
        upiId: 'nilgiris.tngr@hdfcbank',
        amount: 485.50,
        currency: 'INR',
        description: 'Grocery basket checkout'
      }
    ]);
    console.log(`[SEED] Seeded ${paymentReqs.length} demo payment requests.`);

    // 6. Seed Demo Alerts
    const existingAlerts = await Alert.countDocuments();
    if (existingAlerts === 0) {
      await Alert.create([
        {
          incidentId: 'INC-2026-8812',
          userId: user._id,
          userName: user.name,
          userPhone: user.phone,
          type: ALERT_TYPES.DURESS,
          severity: ALERT_SEVERITY.CRITICAL,
          status: ALERT_STATUS.ACTIVE,
          escalationTier: 1,
          location: {
            lat: 13.0418,
            lng: 80.2341,
            accuracyMeters: 12,
            address: 'Usman Road, T. Nagar, Chennai'
          },
          guardians: [
            {
              contactId: contacts[0]._id,
              name: contacts[0].name,
              phone: contacts[0].phone,
              relationship: contacts[0].relationship,
              isPrimary: true,
              deliveryStatus: 'delivered'
            }
          ],
          timeline: [
            {
              event: 'Discreet Duress PIN Activated',
              details: 'User authenticated with covert emergency PIN (7744).',
              timestamp: new Date(Date.now() - 120000)
            }
          ]
        }
      ]);
      console.log('[SEED] Seeded initial demo duress alert.');
    }

    console.log('\n[SEED SUCCESS] Database population complete.');
    process.exit(0);
  } catch (err) {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };

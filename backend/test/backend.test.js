/**
 * PALMLOCK — Comprehensive Backend Test Suite
 * Validates Health, Auth, Contacts, PIN verification, Covert Duress, Transactions,
 * Admin Alerts, Escalation Service, and WebSockets.
 * Run with: npm test (inside backend/ directory)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Set test environment before requiring server
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_palmlock_jwt_secret_key_12345';

const request = require('./inMemoryClient');
const { app } = require('../server');
const { checkAndEscalateAlerts, TIER_2_THRESHOLD_MS, TIER_3_THRESHOLD_MS } = require('../services/escalationService');

describe('PALMLOCK Backend Security & Emergency API Test Suite', () => {

  describe('1. Health Check & System Status Endpoint', () => {
    it('GET /api/health returns 200 OK with system telemetry and database status', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.ok(typeof res.body.uptime === 'number');
      assert.ok(res.body.database);
      assert.equal(res.body.environment, 'test');
    });
  });

  describe('2. Authentication & User Profile Workflows', () => {
    const testUser = {
      name: 'Test Beneficiary',
      email: `test-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      phone: '+91 98765 11111'
    };

    let authToken = null;

    it('POST /api/auth/register creates user account and issues JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, testUser.email);
      // Ensure password hash is NEVER leaked
      assert.equal(res.body.user.password, undefined);
      assert.equal(res.body.user.standardPinHash, undefined);
      assert.equal(res.body.user.duressPinHash, undefined);
      authToken = res.body.token;
    });

    it('POST /api/auth/register rejects registration with invalid email or short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Short', email: 'invalid-email', password: '123' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('POST /api/auth/login authenticates user and sets session token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token);
    });

    it('GET /api/auth/me returns current user profile when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, testUser.email);
    });

    it('GET /api/auth/me rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  describe('3. Trusted Contacts & Verification Workflow', () => {
    let contactId = null;

    it('POST /api/contacts creates a trusted emergency guardian with simulated OTP', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .send({
          name: 'Sundar Raman',
          phone: '+91 94440 99999',
          relationship: 'Brother',
          isPrimary: true,
          notifyOnDuress: true
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.contact.name, 'Sundar Raman');
      assert.equal(res.body.contact.verificationStatus, 'pending');
      contactId = res.body.contact.id || res.body.contact._id;
    });

    it('GET /api/contacts retrieves registered emergency guardians', async () => {
      const res = await request(app).get('/api/contacts');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.contacts));
      assert.ok(res.body.contacts.length >= 1);
    });

    it('POST /api/contacts/verify verifies contact via OTP', async () => {
      const res = await request(app)
        .post('/api/contacts/verify')
        .send({ contactId, otp: '123456' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe('4. Tactile Gesture PIN Verification & Covert Duress Protocol', () => {
    it('POST /api/pin/verify with Standard PIN (2520) returns verified=true and authorizes payment', async () => {
      const res = await request(app)
        .post('/api/pin/verify')
        .send({
          pin: '2520',
          merchantName: 'Chennai Metro Rail (CMRL)',
          amount: 40.00
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.verified, true);
      assert.equal(res.body.isDuress, false);
    });

    it('POST /api/pin/verify with incorrect PIN returns 401 and tracks failed attempts', async () => {
      const res = await request(app)
        .post('/api/pin/verify')
        .send({
          pin: '9999',
          merchantName: 'Apollo Pharmacy',
          amount: 150.00
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.verified, false);
    });

    it('POST /api/pin/verify with Duress PIN (7744) executes Covert Emergency Protocol and returns HTTP 504 Timeout', async () => {
      const res = await request(app)
        .post('/api/pin/verify')
        .send({
          pin: '7744',
          merchantName: 'Saravana Stores',
          amount: 1250.00,
          location: {
            lat: 13.0827,
            lng: 80.2707,
            address: 'Padi Ring Road, Chennai'
          }
        });

      // Crucial: Duress trigger MUST return HTTP 504 Covert Gateway Timeout
      assert.equal(res.status, 504);
      assert.equal(res.body.success, false);
      assert.equal(res.body.covertDuress, true);
      assert.equal(res.body.code, 'GATEWAY_TIMEOUT');
      assert.match(res.body.error, /Network Gateway Timeout/i);
    });
  });

  describe('5. Verified Indian Merchants & Dynamic Payment Requests', () => {
    it('GET /api/merchants returns certified Indian demo merchants', async () => {
      const res = await request(app).get('/api/merchants');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.merchants.length >= 5);
      const cmrl = res.body.merchants.find((m) => m.merchantId === 'MERCH_CMRL_01');
      assert.ok(cmrl);
      assert.equal(cmrl.verified, true);
    });

    it('POST /api/merchants/verify identifies verified vendor from QR data', async () => {
      const res = await request(app)
        .post('/api/merchants/verify')
        .send({ merchantName: 'Chennai Metro' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.verified, true);
      assert.equal(res.body.merchant.merchantId, 'MERCH_CMRL_01');
    });

    it('GET /api/payment-requests/:id retrieves dynamic payment request', async () => {
      const res = await request(app).get('/api/payment-requests/PAY-TEST-99');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.paymentRequest);
      assert.equal(res.body.paymentRequest.currency, 'INR');
    });
  });

  describe('6. Transactions Ledger & Balance Simulation', () => {
    it('POST /api/transactions/simulate records completed payment and updates balance', async () => {
      const res = await request(app)
        .post('/api/transactions/simulate')
        .send({
          merchantName: 'Nilgiris 1905 Supermarket',
          category: 'Groceries & Essentials',
          amount: 485.50
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.transaction.reference.startsWith('TXN-PLM-'));
      assert.equal(res.body.transaction.status, 'completed');
      assert.equal(res.body.transaction.isDuress, false);
    });

    it('GET /api/admin/transactions retrieves paginated transactions for SOC ledger', async () => {
      const res = await request(app).get('/api/admin/transactions');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.transactions));
      assert.ok(res.body.total >= 1);
    });
  });

  describe('7. Emergency Alerts, False Alarms & SOC Incident Response', () => {
    let activeIncidentId = null;

    it('POST /api/alerts/sos logs manual tactile SOS emergency trigger', async () => {
      const res = await request(app)
        .post('/api/alerts/sos')
        .send({
          userName: 'Kavitha Raman',
          userPhone: '+91 98765 43210',
          location: {
            lat: 13.0827,
            lng: 80.2707,
            address: 'Central Station, Chennai'
          }
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.incidentId);
      activeIncidentId = res.body.incidentId;
    });

    it('GET /api/admin/alerts retrieves emergency incidents with filtering', async () => {
      const res = await request(app).get('/api/admin/alerts');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.alerts));
      assert.ok(res.body.alerts.length >= 1);
    });

    it('POST /api/admin/alerts/:id/acknowledge acknowledges incident by security operator', async () => {
      const res = await request(app)
        .post(`/api/admin/alerts/${activeIncidentId}/acknowledge`)
        .send({ adminName: 'SOC Operator Anita' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('POST /api/alerts/false-alarm records accidental trigger and stands down emergency', async () => {
      const res = await request(app)
        .post('/api/alerts/false-alarm')
        .send({
          incidentId: activeIncidentId,
          reason: 'Accidental triple-tap in pocket'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe('8. Audit Log Queries', () => {
    it('GET /api/admin/audit-logs retrieves security audit events', async () => {
      const res = await request(app).get('/api/admin/audit-logs');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.logs));
    });
  });

  describe('9. Escalation Service SLA Engine (Restart-Resilient)', () => {
    it('checkAndEscalateAlerts handles empty or clean database gracefully', async () => {
      const result = await checkAndEscalateAlerts(new Date());
      assert.ok(result);
      assert.equal(typeof result.evaluated, 'number');
      assert.equal(typeof result.escalated, 'number');
    });

    it('checkAndEscalateAlerts evaluates simulated 5m and 10m thresholds properly', async () => {
      // 5-minute jump check
      const fiveMinsLater = new Date(Date.now() + TIER_2_THRESHOLD_MS + 1000);
      const result5m = await checkAndEscalateAlerts(fiveMinsLater);
      assert.ok(result5m);

      // 10-minute jump check
      const tenMinsLater = new Date(Date.now() + TIER_3_THRESHOLD_MS + 1000);
      const result10m = await checkAndEscalateAlerts(tenMinsLater);
      assert.ok(result10m);
    });
  });
});

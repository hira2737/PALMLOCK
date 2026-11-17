
/**
 * PALMLOCK — Development Notification Service
 *
 * Simulates emergency SMS and contact verification OTPs.
 *
 * IMPORTANT:
 * No real SMS is sent by this service.
 * A simulated notification must never be reported
 * as delivered to a real recipient.
 */

const crypto = require('crypto');

/**
 * Simulate an emergency notification to a trusted contact.
 */
async function sendGuardianAlertSMS({
  guardian,
  user,
  incident,
  location
}) {
  if (!guardian || !guardian.phone) {
    return {
      success: false,
      simulated: true,
      status: 'failed',
      error: 'Trusted contact phone number is missing.'
    };
  }

  const userName = user?.name || 'PALMLOCK user';
  const userPhone = user?.phone || 'Not available';
  const locationText =
    location?.address || 'Location unavailable';
  const escalationTier = incident?.escalationTier || 1;

  const message =
    `[PALMLOCK EMERGENCY SIMULATION] ` +
    `${userName} (${userPhone}) triggered an emergency alert. ` +
    `Location: ${locationText}. ` +
    `Escalation tier: ${escalationTier}. ` +
    `This is a development simulation, not a real SMS.`;

  const simulatedAt = new Date();

  console.log('\n========================================');
  console.log('[PALMLOCK — SIMULATED EMERGENCY SMS]');
  console.log(`Recipient: ${guardian.name || 'Trusted Contact'}`);
  console.log(`Phone: ${guardian.phone}`);
  console.log(`Message: ${message}`);
  console.log(`Simulated at: ${simulatedAt.toISOString()}`);
  console.log('REAL SMS SENT: NO');
  console.log('========================================\n');

  return {
    success: true,
    simulated: true,
    status: 'simulated',
    recipient: guardian.phone,
    name: guardian.name || 'Trusted Contact',
    simulatedAt,
    providerMessageId: null,
    deliveredAt: null
  };
}

/**
 * Generate a development-only contact verification OTP.
 *
 * The OTP is logged locally for testing.
 * It is not sent to the contact's phone.
 */
async function sendContactVerificationOTP({ contact }) {
  if (!contact || !contact.phone) {
    throw new Error(
      'A trusted contact phone number is required.'
    );
  }

  const otp = crypto.randomInt(
    100000,
    1000000
  ).toString();

  const expiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  );

  console.log('\n========================================');
  console.log('[PALMLOCK — SIMULATED OTP]');
  console.log(`Contact: ${contact.name || 'Trusted Contact'}`);
  console.log(`Phone: ${contact.phone}`);
  console.log(`Development OTP: ${otp}`);
  console.log(`Expires: ${expiresAt.toISOString()}`);
  console.log('REAL SMS SENT: NO');
  console.log('========================================\n');

  return {
    otp,
    expiresAt,
    simulated: true,
    status: 'simulated'
  };
}

module.exports = {
  sendGuardianAlertSMS,
  sendContactVerificationOTP
};

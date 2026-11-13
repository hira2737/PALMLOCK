/**
 * PALMLOCK — QR Payload Validation & Directional Guidance Logic Tests
 * Verifies payload parsing (JSON & UPI), currency checks, and bounding-box centering offset logic
 */

import { validatePaymentPayload } from '../frontend/js/user/scanner.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}:`, err.message);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${expected} but received ${actual}`);
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
      }
    }
  };
}

console.log('=== PALMLOCK QR Payment Validation & Decoding Tests ===\n');

it('validates a valid PALMLOCK JSON payment request in INR', () => {
  const jsonPayload = JSON.stringify({
    protocol: 'palmlock',
    version: '1.0',
    merchantName: 'Chennai Metro Rail (CMRL)',
    amount: 40.00,
    currency: 'INR',
    category: 'Transit',
    reference: 'TX-CMRL-9821'
  });

  const res = validatePaymentPayload(jsonPayload);
  expect(res.valid).toBe(true);
  expect(res.data.merchantName).toBe('Chennai Metro Rail (CMRL)');
  expect(res.data.amount).toBe(40.00);
  expect(res.data.currency).toBe('INR');
});

it('validates standard Indian UPI URI payment string', () => {
  const upiUri = 'upi://pay?pa=cmrl@sbi&pn=Chennai%20Metro%20Rail&am=40.00&cu=INR';
  const res = validatePaymentPayload(upiUri);
  expect(res.valid).toBe(true);
  expect(res.data.merchantName).toBe('Chennai Metro Rail');
  expect(res.data.amount).toBe(40.00);
  expect(res.data.currency).toBe('INR');
});

it('rejects payment request with non-INR currency', () => {
  const usdPayload = JSON.stringify({
    merchantName: 'US Merchant',
    amount: 15.00,
    currency: 'USD'
  });
  const res = validatePaymentPayload(usdPayload);
  expect(res.valid).toBe(false);
  expect(res.error.includes('Unsupported currency')).toBe(true);
});

it('rejects malformed or empty payloads', () => {
  expect(validatePaymentPayload('').valid).toBe(false);
  expect(validatePaymentPayload('random invalid string').valid).toBe(false);
  expect(validatePaymentPayload('{invalid json').valid).toBe(false);
});

it('calculates bounding-box centering delta coordinates', () => {
  function getGuidanceDirection(box, frameWidth, frameHeight, toleranceRatio = 0.15) {
    const qrCenterX = box.x + box.width / 2;
    const qrCenterY = box.y + box.height / 2;
    const targetCenterX = frameWidth / 2;
    const targetCenterY = frameHeight / 2;

    const deltaX = qrCenterX - targetCenterX;
    const deltaY = qrCenterY - targetCenterY;

    const toleranceX = frameWidth * toleranceRatio;
    const toleranceY = frameHeight * toleranceRatio;

    if (Math.abs(deltaX) <= toleranceX && Math.abs(deltaY) <= toleranceY) {
      return 'ALIGNED';
    }
    if (deltaX < -toleranceX && deltaY < -toleranceY) return 'UP_LEFT';
    if (deltaX > toleranceX && deltaY < -toleranceY) return 'UP_RIGHT';
    if (deltaX < -toleranceX && deltaY > toleranceY) return 'DOWN_LEFT';
    if (deltaX > toleranceX && deltaY > toleranceY) return 'DOWN_RIGHT';
    if (deltaX < -toleranceX) return 'LEFT';
    if (deltaX > toleranceX) return 'RIGHT';
    if (deltaY < -toleranceY) return 'UP';
    return 'DOWN';
  }

  const frameW = 1000;
  const frameH = 1000;

  // Centered box: x=400, y=400, w=200, h=200 -> center is 500, 500
  expect(getGuidanceDirection({ x: 400, y: 400, width: 200, height: 200 }, frameW, frameH)).toBe('ALIGNED');

  // QR is in top-left: center is 200, 200
  expect(getGuidanceDirection({ x: 100, y: 100, width: 200, height: 200 }, frameW, frameH)).toBe('UP_LEFT');

  // QR is to the right: center is 800, 500
  expect(getGuidanceDirection({ x: 700, y: 400, width: 200, height: 200 }, frameW, frameH)).toBe('RIGHT');

  // QR is down: center is 500, 850
  expect(getGuidanceDirection({ x: 400, y: 750, width: 200, height: 200 }, frameW, frameH)).toBe('DOWN');
});

console.log(`\n========================================`);
console.log(`QR Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);

process.exit(failed > 0 ? 1 : 0);

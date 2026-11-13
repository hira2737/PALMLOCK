/**
 * PALMLOCK — Tactile Currency Verification Engine Tests
 * Verifies digit-by-digit vibration pattern generation (Hundreds/Tens/Ones) for INR
 */

import { generateTactileCurrencyPattern } from '../frontend/js/user/payments.js';

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
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) throw new Error(`Expected > ${expected} but received ${actual}`);
    }
  };
}

console.log('=== PALMLOCK Tactile Currency Verification Tests ===\n');

it('breaks down ₹257 into 2 hundreds, 5 tens, 7 ones', () => {
  const res = generateTactileCurrencyPattern(257.00);
  expect(res.hundreds).toBe(2);
  expect(res.tens).toBe(5);
  expect(res.ones).toBe(7);
  expect(res.total).toBe(257);
  expect(res.spokenBreakdown.includes('2 hundreds')).toBe(true);
  expect(res.spokenBreakdown.includes('5 tens')).toBe(true);
  expect(res.spokenBreakdown.includes('7 ones')).toBe(true);
});

it('generates distinct pulse durations: 250ms for hundreds, 120ms for tens, 50ms for ones', () => {
  const res = generateTactileCurrencyPattern(257.00);
  const pattern = res.pattern;

  // Should contain 250 (hundreds pulse)
  expect(pattern.filter(p => p === 250).length).toBe(2);

  // Should contain 120 (tens pulse)
  expect(pattern.filter(p => p === 120).length).toBe(5);

  // Should contain 50 (ones pulse)
  expect(pattern.filter(p => p === 50).length).toBe(7);

  // Should contain group pauses of 600ms
  expect(pattern.filter(p => p === 600).length).toBeGreaterThan(1);
});

it('handles amounts with zero in tens position (e.g. ₹205)', () => {
  const res = generateTactileCurrencyPattern(205.00);
  expect(res.hundreds).toBe(2);
  expect(res.tens).toBe(0);
  expect(res.ones).toBe(5);
  expect(res.pattern.filter(p => p === 250).length).toBe(2);
  expect(res.pattern.filter(p => p === 50).length).toBe(5);
});

it('handles amounts with zero in ones position (e.g. ₹40)', () => {
  const res = generateTactileCurrencyPattern(40.00);
  expect(res.hundreds).toBe(0);
  expect(res.tens).toBe(4);
  expect(res.ones).toBe(0);
  expect(res.pattern.filter(p => p === 120).length).toBe(4);
});

console.log(`\n========================================`);
console.log(`Currency Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);

process.exit(failed > 0 ? 1 : 0);

/**
 * PALMLOCK — Gesture PIN & 8-Directional Vector Tests
 * Verifies 8-way swipe sector math, single/double tap, and 10-digit numeric PIN mapping
 */

import { classifyDirection, GESTURE_TO_DIGIT, DIGIT_TO_GESTURE } from '../frontend/js/user/gestures.js';

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

console.log('=== PALMLOCK Gesture PIN & 8-Directional Math Tests ===\n');

it('classifies cardinal directions accurately', () => {
  expect(classifyDirection(0, -60)).toBe('UP');
  expect(classifyDirection(0, 60)).toBe('DOWN');
  expect(classifyDirection(-60, 0)).toBe('LEFT');
  expect(classifyDirection(60, 0)).toBe('RIGHT');
});

it('classifies diagonal directions accurately across 45-degree sectors', () => {
  // Up-Left (deltaX < 0, deltaY < 0, angle ~ -135 deg)
  expect(classifyDirection(-50, -50)).toBe('UP_LEFT');

  // Up-Right (deltaX > 0, deltaY < 0, angle ~ -45 deg)
  expect(classifyDirection(50, -50)).toBe('UP_RIGHT');

  // Down-Left (deltaX < 0, deltaY > 0, angle ~ +135 deg)
  expect(classifyDirection(-50, 50)).toBe('DOWN_LEFT');

  // Down-Right (deltaX > 0, deltaY > 0, angle ~ +45 deg)
  expect(classifyDirection(50, 50)).toBe('DOWN_RIGHT');
});

it('rejects displacement under minimum threshold (35px)', () => {
  expect(classifyDirection(10, 10)).toBe('NONE');
  expect(classifyDirection(0, 20)).toBe('NONE');
  expect(classifyDirection(-25, 5)).toBe('NONE');
});

it('maps all 10 numeric digits to correct directional gestures and taps', () => {
  expect(GESTURE_TO_DIGIT['UP_LEFT']).toBe(1);
  expect(GESTURE_TO_DIGIT['UP']).toBe(2);
  expect(GESTURE_TO_DIGIT['UP_RIGHT']).toBe(3);
  expect(GESTURE_TO_DIGIT['LEFT']).toBe(4);
  expect(GESTURE_TO_DIGIT['RIGHT']).toBe(5);
  expect(GESTURE_TO_DIGIT['DOWN_LEFT']).toBe(6);
  expect(GESTURE_TO_DIGIT['DOWN']).toBe(7);
  expect(GESTURE_TO_DIGIT['DOWN_RIGHT']).toBe(8);
  expect(GESTURE_TO_DIGIT['DOUBLE_TAP']).toBe(9);
  expect(GESTURE_TO_DIGIT['SINGLE_TAP']).toBe(0);
});

it('verifies reverse mapping dictionary DIGIT_TO_GESTURE has all digits 0-9', () => {
  for (let d = 0; d <= 9; d++) {
    expect(DIGIT_TO_GESTURE[d] !== undefined).toBe(true);
  }
  expect(DIGIT_TO_GESTURE[7].gesture).toBe('DOWN');
  expect(DIGIT_TO_GESTURE[4].gesture).toBe('LEFT');
  expect(DIGIT_TO_GESTURE[9].gesture).toBe('DOUBLE_TAP');
  expect(DIGIT_TO_GESTURE[0].gesture).toBe('SINGLE_TAP');
});

it('verifies Duress PIN Down-Down-Left-Left resolves to 7744 under mapping', () => {
  const duressGestures = ['DOWN', 'DOWN', 'LEFT', 'LEFT'];
  const digits = duressGestures.map(g => GESTURE_TO_DIGIT[g]);
  expect(digits).toEqual([7, 7, 4, 4]);
});

it('verifies Normal PIN Up-Right-Up-Tap resolves to 2520 under mapping', () => {
  const normalGestures = ['UP', 'RIGHT', 'UP', 'SINGLE_TAP'];
  const digits = normalGestures.map(g => GESTURE_TO_DIGIT[g]);
  expect(digits).toEqual([2, 5, 2, 0]);
});

console.log(`\n========================================`);
console.log(`Gesture Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);

if (failed > 0) process.exit(1);

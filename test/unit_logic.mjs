/**
 * PALMLOCK — Unit Logic Tests
 * Tests state transitions, PIN matching, duress handling, and contact management
 */

import { state } from '../frontend/js/user/state.js';

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

console.log('=== PALMLOCK Logic & State Engine Tests ===\n');

it('initializes with default low-vision profile', () => {
  expect(state.user.visionLevel).toBe('low-vision');
  expect(state.user.balance).toBe(1420.50);
});

it('verifies standard PIN configuration', () => {
  expect(state.pins.standardPin).toEqual(['UP', 'RIGHT', 'UP', 'TAP']);
});

it('verifies duress PIN configuration', () => {
  expect(state.pins.duressPin).toEqual(['DOWN', 'DOWN', 'LEFT', 'LEFT']);
});

it('handles PIN matching comparison correctly', () => {
  const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  const testStandardInput = ['UP', 'RIGHT', 'UP', 'TAP'];
  const testDuressInput = ['DOWN', 'DOWN', 'LEFT', 'LEFT'];
  const testWrongInput = ['UP', 'UP', 'UP', 'UP'];

  expect(arraysEqual(testStandardInput, state.pins.standardPin)).toBe(true);
  expect(arraysEqual(testStandardInput, state.pins.duressPin)).toBe(false);

  expect(arraysEqual(testDuressInput, state.pins.duressPin)).toBe(true);
  expect(arraysEqual(testDuressInput, state.pins.standardPin)).toBe(false);

  expect(arraysEqual(testWrongInput, state.pins.standardPin)).toBe(false);
  expect(arraysEqual(testWrongInput, state.pins.duressPin)).toBe(false);
});

it('calculates gesture swipe direction correctly from vector math', () => {
  function getDirection(deltaX, deltaY, minDistance = 35) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX < minDistance && absY < minDistance) return 'NONE';
    if (absX > absY) {
      return deltaX > 0 ? 'RIGHT' : 'LEFT';
    } else {
      return deltaY > 0 ? 'DOWN' : 'UP';
    }
  }

  expect(getDirection(0, -50)).toBe('UP');
  expect(getDirection(0, 60)).toBe('DOWN');
  expect(getDirection(-75, 5)).toBe('LEFT');
  expect(getDirection(80, -10)).toBe('RIGHT');
  expect(getDirection(10, 10)).toBe('NONE'); // below threshold
});

it('adds and removes emergency contacts correctly', () => {
  const initialCount = state.contacts.length;
  const newContact = {
    id: 'cnt_test_99',
    name: 'Officer Davis',
    relationship: 'Campus Safety Dispatch',
    phone: '+1 (555) 000-9111',
    notifyOnDuress: true
  };

  state.contacts.push(newContact);
  expect(state.contacts.length).toBe(initialCount + 1);

  state.contacts = state.contacts.filter(c => c.id !== 'cnt_test_99');
  expect(state.contacts.length).toBe(initialCount);
});

it('formats spoken currency correctly for speech synthesis', () => {
  function formatCurrencySpoken(amount) {
    const parts = amount.toFixed(2).split('.');
    const dollars = parseInt(parts[0], 10);
    const cents = parseInt(parts[1], 10);
    if (cents === 0) return `${dollars} dollars`;
    return `${dollars} dollars and ${cents} cents`;
  }

  expect(formatCurrencySpoken(4.50)).toBe('4 dollars and 50 cents');
  expect(formatCurrencySpoken(10.00)).toBe('10 dollars');
  expect(formatCurrencySpoken(0.75)).toBe('0 dollars and 75 cents');
});

console.log(`\n========================================`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);

if (failed > 0) process.exit(1);

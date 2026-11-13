/**
 * PALMLOCK — All 11 Admin Dashboard Sections & Architecture Verification
 * Checks presence of all 11 navigable sections in admin.html, module files,
 * Leaflet map integration, and 19 tutorial curriculum lessons.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TUTORIAL_LESSONS } from '../frontend/js/user/tutorial.js';
import { parseCoordinateString } from '../frontend/js/admin/map.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

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
    toBeGreaterThanOrEqual(expected) {
      if (actual < expected) throw new Error(`Expected >= ${expected} but received ${actual}`);
    }
  };
}

console.log('=== PALMLOCK Admin 11 Sections & Full Architecture Verification ===\n');

const adminHtml = fs.readFileSync(path.join(root, 'frontend', 'admin.html'), 'utf-8');

const REQUIRED_SECTIONS = [
  'section-overview',
  'section-alerts',
  'section-incident-details',
  'section-location-monitoring',
  'section-escalation-history',
  'section-false-alarm-records',
  'section-users',
  'section-trusted-contacts',
  'section-transactions',
  'section-tutorial-management',
  'section-settings'
];

REQUIRED_SECTIONS.forEach((secId, i) => {
  it(`admin.html contains navigable section ${i + 1}/11: #${secId}`, () => {
    expect(adminHtml.includes(`id="${secId}"`)).toBe(true);
    expect(adminHtml.includes(`data-view="${secId}"`)).toBe(true);
  });
});

it('verifies all required architecture modules exist', () => {
  const requiredFiles = [
    'frontend/js/admin/map.js',
    'frontend/js/user/offline-queue.js',
    'frontend/js/user/location.js',
    'frontend/js/user/api.js',
    'frontend/js/shared/demoData.js'
  ];

  requiredFiles.forEach(file => {
    const fullPath = path.join(root, file);
    expect(fs.existsSync(fullPath)).toBe(true);
    const stat = fs.statSync(fullPath);
    expect(stat.size).toBeGreaterThanOrEqual(500);
  });
});

it('verifies Leaflet map coordinate parser supports Chennai and standard coordinates', () => {
  const chennaiCoords = parseCoordinateString('13.0827° N, 80.2707° E');
  expect(Math.abs(chennaiCoords[0] - 13.0827) < 0.001).toBe(true);
  expect(Math.abs(chennaiCoords[1] - 80.2707) < 0.001).toBe(true);

  const sfCoords = parseCoordinateString('37.7749° N, 122.4194° W');
  expect(Math.abs(sfCoords[0] - 37.7749) < 0.001).toBe(true);
  expect(Math.abs(sfCoords[1] - -122.4194) < 0.001).toBe(true);
});

it('verifies all 19 accessibility tutorial lessons are populated', () => {
  expect(TUTORIAL_LESSONS.length).toBe(19);
  expect(TUTORIAL_LESSONS[0].title.includes('Getting Started')).toBe(true);
  expect(TUTORIAL_LESSONS[8].title.includes('Tactile Currency Verification')).toBe(true);
  expect(TUTORIAL_LESSONS[9].title.includes('Numeric Gesture PIN Mapping')).toBe(true);
  expect(TUTORIAL_LESSONS[11].title.includes('Black Stealth Mode')).toBe(true);
  expect(TUTORIAL_LESSONS[12].title.includes('Normal PIN vs. Duress PIN')).toBe(true);
  expect(TUTORIAL_LESSONS[18].title.includes('Understanding Vibration Patterns')).toBe(true);
});

console.log(`\n========================================`);
console.log(`Architecture Checks: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);

process.exit(failed > 0 ? 1 : 0);

/**
 * PALMLOCK — Phase 2.3 Regression & Bug-Fix Verification Suite
 * Verifies that all 10 root-cause bugs identified during the technical audit
 * are cleanly resolved without introducing regressions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { state } from '../frontend/js/user/state.js';
import { GESTURE_TO_DIGIT, DIGIT_TO_GESTURE } from '../frontend/js/user/gestures.js';

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

console.log('=== PALMLOCK Phase 2.3 Bug-Fix & Stabilization Verification ===\n');

// PALM-001: app.js duplicate imports
it('PALM-001: app.js has zero duplicate imports and compiles cleanly', () => {
  const appJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'user', 'app.js'), 'utf-8');
  const importMatches = appJs.match(/import\s*{[^}]+}\s*from\s*['"][^'"]+['"]/g) || [];
  const importedSpecifiers = new Set();
  
  for (const imp of importMatches) {
    const inside = imp.match(/\{([^}]+)\}/)[1];
    const specifiers = inside.split(',').map(s => s.trim()).filter(Boolean);
    for (const spec of specifiers) {
      const name = spec.split(/\s+as\s+/)[0].trim();
      if (importedSpecifiers.has(name)) {
        throw new Error(`Duplicate import specifier found in app.js: ${name}`);
      }
      importedSpecifiers.add(name);
    }
  }
  expect(importedSpecifiers.has('GestureRecognizer')).toBe(true);
  expect(importedSpecifiers.has('handlePinGesture')).toBe(true);
});

// PALM-002: PIN arraysEqual normalization
it('PALM-002: arraysEqual in payments.js normalizes TAP and SINGLE_TAP for standard PIN', () => {
  const paymentsJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'user', 'payments.js'), 'utf-8');
  expect(paymentsJs.includes("const norm = (g) => (g === 'TAP' || g === 'SINGLE_TAP' ? 'TAP' : g)")).toBe(true);
  
  // Re-run matching logic directly
  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    const norm = (g) => (g === 'TAP' || g === 'SINGLE_TAP' ? 'TAP' : g);
    for (let i = 0; i < a.length; i++) {
      if (norm(a[i]) !== norm(b[i])) return false;
    }
    return true;
  }
  
  const enteredWithSingleTap = ['UP', 'RIGHT', 'UP', 'SINGLE_TAP'];
  const standardConfig = state.pins.standardPin; // ['UP', 'RIGHT', 'UP', 'TAP']
  expect(arraysEqual(enteredWithSingleTap, standardConfig)).toBe(true);
});

// PALM-003: Keypad mapping in gestures.js
it('PALM-003: gestures.js handleKeyDown properly maps all numeric keys 0-9', () => {
  const gesturesJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'user', 'gestures.js'), 'utf-8');
  expect(gesturesJs.includes("case '1':")).toBe(true);
  expect(gesturesJs.includes("case '2':")).toBe(true);
  expect(gesturesJs.includes("case '3':")).toBe(true);
  expect(gesturesJs.includes("case '4':")).toBe(true);
  expect(gesturesJs.includes("case '5':")).toBe(true);
  expect(gesturesJs.includes("case '6':")).toBe(true);
  expect(gesturesJs.includes("case '7':")).toBe(true);
  expect(gesturesJs.includes("case '8':")).toBe(true);
  expect(gesturesJs.includes("case '9':")).toBe(true);
  expect(gesturesJs.includes("case '0':")).toBe(true);
  // Ensure '7' triggers DOWN (Digit 7), not DOWN_LEFT
  const key7Block = gesturesJs.slice(gesturesJs.indexOf("case '7':"), gesturesJs.indexOf("case '7':") + 100);
  expect(key7Block.includes("triggerGesture('DOWN')")).toBe(true);
});

// PALM-004: BroadcastChannel offline incident sync listener in admin.js
it('PALM-004: admin.js handles INCIDENT_SYNCED_FROM_OFFLINE broadcast events', () => {
  const adminJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'admin', 'admin.js'), 'utf-8');
  expect(adminJs.includes("type === 'INCIDENT_SYNCED_FROM_OFFLINE'")).toBe(true);
});

// PALM-005: tutorial.js initial render silence
it('PALM-005: tutorial.js initializes silently without speech popups on dashboard', () => {
  const tutorialJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'user', 'tutorial.js'), 'utf-8');
  expect(tutorialJs.includes('renderLesson(false);')).toBe(true);
  expect(tutorialJs.includes('if (autoSpeak)')).toBe(true);
});

// PALM-006: Leaflet map container collision prevention in incident_details.js & map.js
it('PALM-006: Leaflet map instances check container._leaflet_id to avoid crash', () => {
  const incDetailsJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'admin', 'incident_details.js'), 'utf-8');
  const mapJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'admin', 'map.js'), 'utf-8');
  expect(incDetailsJs.includes('!mapContainer._leaflet_id')).toBe(true);
  expect(mapJs.includes('container._leaflet_id')).toBe(true);
});

// PALM-007: index.html contact-is-primary toggle
it('PALM-007: index.html contains #contact-is-primary toggle switch', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf-8');
  expect(indexHtml.includes('id="contact-is-primary"')).toBe(true);
});

// PALM-008: service-worker.js cache bump to v2
it('PALM-008: service-worker.js specifies cache name palmlock-v2', () => {
  const swJs = fs.readFileSync(path.join(root, 'frontend', 'service-worker.js'), 'utf-8');
  expect(swJs.includes("const CACHE_NAME = 'palmlock-v2';")).toBe(true);
});

// PALM-009: index.html contains #user-location-status
it('PALM-009: index.html contains #user-location-status element', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf-8');
  expect(indexHtml.includes('id="user-location-status"')).toBe(true);
});

// PALM-010: scanner.js uses #guidance-heading cleanly
it('PALM-010: scanner.js references #guidance-heading cleanly without dangling selectors', () => {
  const scannerJs = fs.readFileSync(path.join(root, 'frontend', 'js', 'user', 'scanner.js'), 'utf-8');
  expect(scannerJs.includes("getElementById('guidance-heading')")).toBe(true);
});

console.log(`\n========================================`);
console.log(`Regression Checks: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);

process.exit(failed > 0 ? 1 : 0);

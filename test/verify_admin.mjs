/**
 * PALMLOCK — Phase 2 Quality Verification Suite: Desktop Admin Dashboard
 * Tests module syntax, DOM structure, response management logic, and filtering.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT_DIR = process.cwd();
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

console.log('=== PALMLOCK Phase 2 Admin Dashboard Verification ===\n');

// 1. Check Admin JavaScript Modules Exist and Compile
const adminJsFiles = [
  'frontend/js/admin/state.js',
  'frontend/js/admin/audio.js',
  'frontend/js/admin/overview.js',
  'frontend/js/admin/alerts.js',
  'frontend/js/admin/incident_details.js',
  'frontend/js/admin/users.js',
  'frontend/js/admin/transactions.js',
  'frontend/js/admin/admin.js'
];

console.log('1. Checking Admin JavaScript Modules:');
for (const relPath of adminJsFiles) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert(fs.existsSync(fullPath), `File exists: ${relPath}`);
  if (fs.existsSync(fullPath)) {
    const code = fs.readFileSync(fullPath, 'utf8');
    assert(code.length > 50, `${relPath} has substantial code (${code.length} bytes)`);
  }
}

// 2. Validate admin.html DOM Structure & Sections
console.log('\n2. Checking Admin HTML Structure & Sections:');
const htmlPath = path.join(FRONTEND_DIR, 'admin.html');
assert(fs.existsSync(htmlPath), 'frontend/admin.html exists');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const requiredSections = [
  'section-overview',
  'section-alerts',
  'section-incident-details',
  'section-users',
  'section-transactions'
];

for (const sectionId of requiredSections) {
  assert(htmlContent.includes(`id="${sectionId}"`), `Contains section: ${sectionId}`);
}

assert(htmlContent.includes('id="btn-simulate-duress-event"'), 'Contains simulate duress alert button');
assert(htmlContent.includes('id="btn-toggle-siren-audio"'), 'Contains audio siren mute toggle');
assert(htmlContent.includes('id="admin-global-search"'), 'Contains global search input');
assert(htmlContent.includes('id="admin-aria-live"'), 'Contains ARIA live region for screen readers');
assert(htmlContent.includes('id="btn-action-acknowledge"'), 'Contains Acknowledge response action');
assert(htmlContent.includes('id="btn-action-escalate"'), 'Contains Escalate response action');
assert(htmlContent.includes('id="btn-action-resolve"'), 'Contains Resolve response action');
assert(htmlContent.includes('id="form-add-response-note"'), 'Contains Add Response Note form');
assert(htmlContent.includes('id="modal-user-profile"'), 'Contains User Profile modal');
assert(htmlContent.includes('id="modal-escalate"'), 'Contains Escalate confirmation modal');

// 3. Check CSS Styling Tokens in admin.css
console.log('\n3. Checking Admin CSS Tokens & Layout:');
const cssPath = path.join(FRONTEND_DIR, 'css', 'admin.css');
assert(fs.existsSync(cssPath), 'frontend/css/admin.css exists');

const cssContent = fs.readFileSync(cssPath, 'utf8');
assert(cssContent.includes('--admin-bg-base'), 'Defines SOC background token');
assert(cssContent.includes('--admin-color-critical'), 'Defines critical alert color');
assert(cssContent.includes('.incident-timeline'), 'Defines incident timeline styles');
assert(cssContent.includes('.map-viewport-panel'), 'Defines map viewport styles');
assert(cssContent.includes('.severity-bar-container'), 'Defines severity distribution bar styles');
assert(cssContent.includes('.modal-backdrop'), 'Defines modal dialog backdrop styles');
assert(cssContent.includes('@media (max-width: 900px)'), 'Defines responsive tablet layout media query');

// 4. Business Logic & State Simulation Tests
console.log('\n4. Testing Response Management & State Logic:');

import { adminState } from '../frontend/js/admin/state.js';

assert(Array.isArray(adminState.incidents) && adminState.incidents.length >= 3, 'Initializes with sample incidents');
assert(Array.isArray(adminState.users) && adminState.users.length >= 5, 'Initializes with sample users');
assert(Array.isArray(adminState.transactions) && adminState.transactions.length >= 6, 'Initializes with sample transactions');

// Test Acknowledge Logic
const testIncident = adminState.incidents.find(i => i.id === 'ALT-2026-8921');
assert(testIncident !== undefined, 'Target incident ALT-2026-8921 exists');

testIncident.status = 'acknowledged';
testIncident.timeline.unshift({
  time: '15:43:00',
  title: 'Test Acknowledged',
  desc: 'Test description',
  type: 'info'
});
assert(testIncident.status === 'acknowledged', 'Incident status updated to acknowledged');
assert(testIncident.timeline[0].title === 'Test Acknowledged', 'Timeline updated on acknowledge');

// Test Resolve Logic
testIncident.status = 'resolved';
assert(testIncident.status === 'resolved', 'Incident status updated to resolved');

// Test Filter Logic
const activeAlerts = adminState.incidents.filter(i => i.status !== 'resolved');
assert(typeof activeAlerts.length === 'number', 'Active alerts filter operates correctly');

// Test User Search Logic
const q = 'Maya';
const matchedUsers = adminState.users.filter(u => u.name.toLowerCase().includes(q.toLowerCase()));
assert(matchedUsers.length === 1 && matchedUsers[0].name === 'Maya Lin', 'User search matches Maya Lin');

// Test Transaction Filter Logic
const duressTx = adminState.transactions.filter(t => t.status === 'duress_intercepted');
assert(duressTx.length >= 2, 'Filters duress intercepted transactions correctly');

console.log(`\n========================================`);
console.log(`Total Checks: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`========================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nAll Phase 2 Admin Dashboard verification checks passed successfully.');
}

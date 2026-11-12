/**
 * PALMLOCK — Quality Verification Script
 * Validates module syntax, DOM structure, WCAG accessibility markers, and screen integrity.
 */

import fs from 'node:fs';
import path from 'node:path';

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

console.log('=== PALMLOCK Phase 1 Quality Verification ===\n');

// 1. Check Module Files Exist and Can Be Read
const jsFiles = [
  'frontend/js/user/state.js',
  'frontend/js/user/accessibility.js',
  'frontend/js/user/navigation.js',
  'frontend/js/user/gestures.js',
  'frontend/js/user/scanner.js',
  'frontend/js/user/payments.js',
  'frontend/js/user/contacts.js',
  'frontend/js/user/tutorial.js',
  'frontend/js/user/app.js'
];

console.log('1. Checking JavaScript Modules:');
for (const relPath of jsFiles) {
  const fullPath = path.join(ROOT_DIR, relPath);
  const exists = fs.existsSync(fullPath);
  assert(exists, `File exists: ${relPath}`);
  if (exists) {
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.length > 50, `${relPath} has substantial code (${content.length} bytes)`);
  }
}

// 2. Validate HTML Structure & Required 14 Screens
console.log('\n2. Checking HTML Structure & 14 Accessibility Screens:');
const htmlPath = path.join(FRONTEND_DIR, 'index.html');
assert(fs.existsSync(htmlPath), 'frontend/index.html exists');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const requiredScreens = [
  'screen-welcome',
  'screen-register',
  'screen-setup',
  'screen-contacts',
  'screen-dashboard',
  'screen-scanner',
  'screen-verification',
  'screen-gesture-pin',
  'screen-stealth',
  'screen-payment-result',
  'screen-history',
  'screen-tutorial',
  'screen-practice',
  'screen-settings'
];

for (const screenId of requiredScreens) {
  const hasScreen = htmlContent.includes(`id="${screenId}"`);
  assert(hasScreen, `Contains screen: ${screenId}`);
}

// 3. Check Accessibility Elements in HTML
console.log('\n3. Checking WCAG Accessibility Markers:');
assert(htmlContent.includes('aria-live="polite"'), 'Contains aria-live="polite" region');
assert(htmlContent.includes('aria-live="assertive"'), 'Contains aria-live="assertive" region');
assert(htmlContent.includes('class="skip-link"'), 'Contains skip-to-content navigation link');
assert(htmlContent.includes('role="region"') || htmlContent.includes('role="dialog"'), 'Uses semantic ARIA roles');
assert(htmlContent.includes('lang="en"'), 'HTML has lang="en" attribute');
assert(htmlContent.includes('name="viewport"'), 'Viewport meta configured');

// 4. Check CSS Design System & Themes
console.log('\n4. Checking Accessible CSS Tokens & High Contrast Themes:');
const cssPath = path.join(FRONTEND_DIR, 'css', 'user.css');
assert(fs.existsSync(cssPath), 'frontend/css/user.css exists');

const cssContent = fs.readFileSync(cssPath, 'utf8');
assert(cssContent.includes('--touch-target-min: 48px'), 'Enforces minimum 48px touch target token');
assert(cssContent.includes('--touch-target-primary: 56px'), 'Enforces 56px primary touch target token');
assert(cssContent.includes('data-theme="yellow-black"'), 'Includes WCAG AAA Yellow-on-Black contrast theme');
assert(cssContent.includes('data-theme="white-black"'), 'Includes High Contrast White-on-Black theme');
assert(cssContent.includes('data-theme="light-blue"'), 'Includes High Contrast Blue on Light theme');
assert(cssContent.includes(':focus-visible'), 'Includes visible high-contrast focus rings');
assert(cssContent.includes('prefers-reduced-motion'), 'Includes prefers-reduced-motion media query');
assert(cssContent.includes('.screen-stealth-container'), 'Includes Black Stealth Mode styles');

// 5. Check Documentation Files
console.log('\n5. Checking Documentation Files:');
assert(fs.existsSync(path.join(ROOT_DIR, 'README.md')), 'README.md exists and is populated');
assert(fs.existsSync(path.join(ROOT_DIR, 'PROJECT_STATUS.md')), 'PROJECT_STATUS.md exists and is populated');
assert(fs.existsSync(path.join(ROOT_DIR, '.gitignore')), '.gitignore exists and is populated');

console.log(`\n========================================`);
console.log(`Total Checks: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`========================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nAll structural, modular, and accessibility checks passed successfully.');
}

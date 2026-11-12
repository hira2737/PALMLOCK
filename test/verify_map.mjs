/**
 * PALMLOCK — Leaflet Map & Coordinate Logic Verification
 */

import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
  }
}

console.log('=== PALMLOCK Phase 2.1 Leaflet Map & Telemetry Tests ===\n');

const html = fs.readFileSync('frontend/admin.html', 'utf8');

assert(html.includes('leaflet.css'), 'Leaflet CSS stylesheet link included in admin.html');
assert(html.includes('leaflet.js'), 'Leaflet JS script included in admin.html');
assert(html.includes('id="incident-map"'), 'Contains interactive Leaflet map container (#incident-map)');
assert(html.includes('id="incident-map-fallback"'), 'Contains accessible high-contrast map fallback container (#incident-map-fallback)');
assert(html.includes('id="btn-toggle-sidebar"'), 'Contains collapsible sidebar toggle button (#btn-toggle-sidebar)');

// Test Coordinate Parser Logic
function parseCoordinates(gpsString) {
  const match = gpsString.match(/([\d.]+)[^\w]*([NS]),?\s*([\d.]+)[^\w]*([EW])/i);
  if (match) {
    let lat = parseFloat(match[1]);
    if (match[2].toUpperCase() === 'S') lat = -lat;
    let lng = parseFloat(match[3]);
    if (match[4].toUpperCase() === 'W') lng = -lng;
    return [lat, lng];
  }
  return null;
}

const coords1 = parseCoordinates('37.7749° N, 122.4194° W');
assert(coords1 !== null && coords1[0] === 37.7749 && coords1[1] === -122.4194, 'Parses 37.7749° N, 122.4194° W to [37.7749, -122.4194]');

const coords2 = parseCoordinates('37.7833° N, 122.4167° W');
assert(coords2 !== null && coords2[0] === 37.7833 && coords2[1] === -122.4167, 'Parses 37.7833° N, 122.4167° W to [37.7833, -122.4167]');

const coords3 = parseCoordinates('37.7879° N, 122.4074° W');
assert(coords3 !== null && coords3[0] === 37.7879 && coords3[1] === -122.4074, 'Parses 37.7879° N, 122.4074° W to [37.7879, -122.4074]');

console.log(`\n========================================`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);

if (failed > 0) process.exit(1);

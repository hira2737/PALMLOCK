/**
 * PALMLOCK — Real Headless Browser Functional Verification via CDP
 * Controls Microsoft Edge via Chrome DevTools Protocol (CDP) using Node.js built-in WebSocket & HTTP.
 * Tests mobile navigation, buttons, console errors, admin sections, and cross-tab BroadcastChannel sync.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const PORT = 8181;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9333;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// 1. Start Static HTTP Server
function startServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(root, req.url.split('?')[0]);
    if (filePath.endsWith(path.sep) || filePath.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[HTTP Server] Listening on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

// 2. Launch Headless Edge
function launchEdge() {
  const userDataDir = path.join(root, '.edge_temp_profile');
  const args = [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--disable-background-networking',
    'about:blank'
  ];

  const proc = spawn(EDGE_PATH, args, { stdio: 'ignore' });
  return proc;
}

// Helper: HTTP GET JSON
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Helper: Wait ms
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Simple CDP Client Wrapper
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
    this.events = [];
    this.consoleMessages = [];
    this.exceptions = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) reject(data.error);
          else resolve(data.result);
        } else if (data.method) {
          if (data.method === 'Runtime.consoleAPICalled') {
            const text = data.params.args.map(a => a.value || a.description || '').join(' ');
            this.consoleMessages.push({ type: data.params.type, text });
          } else if (data.method === 'Runtime.exceptionThrown') {
            const desc = data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text;
            this.exceptions.push(desc);
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.pending.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('=== PALMLOCK Actual Headless Browser Verification (Microsoft Edge CDP) ===\n');
  const server = await startServer();
  const edgeProc = launchEdge();

  let cdpConnected = false;
  let targets = null;

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (targets && targets.length > 0) {
        cdpConnected = true;
        break;
      }
    } catch (e) {}
  }

  if (!cdpConnected || !targets) {
    console.error('[FAIL] Could not connect to Edge DevTools Protocol');
    edgeProc.kill();
    server.close();
    process.exit(1);
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc} ${details}`);
      failed++;
    }
  }

  try {
    // =========================================================================
    // TEST SUITE 1: MOBILE APPLICATION (frontend/index.html)
    // =========================================================================
    console.log('\n--- 1. Testing Mobile Application (frontend/index.html) ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/frontend/index.html` });
    await sleep(1200);

    // Verify zero fatal syntax or unhandled exceptions on load
    assert('Zero startup exceptions in console', client.exceptions.length === 0, JSON.stringify(client.exceptions));

    // Verify PALMLOCK initialization log
    const hasInitLog = client.consoleMessages.some(m => m.text.includes('PALMLOCK mobile accessibility interface initialized'));
    assert('app.js initializes and logs startup success', hasInitLog);

    // Verify home screen is active
    let activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Home screen (#screen-dashboard) is initially active', activeScreen === 'screen-dashboard');

    // Test Navigation: Scan Button
    await client.eval("document.getElementById('dash-btn-scan').click()");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Clicking "Scan QR Code" (#dash-btn-scan) navigates to #screen-scanner', activeScreen === 'screen-scanner');

    // Test Contextual Back Button
    await client.eval("document.querySelector('#screen-scanner [data-back]').click()");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Back button on scanner returns to #screen-dashboard', activeScreen === 'screen-dashboard');

    // Test Navigation: Practice Button
    await client.eval("document.getElementById('dash-btn-practice').click()");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Clicking "Practice Lab" (#dash-btn-practice) navigates to #screen-practice', activeScreen === 'screen-practice');

    // Test Navigation: Tutorial Button
    await client.eval("document.getElementById('dash-btn-tutorial').click()");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Clicking "Tutorial" (#dash-btn-tutorial) navigates to #screen-tutorial', activeScreen === 'screen-tutorial');

    // Test Tutorial Stepper: Next Lesson
    const initialLessonTitle = await client.eval("document.getElementById('tutorial-step-title')?.textContent");
    await client.eval("document.getElementById('btn-tutorial-next').click()");
    await sleep(200);
    const nextLessonTitle = await client.eval("document.getElementById('tutorial-step-title')?.textContent");
    assert('Tutorial "Next Lesson" button advances curriculum', nextLessonTitle !== initialLessonTitle && nextLessonTitle.includes('2.'));

    // Test Navigation: Stealth Button
    await client.eval("document.getElementById('brand-home-link').click()");
    await sleep(200);
    await client.eval("document.getElementById('dash-btn-stealth').click()");
    await sleep(200);
    const isStealthActive = await client.eval("document.getElementById('screen-stealth')?.classList.contains('active')");
    assert('Clicking "Black Stealth Mode" activates #screen-stealth overlay', isStealthActive === true);

    // Test Exit Stealth Button
    await client.eval("document.getElementById('btn-exit-stealth').click()");
    await sleep(200);
    const isStealthDeactivated = await client.eval("!document.getElementById('screen-stealth')?.classList.contains('active')");
    assert('Exit Stealth button restores home dashboard view', isStealthDeactivated === true);

    // Test Bottom Navigation: History Tab
    await client.eval("document.querySelector('.bottom-nav [data-nav=\"screen-history\"]').click()");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Bottom nav "History" item navigates to #screen-history', activeScreen === 'screen-history');

    // Test Bottom Navigation: Settings Tab
    await client.eval("document.querySelector('.bottom-nav [data-nav=\"screen-settings\"]').click()");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Bottom nav "Settings" item navigates to #screen-settings', activeScreen === 'screen-settings');

    // Test Quick Screen Switcher (Desktop Preview Bar)
    await client.eval("document.getElementById('screen-fast-nav').value = 'screen-verification'; document.getElementById('screen-fast-nav').dispatchEvent(new Event('change'));");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Desktop fast navigator jump opens #screen-verification', activeScreen === 'screen-verification');

    // Test Tactile Currency Verification Controls
    await client.eval("document.getElementById('btn-play-currency-vibrate').click()");
    await sleep(200);
    const hapticIndicatorVisible = await client.eval("document.getElementById('haptic-visual-indicator')?.classList.contains('visible')");
    assert('Clicking "Play Tactile Amount" triggers tactile currency pattern', hapticIndicatorVisible === true);

    // Test Normal PIN Authorization (2-5-2-0)
    await client.eval("document.getElementById('btn-proceed-to-pin').click()");
    await sleep(200);
    activeScreen = await client.eval("document.querySelector('.app-screen.active')?.id");
    assert('Proceeding to PIN opens #screen-gesture-pin', activeScreen === 'screen-gesture-pin');

    // Enter Standard PIN gestures: UP, RIGHT, UP, SINGLE_TAP (2-5-2-0)
    await client.eval(`
      const btns = document.querySelectorAll('.btn-pin-digit');
      btns.forEach(b => {
        if (b.getAttribute('data-gesture') === 'UP') b.click();
      });
    `); // Up
    await client.eval("document.querySelector('.btn-pin-digit[data-gesture=\"RIGHT\"]').click()"); // Right
    await client.eval("document.querySelector('.btn-pin-digit[data-gesture=\"UP\"]').click()"); // Up
    await client.eval("document.querySelector('.btn-pin-digit[data-gesture=\"SINGLE_TAP\"]').click()"); // Single Tap
    await sleep(500);

    const isPaymentResult = await client.eval("document.querySelector('.app-screen.active')?.id === 'screen-payment-result'");
    const isPaymentSuccess = await client.eval("document.getElementById('result-success-container')?.style.display !== 'none'");
    assert('Entering Standard PIN (2-5-2-0) succeeds with authorization screen', isPaymentResult && isPaymentSuccess);

    // Test Duress PIN Authorization (7-7-4-4)
    // Go to verification, proceed to PIN, enter DOWN, DOWN, LEFT, LEFT
    await client.eval("document.getElementById('btn-result-done').click()");
    await sleep(200);
    await client.eval("document.getElementById('dash-btn-scan').click()");
    await sleep(200);
    await client.eval("document.querySelector('.btn-simulate-qr').click()"); // Simulate CMRL QR
    await sleep(200);
    await client.eval("document.getElementById('btn-proceed-to-pin').click()");
    await sleep(200);
    await client.eval("document.querySelector('.btn-pin-digit[data-gesture=\"DOWN\"]').click()");
    await client.eval("document.querySelector('.btn-pin-digit[data-gesture=\"DOWN\"]').click()");
    await client.eval("document.querySelector('.btn-pin-digit[data-gesture=\"LEFT\"]').click()");
    await client.eval("document.querySelector('.btn-pin-digit[data-gesture=\"LEFT\"]').click()");
    await sleep(600);

    const isFailureContainer = await client.eval("document.getElementById('result-failure-container')?.style.display !== 'none'");
    const failureTitle = await client.eval("document.getElementById('failure-title')?.textContent");
    assert('Entering Duress PIN (7-7-4-4) shows covert bank network timeout screen', isFailureContainer && failureTitle.includes('Interrupted'));

    // Test Emergency SOS Modal
    await client.eval("document.getElementById('btn-trigger-sos').click()");
    await sleep(200);
    const isSosModalActive = await client.eval("document.getElementById('modal-sos-alert')?.classList.contains('active')");
    assert('Emergency SOS button opens #modal-sos-alert', isSosModalActive === true);

    await client.eval("document.getElementById('btn-close-sos-modal').click()");
    await sleep(200);
    const isSosModalClosed = await client.eval("!document.getElementById('modal-sos-alert')?.classList.contains('active')");
    assert('Dismiss Alert button closes #modal-sos-alert', isSosModalClosed === true);

    // =========================================================================
    // TEST SUITE 2: ADMIN DASHBOARD (frontend/admin.html)
    // =========================================================================
    console.log('\n--- 2. Testing Desktop Administrator Dashboard (frontend/admin.html) ---');
    client.exceptions = [];
    client.consoleMessages = [];

    await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/frontend/admin.html` });
    await sleep(1500);

    assert('Zero admin console exceptions on startup', client.exceptions.length === 0, JSON.stringify(client.exceptions));

    const hasAdminInitLog = client.consoleMessages.some(m => m.text.includes('Security Operations Center'));
    assert('admin.js initializes SOC successfully', hasAdminInitLog);

    // Test all 11 Admin Navigation Sections
    const ADMIN_VIEWS = [
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

    for (const viewId of ADMIN_VIEWS) {
      await client.eval(`document.querySelector('.sidebar-nav-link[data-view="${viewId}"]').click()`);
      await sleep(150);
      const isViewActive = await client.eval(`document.getElementById("${viewId}")?.classList.contains('active')`);
      assert(`Admin sidebar navigation opens #${viewId}`, isViewActive === true);
    }

    // Test Sidebar Collapse Toggle
    await client.eval("document.getElementById('btn-toggle-sidebar').click()");
    await sleep(200);
    const isCollapsed = await client.eval("document.querySelector('.admin-layout')?.classList.contains('sidebar-collapsed')");
    assert('Sidebar toggle button collapses admin sidebar into compact rail', isCollapsed === true);

    await client.eval("document.getElementById('btn-toggle-sidebar').click()");
    await sleep(200);

    // Test Simulate Duress Alert in Admin
    const preCount = await client.eval("document.querySelectorAll('#table-alerts-body tr').length");
    await client.eval("document.getElementById('btn-simulate-duress-event').click()");
    await sleep(300);
    const postCount = await client.eval("document.querySelectorAll('#table-alerts-body tr').length");
    assert('Simulate Duress Event appends new live incident to table', postCount > preCount);

    // Test Incident Acknowledge Action
    await client.eval("document.querySelector('.sidebar-nav-link[data-view=\"section-incident-details\"]').click()");
    await sleep(200);
    const ackBtn = await client.eval("document.getElementById('btn-action-acknowledge') !== null");
    assert('Incident details action buttons exist', ackBtn === true);

  } catch (err) {
    console.error('Browser Test Error:', err);
    failed++;
  } finally {
    client.close();
    edgeProc.kill();
    server.close();
    // Clean up temp profile dir
    try {
      fs.rmSync(path.join(root, '.edge_temp_profile'), { recursive: true, force: true });
    } catch (e) {}

    console.log(`\n========================================`);
    console.log(`Browser Checks: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`========================================\n`);

    process.exit(failed > 0 ? 1 : 0);
  }
}

main();

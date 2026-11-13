/**
 * PALMLOCK — Touch Beyond Vision
 * Payment Verification, Digit-by-Digit Tactile Currency Engine, Duress Detection & Transaction Ledger
 * Fully Localized for Indian Rupee (INR ₹)
 */

import { state } from './state.js';
import { provideFeedback, playGestureAudio } from './accessibility.js';
import { navigateTo, openModal } from './navigation.js';
import { clearPinGestures } from './gestures.js';
import { apiReportEmergency } from './api.js';
import { captureEmergencyLocation } from './location.js';

let activeVibrationTimeout = null;
let isVibratingPattern = false;

/**
 * Configure active in-flight transaction
 */
export function setPendingTransaction(txData) {
  state.currentTransaction = { ...state.currentTransaction, ...txData };
  updateVerificationScreen();
}

/**
 * Refresh DOM with current transaction details
 */
export function updateVerificationScreen() {
  const tx = state.currentTransaction;
  const nameEl = document.getElementById('verify-merchant-name');
  const amountEl = document.getElementById('verify-amount-display');
  const hashEl = document.getElementById('verify-qr-hash');

  if (nameEl) nameEl.textContent = tx.merchantName;
  if (amountEl) {
    const sym = tx.currencySymbol || '₹';
    amountEl.textContent = `${sym}${tx.amount.toFixed(2)}`;
    amountEl.setAttribute('aria-label', `Amount to pay: ${formatCurrencySpoken(tx.amount)}`);
  }
  if (hashEl) hashEl.textContent = tx.qrHash;
}

/**
 * Audio Readout of Payment Details
 */
export function readPaymentDetails() {
  const tx = state.currentTransaction;
  const spokenText = `Payment verification. Merchant: ${tx.merchantName}. Verified merchant. Amount: ${formatCurrencySpoken(tx.amount)}. Zero rupee processing fee. Press Proceed to Gesture PIN to authorize, or tap Tactile Currency Pattern to feel the digits.`;

  provideFeedback({
    text: spokenText,
    priority: true,
    hapticPattern: [50, 50],
    hapticLabel: 'Readout payment summary'
  });
}

/**
 * =========================================================================
 * PRIORITY 2: TACTILE CURRENCY VERIFICATION (Digit-by-Digit Vibration)
 * =========================================================================
 * Formats amount into hundreds, tens, and ones:
 * Example: ₹257
 * - Hundreds (2): Two long pulses (250ms pulse, 150ms gap)
 * - Group pause: 600ms
 * - Tens (5): Five medium pulses (120ms pulse, 100ms gap)
 * - Group pause: 600ms
 * - Ones (7): Seven short pulses (50ms pulse, 80ms gap)
 */

export function generateTactileCurrencyPattern(amount) {
  const intAmount = Math.floor(amount);
  const hundreds = Math.floor((intAmount % 1000) / 100);
  const tens = Math.floor((intAmount % 100) / 10);
  const ones = intAmount % 10;

  const pattern = [];
  const explanationParts = [];

  // 1. Hundreds Digit (Long Pulses: 250ms on, 150ms off)
  if (hundreds > 0) {
    explanationParts.push(`${hundreds} hundred${hundreds > 1 ? 's' : ''}`);
    for (let i = 0; i < hundreds; i++) {
      pattern.push(250);
      pattern.push(150);
    }
    // Group separator pause
    pattern.push(600);
  } else if (intAmount >= 100) {
    // Zero in hundreds column: quick double micro-tap
    pattern.push(40);
    pattern.push(60);
    pattern.push(40);
    pattern.push(600);
  }

  // 2. Tens Digit (Medium Pulses: 120ms on, 100ms off)
  if (tens > 0) {
    explanationParts.push(`${tens} ten${tens > 1 ? 's' : ''}`);
    for (let i = 0; i < tens; i++) {
      pattern.push(120);
      pattern.push(100);
    }
    // Group separator pause
    pattern.push(600);
  } else if (intAmount >= 10 && ones > 0) {
    // Zero tens (e.g. 205): zero micro-pulse
    pattern.push(40);
    pattern.push(60);
    pattern.push(40);
    pattern.push(600);
  }

  // 3. Ones Digit (Short Pulses: 50ms on, 80ms off)
  if (ones > 0) {
    explanationParts.push(`${ones} one${ones > 1 ? 's' : ''}`);
    for (let i = 0; i < ones; i++) {
      pattern.push(50);
      pattern.push(80);
    }
  } else {
    // Zero ones: short double tick
    pattern.push(40);
    pattern.push(60);
    pattern.push(40);
  }

  const spokenBreakdown = `${explanationParts.join(', ')}. Total: ${intAmount} Rupees.`;

  return {
    hundreds,
    tens,
    ones,
    pattern,
    spokenBreakdown,
    total: intAmount
  };
}

/**
 * Play Tactile Currency Pattern
 */
export function playTactileCurrencyPattern(amount = null) {
  stopTactileCurrencyPattern();

  const amt = amount !== null ? amount : state.currentTransaction.amount;
  const { hundreds, tens, ones, pattern, spokenBreakdown } = generateTactileCurrencyPattern(amt);

  isVibratingPattern = true;

  // Speak explanation before or alongside vibration
  provideFeedback({
    text: `Vibrating payment amount: ${spokenBreakdown}. Long pulses are hundreds, medium pulses are tens, short pulses are ones.`,
    priority: true
  });

  // Calculate total duration
  const totalDuration = pattern.reduce((acc, curr) => acc + curr, 0);

  // Trigger physical vibration if supported
  if (navigator.vibrate && state.preferences.hapticEnabled) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration API error:', e);
    }
  }

  // Update visual haptic feedback indicator for desktop/sighted testing
  const indicator = document.getElementById('haptic-visual-indicator');
  if (indicator) {
    indicator.textContent = `Tactile Amount: [${hundreds} Hundreds (Long) • ${tens} Tens (Med) • ${ones} Ones (Short)]`;
    indicator.classList.add('visible');
  }

  // Auto-clear active flag when pattern finishes
  activeVibrationTimeout = setTimeout(() => {
    isVibratingPattern = false;
    if (indicator) indicator.classList.remove('visible');
  }, totalDuration + 200);
}

/**
 * Stop any active currency vibration pattern
 */
export function stopTactileCurrencyPattern() {
  if (activeVibrationTimeout) {
    clearTimeout(activeVibrationTimeout);
    activeVibrationTimeout = null;
  }
  isVibratingPattern = false;

  if (navigator.vibrate) {
    try {
      navigator.vibrate(0); // Cancel ongoing vibration
    } catch (e) {}
  }

  const indicator = document.getElementById('haptic-visual-indicator');
  if (indicator) {
    indicator.classList.remove('visible');
  }
}

/**
 * Repeat active currency pattern
 */
export function repeatTactileCurrencyPattern() {
  playTactileCurrencyPattern(state.currentTransaction.amount);
}

/**
 * Evaluate Entered 4-Gesture Sequence
 */
export function verifyEnteredPin(enteredSequence) {
  const standard = state.pins.standardPin;
  const duress = state.pins.duressPin;

  const isStandardMatch = arraysEqual(enteredSequence, standard);
  const isDuressMatch = arraysEqual(enteredSequence, duress);

  clearPinGestures();

  if (isStandardMatch) {
    handlePaymentSuccess();
  } else if (isDuressMatch) {
    handleDuressPinTrigger();
  } else {
    handlePaymentFailure('Incorrect gesture PIN sequence entered.');
  }
}

/**
 * Handle Standard Payment Authorization Success
 */
function handlePaymentSuccess() {
  const tx = state.currentTransaction;
  const sym = tx.currencySymbol || '₹';

  // Deduct balance
  state.user.balance = Math.max(0, state.user.balance - tx.amount);
  const balanceEl = document.getElementById('dashboard-balance');
  if (balanceEl) {
    balanceEl.textContent = `${sym}${state.user.balance.toFixed(2)}`;
  }

  // Prepend to transaction ledger
  const newTx = {
    id: `tx_${Date.now()}`,
    merchant: tx.merchantName,
    category: tx.category,
    amount: tx.amount,
    currency: 'INR',
    status: 'completed',
    isDuress: false,
    date: 'Today, Just now',
    reference: tx.referenceId
  };
  state.transactions.unshift(newTx);

  // Update UI Elements
  const resTitle = document.getElementById('result-title');
  const resAmount = document.getElementById('result-amount');
  const resMerchant = document.getElementById('result-merchant-label');
  const resRef = document.getElementById('result-ref');
  const resTime = document.getElementById('result-time');

  if (resTitle) resTitle.textContent = 'Payment Successful';
  if (resAmount) resAmount.textContent = `${sym}${tx.amount.toFixed(2)}`;
  if (resMerchant) resMerchant.textContent = `Paid to ${tx.merchantName}`;
  if (resRef) resRef.textContent = tx.referenceId;
  if (resTime) resTime.textContent = 'Today, Just now';

  const succContainer = document.getElementById('result-success-container');
  const failContainer = document.getElementById('result-failure-container');
  if (succContainer) succContainer.style.display = 'block';
  if (failContainer) failContainer.style.display = 'none';

  navigateTo('screen-payment-result');

  provideFeedback({
    text: `Payment of ${formatCurrencySpoken(tx.amount)} to ${tx.merchantName} successful. Reference: ${tx.referenceId}.`,
    gesture: 'SUCCESS',
    hapticPattern: [100, 50, 150],
    hapticLabel: 'Payment Successful',
    priority: true
  });

  renderHistoryList();
  renderDashboardRecentTransactions();
}

/**
 * Handle Discreet Duress PIN Activation
 * Covert safety protocol: Appears to bystander as a bank network timeout/error,
 * while silently logging duress event and triggering emergency telemetry!
 */
async function handleDuressPinTrigger() {
  const tx = state.currentTransaction;

  // Log Duress event in transaction history
  const duressTx = {
    id: `tx_dur_${Date.now()}`,
    merchant: tx.merchantName,
    category: 'Security Duress Flagged',
    amount: tx.amount,
    currency: 'INR',
    status: 'duress_intercepted',
    isDuress: true,
    date: 'Today, Just now',
    reference: `DUR-${Math.floor(100000 + Math.random() * 900000)}`
  };
  state.transactions.unshift(duressTx);

  // Present realistic cover screen (looks like banking gateway timeout)
  const failTitle = document.getElementById('failure-title');
  const failReason = document.getElementById('failure-reason');
  if (failTitle) failTitle.textContent = 'Transaction Interrupted';
  if (failReason) {
    failReason.textContent = 'Network Gateway Timeout (Code 504). No funds were withdrawn from your account.';
  }

  const succContainer = document.getElementById('result-success-container');
  const failContainer = document.getElementById('result-failure-container');
  if (succContainer) succContainer.style.display = 'none';
  if (failContainer) failContainer.style.display = 'block';

  navigateTo('screen-payment-result');

  // Covert Haptic: Long pulse followed by 3 micro pulses (silent duress confirmation)
  provideFeedback({
    text: 'Transaction interrupted. Bank network timeout.',
    gesture: 'ERROR',
    hapticPattern: [300, 100, 50, 50, 50],
    hapticLabel: 'Silent Duress Dispatched',
    priority: true
  });

  // Rapidly capture GPS location and dispatch emergency record
  const loc = await captureEmergencyLocation();
  const incidentRecord = await apiReportEmergency({
    type: 'DURESS',
    userId: state.user.id,
    userName: state.user.name,
    userPhone: state.user.phone,
    location: loc.coords,
    lat: loc.lat,
    lng: loc.lng,
    accuracyMeters: loc.accuracyMeters
  });

  console.info('PALMLOCK: Duress incident telemetry logged:', incidentRecord.id);

  renderHistoryList();
  renderDashboardRecentTransactions();
}

/**
 * Handle Payment Failure / Rejection
 */
function handlePaymentFailure(reason) {
  const failTitle = document.getElementById('failure-title');
  const failReason = document.getElementById('failure-reason');
  if (failTitle) failTitle.textContent = 'Payment Not Authorized';
  if (failReason) failReason.textContent = reason || 'Verification error.';

  const succContainer = document.getElementById('result-success-container');
  const failContainer = document.getElementById('result-failure-container');
  if (succContainer) succContainer.style.display = 'none';
  if (failContainer) failContainer.style.display = 'block';

  navigateTo('screen-payment-result');

  provideFeedback({
    text: `Payment declined. ${reason}`,
    gesture: 'ERROR',
    hapticPattern: [150, 100, 150],
    hapticLabel: 'PIN Mismatch Error',
    priority: true
  });
}

/**
 * Render Payment History List
 */
export function renderHistoryList(filter = 'all') {
  const container = document.getElementById('history-full-list');
  if (!container) return;

  container.innerHTML = '';

  const filtered = state.transactions.filter(t => {
    if (filter === 'completed') return t.status === 'completed';
    if (filter === 'duress') return t.isDuress === true;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">No transactions found matching this filter.</div>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'history-item';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${item.merchant}, ₹${item.amount.toFixed(2)}, ${item.date}, ${item.isDuress ? 'Duress Flagged' : 'Completed'}`);

    const badgeClass = item.isDuress ? 'history-badge duress' : 'history-badge success';
    const badgeText = item.isDuress ? 'Duress Protected' : 'Completed';

    card.innerHTML = `
      <div class="history-item-left">
        <div class="history-merchant">${escapeHTML(item.merchant)}</div>
        <div class="history-date">${escapeHTML(item.date)} • Ref: ${escapeHTML(item.reference)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-amount">₹${item.amount.toFixed(2)}</div>
        <span class="${badgeClass}">${badgeText}</span>
      </div>
    `;

    // Click / Enter speaks out full breakdown
    const speakBreakdown = () => {
      const speech = `Transaction with ${item.merchant}. Amount: ${formatCurrencySpoken(item.amount)}. Status: ${badgeText}. Recorded ${item.date}. Reference ID ${item.reference}.`;
      provideFeedback({ text: speech, priority: true });
    };

    card.addEventListener('click', speakBreakdown);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        speakBreakdown();
      }
    });

    container.appendChild(card);
  });
}

/**
 * Render Dashboard Recent 2 Transactions
 */
export function renderDashboardRecentTransactions() {
  const container = document.getElementById('dashboard-recent-list');
  if (!container) return;

  container.innerHTML = '';
  const recent = state.transactions.slice(0, 2);

  recent.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item';
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Recent: ${item.merchant}, ₹${item.amount.toFixed(2)}`);

    const badgeClass = item.isDuress ? 'history-badge duress' : 'history-badge success';
    const badgeText = item.isDuress ? 'Duress Flagged' : 'Completed';

    card.innerHTML = `
      <div class="history-item-left">
        <div class="history-merchant">${escapeHTML(item.merchant)}</div>
        <div class="history-date">${escapeHTML(item.date)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-amount">₹${item.amount.toFixed(2)}</div>
        <span class="${badgeClass}">${badgeText}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      provideFeedback({
        text: `${item.merchant}, ${formatCurrencySpoken(item.amount)}, status ${badgeText}`,
        priority: true
      });
    });

    container.appendChild(card);
  });
}

// Utilities
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const norm = (g) => (g === 'TAP' || g === 'SINGLE_TAP' ? 'TAP' : g);
  for (let i = 0; i < a.length; i++) {
    if (norm(a[i]) !== norm(b[i])) return false;
  }
  return true;
}

export function formatCurrencySpoken(amount) {
  const parts = amount.toFixed(2).split('.');
  const whole = parseInt(parts[0], 10);
  const frac = parseInt(parts[1], 10);

  // Formats as Rupees and Paise
  if (frac === 0) {
    return `${whole} Rupees`;
  }
  return `${whole} Rupees and ${frac} Paise`;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

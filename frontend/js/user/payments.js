/**
 * PALMLOCK — Touch Beyond Vision
 * Payment Verification, Duress Detection & Transaction Ledger Engine
 */

import { state } from './state.js';
import { provideFeedback, playGestureAudio, announceAssertive } from './accessibility.js';
import { navigateTo, openModal } from './navigation.js';
import { clearPinGestures } from './gestures.js';

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
    amountEl.textContent = `$${tx.amount.toFixed(2)}`;
    amountEl.setAttribute('aria-label', `Amount to pay: ${formatCurrencySpoken(tx.amount)}`);
  }
  if (hashEl) hashEl.textContent = tx.qrHash;
}

/**
 * Audio Readout of Payment Details
 */
export function readPaymentDetails() {
  const tx = state.currentTransaction;
  const spokenText = `Payment verification. Merchant: ${tx.merchantName}. Verified certified business. Amount: ${formatCurrencySpoken(tx.amount)}. Zero dollar processing fee. Press Proceed to Gesture PIN to authorize.`;

  provideFeedback({
    text: spokenText,
    priority: true,
    hapticPattern: [50, 50],
    hapticLabel: 'Readout payment summary'
  });
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

  // Deduct balance
  state.user.balance = Math.max(0, state.user.balance - tx.amount);
  const balanceEl = document.getElementById('dashboard-balance');
  if (balanceEl) {
    balanceEl.textContent = `$${state.user.balance.toFixed(2)}`;
  }

  // Prepend to transaction ledger
  const newTx = {
    id: `tx_${Date.now()}`,
    merchant: tx.merchantName,
    category: tx.category,
    amount: tx.amount,
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
  if (resAmount) resAmount.textContent = `$${tx.amount.toFixed(2)}`;
  if (resMerchant) resMerchant.textContent = `Paid to ${tx.merchantName}`;
  if (resRef) resRef.textContent = tx.referenceId;
  if (resTime) resTime.textContent = 'Today, Just now';

  document.getElementById('result-success-container').style.display = 'block';
  document.getElementById('result-failure-container').style.display = 'none';

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
function handleDuressPinTrigger() {
  const tx = state.currentTransaction;

  // Log Duress event in transaction history
  const duressTx = {
    id: `tx_dur_${Date.now()}`,
    merchant: tx.merchantName,
    category: 'Security Duress Flagged',
    amount: tx.amount,
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

  document.getElementById('result-success-container').style.display = 'none';
  document.getElementById('result-failure-container').style.display = 'block';

  navigateTo('screen-payment-result');

  // Covert Haptic: Long pulse followed by 3 micro pulses (silent duress confirmation)
  provideFeedback({
    text: 'Transaction interrupted. Bank network timeout.',
    gesture: 'ERROR',
    hapticPattern: [300, 100, 50, 50, 50],
    hapticLabel: 'Silent Duress Dispatched',
    priority: true
  });

  // Open emergency notification confirmation modal in demonstrator
  setTimeout(() => {
    openModal('modal-sos-alert');
  }, 1000);

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

  document.getElementById('result-success-container').style.display = 'none';
  document.getElementById('result-failure-container').style.display = 'block';

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
    card.setAttribute('aria-label', `${item.merchant}, $${item.amount.toFixed(2)}, ${item.date}, ${item.isDuress ? 'Duress Flagged' : 'Completed'}`);

    const badgeClass = item.isDuress ? 'history-badge duress' : 'history-badge success';
    const badgeText = item.isDuress ? 'Duress Protected' : 'Completed';

    card.innerHTML = `
      <div class="history-item-left">
        <div class="history-merchant">${escapeHTML(item.merchant)}</div>
        <div class="history-date">${escapeHTML(item.date)} • Ref: ${escapeHTML(item.reference)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-amount">$${item.amount.toFixed(2)}</div>
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
    card.setAttribute('aria-label', `Recent: ${item.merchant}, $${item.amount.toFixed(2)}`);

    const badgeClass = item.isDuress ? 'history-badge duress' : 'history-badge success';
    const badgeText = item.isDuress ? 'Duress Flagged' : 'Completed';

    card.innerHTML = `
      <div class="history-item-left">
        <div class="history-merchant">${escapeHTML(item.merchant)}</div>
        <div class="history-date">${escapeHTML(item.date)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-amount">$${item.amount.toFixed(2)}</div>
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
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function formatCurrencySpoken(amount) {
  const parts = amount.toFixed(2).split('.');
  const dollars = parseInt(parts[0], 10);
  const cents = parseInt(parts[1], 10);

  if (cents === 0) {
    return `${dollars} dollars`;
  }
  return `${dollars} dollars and ${cents} cents`;
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

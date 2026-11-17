
/**
 * PALMLOCK — Secure Simulated Payments
 *
 * Backend-authorized payment simulation,
 * tactile currency, duress handling and history.
 *
 * No real UPI or bank transfer occurs.
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';
import { navigateTo } from './navigation.js';
import {
  clearPinGestures,
  GESTURE_TO_DIGIT
} from './gestures.js';
import {
  apiVerifyPin,
  apiRecordTransaction,
  apiReportEmergency
} from './api.js';
import {
  captureEmergencyLocation
} from './location.js';

const MAX_PAYMENT = 100000;

let activeVibrationTimeout = null;
let isVibratingPattern = false;
let verificationInProgress = false;
let paymentGeneration = 0;

function el(id) {
  return document.getElementById(id);
}

function validAmount(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_PAYMENT &&
    Math.abs(
      value * 100 - Math.round(value * 100)
    ) < 1e-6
  );
}

function getTransaction() {
  return state.currentTransaction || {};
}

function getPaymentRequestId(tx) {
  return tx.paymentRequestId ||
    tx.requestId ||
    null;
}

function paymentDetails(tx) {
  return {
    merchantName:
      String(tx.merchantName || '').trim(),
    amount: Number(tx.amount),
    paymentRequestId:
      getPaymentRequestId(tx)
  };
}

function isSamePayment(a, b) {
  return (
    a.merchantName === b.merchantName &&
    a.amount === b.amount &&
    a.paymentRequestId === b.paymentRequestId
  );
}

function normalizeGesture(gesture) {
  return gesture === 'TAP'
    ? 'SINGLE_TAP'
    : gesture;
}

function sequenceToPin(sequence) {
  if (
    !Array.isArray(sequence) ||
    sequence.length !== 4
  ) {
    return null;
  }

  const digits = sequence.map(gesture =>
    GESTURE_TO_DIGIT[
      normalizeGesture(gesture)
    ]
  );

  if (
    digits.some(digit =>
      digit === undefined
    )
  ) {
    return null;
  }

  return digits.join('');
}

function arraysEqual(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length
  ) {
    return false;
  }

  return a.every(
    (value, index) =>
      normalizeGesture(value) ===
      normalizeGesture(b[index])
  );
}

function safeText(value) {
  return String(value ?? '');
}

function escapeHTML(value) {
  return safeText(value).replace(
    /[&<>'"]/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char])
  );
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toFixed(2)
    : '0.00';
}

function displayDate(timestamp) {
  if (!timestamp) {
    return 'Date unavailable';
  }

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-IN');
}

function setResultContainers(success) {
  const successContainer =
    el('result-success-container');

  const failureContainer =
    el('result-failure-container');

  if (successContainer) {
    successContainer.style.display =
      success ? 'block' : 'none';
  }

  if (failureContainer) {
    failureContainer.style.display =
      success ? 'none' : 'block';
  }
}

function setFailureDetails(title, reason) {
  const titleEl = el('failure-title');
  const reasonEl = el('failure-reason');

  if (titleEl) {
    titleEl.textContent = title;
  }

  if (reasonEl) {
    reasonEl.textContent = reason;
  }
}

/* ============================================================
   PAYMENT CONTEXT
============================================================ */

export function setPendingTransaction(txData) {
  if (
    !txData ||
    typeof txData !== 'object'
  ) {
    return false;
  }

  const amount = Number(txData.amount);
  const fee = Number(txData.fee ?? 0);

  const merchantName =
    String(txData.merchantName || '').trim();

  const total =
    Math.round((amount + fee) * 100) / 100;

  if (
    !merchantName ||
    !validAmount(amount) ||
    !Number.isFinite(fee) ||
    fee < 0 ||
    Math.abs(
      fee * 100 - Math.round(fee * 100)
    ) > 1e-6 ||
    !validAmount(total)
  ) {
    provideFeedback({
      text: 'Invalid payment request.',
      gesture: 'ERROR',
      priority: true
    });

    return false;
  }

  paymentGeneration++;

  // Replace, never merge with a previous payment.
  state.currentTransaction = {
    merchantName,
    amount,
    fee,
    total,
    category: txData.category || 'General',
    currency: 'INR',
    currencySymbol: '₹',
    qrHash: txData.qrHash || '',
    referenceId: txData.referenceId || '',
    paymentRequestId:
      txData.paymentRequestId ||
      txData.requestId ||
      null,
    merchantId: txData.merchantId || null,
    paymentAddress:
      txData.paymentAddress || null,
    qrSource: txData.qrSource || 'demo',
    isVerified: txData.isVerified === true,
    simulationOnly: true,
    timestamp:
      txData.timestamp ||
      new Date().toISOString()
  };

  updateVerificationScreen();
  return true;
}

/* ============================================================
   PAYMENT VERIFICATION SCREEN
============================================================ */

export function updateVerificationScreen() {
  const tx = getTransaction();

  const nameEl =
    el('verify-merchant-name');

  const amountEl =
    el('verify-amount-display');

  const hashEl =
    el('verify-qr-hash');

  if (nameEl) {
    nameEl.textContent =
      tx.merchantName || 'Unknown Merchant';
  }

  if (amountEl) {
    amountEl.textContent =
      `₹${formatAmount(tx.amount)}`;

    amountEl.setAttribute(
      'aria-label',
      `Payment amount: ${
        formatCurrencySpoken(
          Number(tx.amount || 0)
        )
      }`
    );
  }

  if (hashEl) {
    hashEl.textContent =
      tx.qrHash || 'Not available';
  }
}

export function readPaymentDetails() {
  const tx = getTransaction();

  if (
    !tx.merchantName ||
    !validAmount(Number(tx.amount))
  ) {
    provideFeedback({
      text:
        'No valid payment request is selected.',
      gesture: 'ERROR',
      priority: true
    });
    return;
  }

  const fee = Number(tx.fee || 0);

  const total = Number(
    tx.total ?? tx.amount
  );

  provideFeedback({
    text:
      `Simulated payment verification. ` +
      `Merchant: ${tx.merchantName}. ` +
      `Amount: ${
        formatCurrencySpoken(
          Number(tx.amount)
        )
      }. ` +
      (
        fee > 0
          ? `Additional fee: ${
              formatCurrencySpoken(fee)
            }. `
          : ''
      ) +
      `Total: ${
        formatCurrencySpoken(total)
      }. ` +
      'Scanning a QR code does not verify merchant identity. ' +
      'Review the details before proceeding to Gesture PIN. ' +
      'No real money will be transferred.',
    priority: true,
    hapticPattern: [50, 50],
    hapticLabel: 'Payment summary'
  });
}

/* ============================================================
   TACTILE CURRENCY
============================================================ */

/**
 * Encodes the full integer rupee amount,
 * including thousands and higher denominations.
 *
 * The spoken readout includes paise.
 *
 * Each denomination uses a different pulse length.
 * A zero digit is represented by two short pulses.
 */
export function generateTactileCurrencyPattern(amount) {
  const numeric = Number(amount);

  if (
    !Number.isFinite(numeric) ||
    numeric < 0 ||
    numeric > MAX_PAYMENT
  ) {
    return {
      pattern: [],
      spokenBreakdown: 'Invalid amount.',
      total: 0,
      hundreds: 0,
      tens: 0,
      ones: 0
    };
  }

  const whole = Math.floor(numeric);
  const digits = String(whole).split('');

  const denominations = [
    500, 400, 300, 250, 180, 120
  ];

  const pattern = [];

  digits.forEach((digitText, index) => {
    const digit = Number(digitText);

    const position =
      digits.length - index - 1;

    const pulse =
      denominations[
        Math.min(
          position,
          denominations.length - 1
        )
      ];

    if (digit === 0) {
      pattern.push(40, 60, 40);
    } else {
      for (let i = 0; i < digit; i++) {
        pattern.push(pulse);

        if (i < digit - 1) {
          pattern.push(100);
        }
      }
    }

    if (index < digits.length - 1) {
      pattern.push(650);
    }
  });

  return {
    hundreds: Math.floor(
      (whole % 1000) / 100
    ),
    tens: Math.floor(
      (whole % 100) / 10
    ),
    ones: whole % 10,
    pattern,
    spokenBreakdown:
      formatCurrencySpoken(numeric),
    total: whole
  };
}

export function playTactileCurrencyPattern(
  amount = null
) {
  stopTactileCurrencyPattern();

  const selectedAmount =
    amount === null
      ? Number(getTransaction().amount)
      : Number(amount);

  if (
    !Number.isFinite(selectedAmount) ||
    selectedAmount < 0 ||
    selectedAmount > MAX_PAYMENT
  ) {
    provideFeedback({
      text: 'Invalid amount for tactile feedback.',
      gesture: 'ERROR'
    });
    return;
  }

  const result =
    generateTactileCurrencyPattern(
      selectedAmount
    );

  isVibratingPattern = true;

  provideFeedback({
    text:
      `Tactile amount: ${
        result.spokenBreakdown
      }. ` +
      'Each digit is represented by pulses. ' +
      'Higher denominations use longer pulses.',
    priority: true
  });

  if (
    typeof navigator.vibrate === 'function' &&
    state.preferences?.hapticEnabled
  ) {
    try {
      navigator.vibrate(result.pattern);
    } catch (error) {
      console.warn(
        '[PALMLOCK HAPTICS]',
        error
      );
    }
  }

  const indicator =
    el('haptic-visual-indicator');

  if (indicator) {
    indicator.textContent =
      `Tactile Amount: ₹${
        formatAmount(selectedAmount)
      }`;

    indicator.classList.add('visible');
  }

  const duration =
    result.pattern.reduce(
      (sum, value) => sum + value,
      0
    );

  activeVibrationTimeout =
    setTimeout(() => {
      isVibratingPattern = false;
      activeVibrationTimeout = null;

      indicator?.classList.remove(
        'visible'
      );
    }, duration + 200);
}

export function stopTactileCurrencyPattern() {
  if (activeVibrationTimeout !== null) {
    clearTimeout(activeVibrationTimeout);
    activeVibrationTimeout = null;
  }

  isVibratingPattern = false;

  if (
    typeof navigator.vibrate === 'function'
  ) {
    try {
      navigator.vibrate(0);
    } catch (_) {}
  }

  el('haptic-visual-indicator')
    ?.classList.remove('visible');
}

export function repeatTactileCurrencyPattern() {
  playTactileCurrencyPattern(
    Number(getTransaction().amount)
  );
}

/* ============================================================
   EMERGENCY LOCATION
============================================================ */

async function getEmergencyLocation() {
  try {
    const captured =
      await captureEmergencyLocation();

    if (!captured) return null;

    const lat = Number(
      captured.lat ??
      captured.coords?.latitude
    );

    const lng = Number(
      captured.lng ??
      captured.coords?.longitude
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
      accuracyMeters:
        captured.accuracyMeters ??
        captured.coords?.accuracy ??
        null
    };
  } catch (_) {
    return null;
  }
}

/* ============================================================
   GESTURE PIN VERIFICATION
============================================================ */

export async function verifyEnteredPin(
  enteredSequence
) {
  if (verificationInProgress) return;

  verificationInProgress = true;

  const generation = paymentGeneration;

  try {
    const sequence =
      Array.isArray(enteredSequence)
        ? [...enteredSequence]
        : [];

    const pin =
      sequenceToPin(sequence);

    clearPinGestures(true);

    if (!pin) {
      handlePaymentFailure(
        'Invalid gesture sequence.'
      );
      return;
    }

    const tx = {
      ...getTransaction()
    };

    const details =
      paymentDetails(tx);

    if (
      !details.merchantName ||
      !validAmount(details.amount)
    ) {
      handlePaymentFailure(
        'Invalid payment details.'
      );
      return;
    }

    const localDuressMatch =
      arraysEqual(
        sequence,
        state.pins?.duressPin
      );

    // Normal payments do not request GPS.
    const location =
      localDuressMatch
        ? await getEmergencyLocation()
        : null;

    if (generation !== paymentGeneration) {
      return;
    }

    const result =
      await apiVerifyPin({
        pin,
        ...details,
        location
      });

    if (
      generation !== paymentGeneration ||
      !isSamePayment(
        details,
        paymentDetails(
          getTransaction()
        )
      )
    ) {
      return;
    }

    const data =
      result?.data || {};

    // Backend-created duress incident.
    if (
      result?.status === 504 &&
      data.code === 'GATEWAY_TIMEOUT'
    ) {
      await handleDuressPinTrigger({
        backendIncidentCreated: true
      });
      return;
    }

    // Offline fallback for a locally known duress PIN.
    if (
      result?.status === 0 &&
      localDuressMatch
    ) {
      await handleDuressPinTrigger({
        backendIncidentCreated: false,
        location
      });
      return;
    }

    if (
      !result?.ok ||
      data.success !== true ||
      data.verified !== true ||
      data.isDuress !== false ||
      typeof data.authorizationToken !== 'string' ||
      !data.authorizationToken
    ) {
      handlePaymentFailure(
        result?.status === 0
          ? 'Payment service unavailable. No payment was confirmed.'
          : data.error ||
            'PIN verification failed.'
      );
      return;
    }

    const paymentResult =
      await apiRecordTransaction({
        ...details,
        authorizationToken:
          data.authorizationToken,
        category:
          tx.category || 'General'
      });

    if (
      paymentResult?.success !== true ||
      paymentResult?.offline === true ||
      paymentResult?.transaction?.status !== 'completed' ||
      paymentResult?.transaction?.isDuress !== false ||
      paymentResult?.simulationOnly !== true
    ) {
      handlePaymentFailure(
        paymentResult?.error ||
        'Payment confirmation unavailable. Check history before retrying.'
      );
      return;
    }

    if (
      generation !== paymentGeneration ||
      !isSamePayment(
        details,
        paymentDetails(
          getTransaction()
        )
      )
    ) {
      // Backend may have completed the earlier payment.
      // Do not display it as the current payment.
      provideFeedback({
        text:
          'Payment context changed. Check transaction history before retrying.',
        priority: true
      });
      return;
    }

    handlePaymentSuccess(
      paymentResult.transaction
    );
  } catch (error) {
    console.error(
      '[PALMLOCK PAYMENT]',
      error
    );

    handlePaymentFailure(
      'Unable to confirm payment. Check transaction history before retrying.'
    );
  } finally {
    verificationInProgress = false;
  }
}

/* ============================================================
   SUCCESS
============================================================ */

function handlePaymentSuccess(
  backendTransaction
) {
  const reference =
    backendTransaction.reference ||
    'UNKNOWN';

  const ledgerEntry = {
    id: String(
      backendTransaction._id ||
      reference
    ),
    merchant:
      backendTransaction.merchantName,
    category:
      backendTransaction.category ||
      'General',
    amount:
      Number(backendTransaction.amount),
    currency: 'INR',
    status: 'completed',
    isDuress: false,
    date:
      displayDate(
        backendTransaction.timestamp
      ),
    reference
  };

  if (!Array.isArray(state.transactions)) {
    state.transactions = [];
  }

  if (
    !state.transactions.some(
      item => item.reference === reference
    )
  ) {
    state.transactions.unshift(
      ledgerEntry
    );
  }

  if (el('result-title')) {
    el('result-title').textContent =
      'Simulated Payment Successful';
  }

  if (el('result-amount')) {
    el('result-amount').textContent =
      `₹${formatAmount(
        backendTransaction.amount
      )}`;
  }

  if (el('result-merchant-label')) {
    el('result-merchant-label').textContent =
      `Paid to ${
        backendTransaction.merchantName
      } (Simulation)`;
  }

  if (el('result-ref')) {
    el('result-ref').textContent =
      reference;
  }

  if (el('result-time')) {
    el('result-time').textContent =
      displayDate(
        backendTransaction.timestamp
      );
  }

  setResultContainers(true);

  navigateTo(
    'screen-payment-result'
  );

  provideFeedback({
    text:
      `Simulated payment of ${
        formatCurrencySpoken(
          Number(backendTransaction.amount)
        )
      } to ${
        backendTransaction.merchantName
      } successful. ` +
      'No real money was transferred.',
    gesture: 'SUCCESS',
    hapticPattern: [100, 50, 150],
    priority: true
  });

  renderHistoryList();
  renderDashboardRecentTransactions();
}

/* ============================================================
   DURESS PIN
============================================================ */

async function handleDuressPinTrigger({
  backendIncidentCreated = false,
  location = null
} = {}) {
  setFailureDetails(
    'Transaction Interrupted',
    'Network Gateway Timeout (Code 504). ' +
    'No payment was completed.'
  );

  setResultContainers(false);

  navigateTo(
    'screen-payment-result'
  );

  provideFeedback({
    text:
      'Transaction interrupted. Bank network timeout.',
    gesture: 'ERROR',
    hapticPattern: [300, 100, 50, 50, 50],
    priority: true
  });

  if (!backendIncidentCreated) {
    try {
      const emergencyLocation =
        location ||
        await getEmergencyLocation();

      const result =
        await apiReportEmergency({
          type: 'DURESS',
          userId: state.user?.id,
          userName: state.user?.name,
          userPhone: state.user?.phone,
          location: emergencyLocation,
          lat: emergencyLocation?.lat,
          lng: emergencyLocation?.lng,
          accuracyMeters:
            emergencyLocation?.accuracyMeters
        });

      // Do not claim delivery merely because
      // an emergency was queued or requested.
      console.info(
        '[PALMLOCK DURESS] Emergency submission result:',
        result
      );
    } catch (error) {
      console.error(
        '[PALMLOCK DURESS] Emergency submission failed:',
        error
      );
    }
  }

  renderHistoryList();
  renderDashboardRecentTransactions();
}

/* ============================================================
   PAYMENT FAILURE
============================================================ */

function handlePaymentFailure(reason) {
  const message =
    reason ||
    'Payment verification failed.';

  setFailureDetails(
    'Payment Not Authorized',
    message
  );

  setResultContainers(false);

  navigateTo(
    'screen-payment-result'
  );

  provideFeedback({
    text:
      `Payment not authorized. ${message}`,
    gesture: 'ERROR',
    hapticPattern: [150, 100, 150],
    priority: true
  });
}

/* ============================================================
   TRANSACTION HISTORY
============================================================ */

function getHistoryItems(filter = 'all') {
  const transactions =
    Array.isArray(state.transactions)
      ? state.transactions
      : [];

  return transactions.filter(item => {
    if (filter === 'completed') {
      return item.status === 'completed';
    }

    if (filter === 'duress') {
      return item.isDuress === true;
    }

    return true;
  });
}

function createHistoryCard(item) {
  const card =
    document.createElement('article');

  card.className = 'history-item';
  card.tabIndex = 0;
  card.setAttribute('role', 'listitem');

  const amount =
    Number(item.amount || 0);

  const isDuress =
    item.isDuress === true;

  const completed =
    item.status === 'completed' &&
    !isDuress;

  const badgeText =
    isDuress
      ? 'Protected'
      : completed
        ? 'Completed'
        : 'Pending';

  const badgeClass =
    isDuress
      ? 'duress'
      : completed
        ? 'success'
        : 'pending';

  const merchant =
    safeText(
      item.merchant ||
      item.merchantName ||
      'Unknown Merchant'
    );

  const date =
    safeText(item.date || '');

  const reference =
    safeText(item.reference || '');

  card.setAttribute(
    'aria-label',
    `${merchant}, ${
      formatCurrencySpoken(amount)
    }, ${badgeText}`
  );

  card.innerHTML = `
    <div class="history-item-left">
      <div class="history-merchant">
        ${escapeHTML(merchant)}
      </div>
      <div class="history-date">
        ${escapeHTML(date)}
        ${reference
          ? ` • Ref: ${escapeHTML(reference)}`
          : ''}
      </div>
    </div>

    <div class="history-item-right">
      <div class="history-amount">
        ₹${formatAmount(amount)}
      </div>
      <span class="history-badge ${badgeClass}">
        ${badgeText}
      </span>
    </div>
  `;

  const announce = () => {
    provideFeedback({
      text:
        `Transaction with ${merchant}. ` +
        `Amount ${
          formatCurrencySpoken(amount)
        }. Status ${badgeText}. ` +
        `Recorded ${date}.`,
      priority: true
    });
  };

  card.addEventListener(
    'click',
    announce
  );

  card.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        announce();
      }
    }
  );

  return card;
}

export function renderHistoryList(
  filter = 'all'
) {
  const container =
    el('history-full-list');

  if (!container) return;

  container.replaceChildren();

  const items =
    getHistoryItems(filter);

  if (!items.length) {
    const empty =
      document.createElement('div');

    empty.className = 'card';
    empty.textContent =
      'No transactions found matching this filter.';

    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    container.appendChild(
      createHistoryCard(item)
    );
  });
}

export function renderDashboardRecentTransactions() {
  const container =
    el('dashboard-recent-list');

  if (!container) return;

  container.replaceChildren();

  const recent =
    getHistoryItems().slice(0, 2);

  if (!recent.length) {
    const empty =
      document.createElement('p');

    empty.className = 'text-subtitle';
    empty.textContent =
      'No recent simulated transactions.';

    container.appendChild(empty);
    return;
  }

  recent.forEach(item => {
    container.appendChild(
      createHistoryCard(item)
    );
  });
}

/* ============================================================
   ACCESSIBLE CURRENCY SPEECH
============================================================ */

export function formatCurrencySpoken(amount) {
  const numeric = Number(amount);

  if (
    !Number.isFinite(numeric) ||
    numeric < 0
  ) {
    return 'Invalid amount';
  }

  const [rupees, paise] =
    numeric.toFixed(2).split('.');

  const whole = Number(rupees);
  const fraction = Number(paise);

  if (fraction === 0) {
    return `${whole} Rupees`;
  }

  return (
    `${whole} Rupees and ` +
    `${fraction} Paise`
  );
}

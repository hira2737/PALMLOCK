
/**
 * PALMLOCK — Unified Frontend API
 *
 * All payments are simulated.
 * Backend confirmation is mandatory.
 */

import { state } from './state.js';
import { enqueueEmergencyEvent } from './offline-queue.js';
import { INDIAN_MERCHANTS } from '../shared/demoData.js';

const REQUEST_TIMEOUT_MS = 12000;

const BACKEND_BASE_URL = (() => {
  if (typeof window === 'undefined') return '/api';

  const configured = window.PALMLOCK_API_BASE_URL;

  if (typeof configured === 'string' && configured.trim()) {
    return configured.replace(/\/+$/, '');
  }

  const { protocol, hostname, port } = window.location;

  if (port === '5000') return '/api';

  if (protocol === 'http:' || protocol === 'https:') {
    return `${protocol}//${hostname}:5000/api`;
  }

  return 'http://localhost:5000/api';
})();

function getAuthToken() {
  const candidates = [
    state.auth?.token,
    state.authToken,
    state.user?.token,
    state.user?.accessToken
  ];

  try {
    candidates.push(
      sessionStorage.getItem('palmlock_token'),
      localStorage.getItem('palmlock_token'),
      localStorage.getItem('authToken')
    );
  } catch (_) {}

  return candidates.find(
    token =>
      typeof token === 'string' &&
      token.trim().length > 0
  ) || null;
}

function createHeaders(authenticated = true) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (authenticated) {
    const token = getAuthToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

async function request(endpoint, {
  method = 'GET',
  body,
  authenticated = true,
  timeout = REQUEST_TIMEOUT_MS
} = {}) {
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    const response = await fetch(
      `${BACKEND_BASE_URL}${endpoint}`,
      {
        method,
        headers: createHeaders(authenticated),
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
        signal: controller.signal,
        cache: 'no-store'
      }
    );

    const raw = await response.text();

    let data = {};

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = {
          success: false,
          error: 'Backend returned invalid JSON.'
        };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    const timedOut = error.name === 'AbortError';

    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        error: timedOut
          ? 'Backend request timed out.'
          : 'Backend unreachable.',
        code: timedOut
          ? 'REQUEST_TIMEOUT'
          : 'NETWORK_ERROR'
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function broadcastLocal(type, payload) {
  if (typeof BroadcastChannel === 'undefined') return;

  try {
    const channel = new BroadcastChannel(
      'palmlock_soc_channel'
    );

    channel.postMessage({
      type,
      ...payload
    });

    channel.close();
  } catch (error) {
    console.warn('[PALMLOCK BROADCAST]', error);
  }
}

/* ============================================================
   MERCHANT VERIFICATION
============================================================ */

export async function apiVerifyMerchant(qrHash, merchantName) {
  const response = await request('/merchants/verify', {
    method: 'POST',
    authenticated: false,
    body: {
      qrHash,
      merchantName
    }
  });

  if (
    response.ok &&
    response.data?.success === true &&
    response.data?.merchant
  ) {
    return {
      verified: response.data.verified === true,
      merchant: response.data.merchant,
      mode: 'backend'
    };
  }

  const query = String(merchantName || '')
    .trim()
    .toLowerCase();

  const found = Array.isArray(INDIAN_MERCHANTS)
    ? INDIAN_MERCHANTS.find(
        merchant =>
          String(merchant.name || '')
            .trim()
            .toLowerCase() === query
      )
    : null;

  return {
    verified: false,
    merchant: found || {
      merchantId: 'MERCH_UNVERIFIED',
      id: 'MERCH_UNVERIFIED',
      name: merchantName || 'Unverified Merchant',
      category: 'Unverified Merchant',
      verified: false
    },
    mode: 'local_demo',
    error:
      response.data?.error ||
      'Merchant could not be verified by the backend.'
  };
}

/* ============================================================
   EMERGENCY REPORTING
============================================================ */

export async function apiReportEmergency(incidentData) {
  if (!incidentData || typeof incidentData !== 'object') {
    return {
      success: false,
      queued: false,
      delivered: false,
      error: 'Invalid emergency data.'
    };
  }

  let queuedRecord;

  try {
    queuedRecord = await enqueueEmergencyEvent(incidentData);

    if (!queuedRecord?.id) {
      throw new Error('Queue did not return an event ID.');
    }
  } catch (error) {
    console.error('[PALMLOCK EMERGENCY QUEUE]', error);

    return {
      success: false,
      queued: false,
      delivered: false,
      error: 'Emergency could not be saved locally.'
    };
  }

  const endpoint =
    incidentData.type === 'SOS'
      ? '/alerts/sos'
      : '/alerts/duress';

  const response = await request(endpoint, {
    method: 'POST',
    body: {
      ...incidentData,
      idempotencyKey: String(queuedRecord.id)
    }
  });

  if (
    response.ok &&
    response.data?.success === true
  ) {
    // A successful HTTP response means the backend
    // accepted the incident. It does not prove SMS
    // delivery or guardian acknowledgement.
    //
    // The offline queue must mark this event delivered
    // using its own persistence API. Do not delete it
    // here without inspecting offline-queue.js.
    return {
      success: true,
      queued: true,
      delivered: true,
      backendAccepted: true,
      guardianNotified: false,
      incident:
        response.data.alert || queuedRecord,
      queueId: queuedRecord.id,
      mode: 'backend_accepted'
    };
  }

  broadcastLocal('EMERGENCY_INCIDENT_CREATED', {
    incident: queuedRecord
  });

  return {
    success: true,
    queued: true,
    delivered: false,
    backendAccepted: false,
    guardianNotified: false,
    incident: queuedRecord,
    queueId: queuedRecord.id,
    mode: 'offline_queued',
    error:
      response.data?.error ||
      'Emergency has not been confirmed by the backend.'
  };
}

/* ============================================================
   FALSE ALARM REPORTING
============================================================ */

export async function apiReportFalseAlarm(
  incidentId,
  reason
) {
  if (!incidentId) {
    return {
      success: false,
      backendConfirmed: false,
      localRecorded: false,
      error: 'Incident ID required.'
    };
  }

  const record = {
    incidentId,
    user: state.user?.name || 'Unknown User',
    cancelledAt: new Date().toISOString(),
    reason:
      reason || 'User reported accidental trigger.',
    reviewStatus: 'PENDING_OFFICER_REVIEW',
    timestamp: Date.now()
  };

  const response = await request(
    '/alerts/false-alarm',
    {
      method: 'POST',
      body: {
        incidentId,
        reason: record.reason
      }
    }
  );

  let localRecorded = false;

  try {
    const stored = JSON.parse(
      localStorage.getItem(
        'palmlock_false_alarms'
      ) || '[]'
    );

    const existing = Array.isArray(stored)
      ? stored
      : [];

    existing.unshift(record);

    localStorage.setItem(
      'palmlock_false_alarms',
      JSON.stringify(existing)
    );

    localRecorded = true;
  } catch (error) {
    console.warn('[PALMLOCK FALSE ALARM]', error);
  }

  if (localRecorded) {
    broadcastLocal('FALSE_ALARM_REPORTED', {
      record
    });
  }

  const backendConfirmed =
    response.ok &&
    response.data?.success === true;

  return {
    success: backendConfirmed,
    record,
    backendConfirmed,
    localRecorded,
    error: backendConfirmed
      ? null
      : response.data?.error ||
        'Backend has not confirmed the false alarm.'
  };
}

/* ============================================================
   PIN VERIFICATION
============================================================ */

export async function apiVerifyPin({
  pin,
  paymentRequestId = null,
  amount,
  merchantName,
  location = null
} = {}) {
  if (
    typeof pin !== 'string' ||
    !/^\d{4}$/.test(pin)
  ) {
    return {
      ok: false,
      status: 400,
      data: {
        success: false,
        error: 'A four-digit gesture PIN is required.'
      }
    };
  }

  const body = {
    pin,
    amount: Number(amount),
    merchantName: String(merchantName || '').trim(),
    location
  };

  // Only include IDs actually created by the backend.
  // Local demo IDs must not be submitted as database IDs.
  if (
    typeof paymentRequestId === 'string' &&
    paymentRequestId.trim() &&
    !paymentRequestId.startsWith('REQ-')
  ) {
    body.paymentRequestId = paymentRequestId.trim();
  }

  return request('/pin/verify', {
    method: 'POST',
    authenticated: true,
    body
  });
}

/* ============================================================
   PIN SETUP
============================================================ */

export async function apiSetupPin({
  standardPin,
  duressPin,
  currentPassword
} = {}) {
  const body = {};

  if (standardPin !== undefined) {
    body.standardPin = standardPin;
  }

  if (duressPin !== undefined) {
    body.duressPin = duressPin;
  }

  if (currentPassword !== undefined) {
    body.currentPassword = currentPassword;
  }

  return request('/pin/setup', {
    method: 'POST',
    authenticated: true,
    body
  });
}

/* ============================================================
   SIMULATED TRANSACTIONS
============================================================ */

export async function apiRecordTransaction(txData) {
  if (
    !txData ||
    typeof txData.authorizationToken !== 'string' ||
    !txData.authorizationToken
  ) {
    return {
      success: false,
      offline: false,
      status: 400,
      error: 'Missing payment authorization token.',
      transaction: null
    };
  }

  const body = {
    ...txData
  };

  // Locally generated demo IDs are not backed by
  // PaymentRequest documents.
  if (
    typeof body.paymentRequestId === 'string' &&
    body.paymentRequestId.startsWith('REQ-')
  ) {
    body.paymentRequestId = null;
  }

  const response = await request(
    '/transactions/simulate',
    {
      method: 'POST',
      authenticated: true,
      body
    }
  );

  const data = response.data || {};

  if (
    response.ok &&
    data.success === true &&
    data.transaction?.status === 'completed' &&
    data.transaction?.isDuress === false &&
    data.simulationOnly === true
  ) {
    return {
      ...data,
      offline: false
    };
  }

  return {
    success: false,
    offline: response.status === 0,
    status: response.status,
    error:
      data.error ||
      'Simulated payment was not confirmed.',
    transaction: null
  };
}

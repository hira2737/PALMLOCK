
/**
 * PALMLOCK — Unified Frontend API
 *
 * Simulated payments only.
 * Emergency incidents must be confirmed by the backend
 * before being marked as backend accepted.
 *
 * Backend acceptance does not prove SMS delivery
 * or guardian acknowledgement.
 */

import { state } from './state.js';

import {
  enqueueEmergencyEvent,
  markEmergencyDelivered
} from './offline-queue.js';

import {
  INDIAN_MERCHANTS
} from '../shared/demoData.js';

const REQUEST_TIMEOUT_MS = 12000;

const BACKEND_BASE_URL = (() => {
  if (typeof window === 'undefined') {
    return '/api';
  }

  const configured =
    window.PALMLOCK_API_BASE_URL;

  if (
    typeof configured === 'string' &&
    configured.trim()
  ) {
    return configured.replace(/\/+$/, '');
  }

  const {
    protocol,
    hostname,
    port
  } = window.location;

  if (port === '5000') {
    return '/api';
  }

  if (
    protocol === 'http:' ||
    protocol === 'https:'
  ) {
    return (
      `${protocol}//${hostname}:5000/api`
    );
  }

  return 'http://localhost:5000/api';
})();

/* ============================================================
   AUTHENTICATION
============================================================ */

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
  } catch (_) {
    // Storage may be unavailable.
  }

  return candidates.find(
    token =>
      typeof token === 'string' &&
      token.trim().length > 0
  ) || null;
}

function createHeaders(
  authenticated = true,
  extraHeaders = {}
) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };

  if (authenticated) {
    const token = getAuthToken();

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }
  }

  return headers;
}

/* ============================================================
   SHARED HTTP REQUEST
============================================================ */

async function request(
  endpoint,
  {
    method = 'GET',
    body,
    authenticated = true,
    timeout = REQUEST_TIMEOUT_MS,
    headers = {}
  } = {}
) {
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
        headers: createHeaders(
          authenticated,
          headers
        ),
        ...(body !== undefined
          ? {
              body: JSON.stringify(body)
            }
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
          error:
            'Backend returned invalid JSON.'
        };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    const timedOut =
      error.name === 'AbortError';

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

/* ============================================================
   CROSS-TAB DEMO BROADCAST
============================================================ */

function broadcastLocal(type, payload) {
  if (
    typeof BroadcastChannel === 'undefined'
  ) {
    return;
  }

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
    console.warn(
      '[PALMLOCK BROADCAST]',
      error
    );
  }
}

/* ============================================================
   MERCHANT VERIFICATION
============================================================ */

export async function apiVerifyMerchant(
  qrHash,
  merchantName
) {
  const response = await request(
    '/merchants/verify',
    {
      method: 'POST',
      authenticated: false,
      body: {
        qrHash,
        merchantName
      }
    }
  );

  if (
    response.ok &&
    response.data?.success === true &&
    response.data?.merchant
  ) {
    return {
      verified:
        response.data.verified === true,
      merchant: response.data.merchant,
      mode: 'backend'
    };
  }

  const query = String(
    merchantName || ''
  ).trim().toLowerCase();

  const found =
    Array.isArray(INDIAN_MERCHANTS)
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
      name:
        merchantName ||
        'Unverified Merchant',
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
   EMERGENCY LOCATION NORMALIZATION
============================================================ */

function normalizeEmergencyLocation(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const source =
    data.location &&
    typeof data.location === 'object'
      ? data.location
      : data;

  if (
    source.simulated === true ||
    source.isDemo === true ||
    source.isSimulated === true ||
    source.source === 'demo' ||
    source.source === 'simulation'
  ) {
    return null;
  }

  const rawLat =
    source.lat ?? source.latitude;

  const rawLng =
    source.lng ?? source.longitude;

  if (
    rawLat == null ||
    rawLng == null
  ) {
    return null;
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const rawAccuracy =
    source.accuracyMeters ??
    source.accuracy;

  const accuracy = Number(rawAccuracy);

  return {
    lat,
    lng,
    accuracyMeters:
      rawAccuracy != null &&
      Number.isFinite(accuracy) &&
      accuracy >= 0
        ? accuracy
        : null,
    address:
      typeof source.address === 'string'
        ? source.address.slice(0, 300)
        : ''
  };
}

/* ============================================================
   EMERGENCY REPORTING
============================================================ */

export async function apiReportEmergency(
  incidentData
) {
  if (
    !incidentData ||
    typeof incidentData !== 'object'
  ) {
    return {
      success: false,
      queued: false,
      delivered: false,
      backendAccepted: false,
      guardianNotified: false,
      error: 'Invalid emergency data.'
    };
  }

  const type =
    incidentData.type === 'SOS'
      ? 'SOS'
      : 'DURESS';

  let queuedRecord;

  // STEP 1:
  // Persist locally before making a network request.
  try {
    queuedRecord =
      await enqueueEmergencyEvent({
        ...incidentData,
        type
      });

    if (!queuedRecord?.id) {
      throw new Error(
        'Emergency queue did not return an ID.'
      );
    }
  } catch (error) {
    console.error(
      '[PALMLOCK EMERGENCY QUEUE]',
      error
    );

    return {
      success: false,
      queued: false,
      delivered: false,
      backendAccepted: false,
      guardianNotified: false,
      error:
        'Emergency could not be saved locally.'
    };
  }

  const queueId = queuedRecord.id;

  // An already-confirmed event must not
  // be sent as a new emergency.
  if (
    queuedRecord.syncStatus ===
    'backend_accepted'
  ) {
    return {
      success: true,
      queued: true,
      delivered: true,
      backendAccepted: true,
      guardianNotified: false,
      queueId,
      incident: queuedRecord,
      mode: 'backend_accepted'
    };
  }

  // STEP 2:
  // Preserve the exact same idempotency key
  // for initial delivery and all future retries.
  const idempotencyKey =
    queuedRecord.idempotencyKey ||
    queueId;

  const location =
    normalizeEmergencyLocation({
      lat: queuedRecord.lat,
      lng: queuedRecord.lng,
      accuracyMeters:
        queuedRecord.accuracyMeters,
      address:
        queuedRecord.location ===
        'Location unavailable'
          ? ''
          : queuedRecord.location,
      source:
        queuedRecord.locationSource ===
        'device_location'
          ? 'device'
          : 'unavailable'
    });

  // STEP 3:
  // Attempt delivery only when a network
  // connection is reported available.
  if (!navigator.onLine) {
    return {
      success: true,
      queued: true,
      delivered: false,
      backendAccepted: false,
      guardianNotified: false,
      queueId,
      incident: queuedRecord,
      mode: 'offline_queued',
      error:
        'Device offline. Emergency stored locally.'
    };
  }

  const endpoint =
    type === 'SOS'
      ? '/alerts/sos'
      : '/alerts/duress';

  const response = await request(
    endpoint,
    {
      method: 'POST',
      authenticated: true,
      headers: {
        'X-Idempotency-Key':
          idempotencyKey
      },
      body: {
        type,
        idempotencyKey,
        location
      }
    }
  );

  // STEP 4:
  // The backend must explicitly confirm
  // successful incident creation or deduplication.
  const backendAlert =
    response.data?.alert;

  const backendConfirmed =
    response.ok &&
    response.data?.success === true &&
    backendAlert &&
    typeof (
      backendAlert.incidentId ||
      response.data.incidentId
    ) === 'string';

  if (backendConfirmed) {
    // STEP 5:
    // Persist confirmation to IndexedDB.
    // Never infer SMS delivery from this.
    try {
      const updatedRecord =
        await markEmergencyDelivered(
          queueId,
          {
            incidentId:
              backendAlert.incidentId ||
              response.data.incidentId,
            status:
              backendAlert.status ||
              'ACTIVE'
          }
        );

      return {
        success: true,
        queued: true,
        delivered: true,
        backendAccepted: true,
        guardianNotified: false,
        queueId,
        incident: {
          ...backendAlert,
          localQueueId: queueId,
          localSyncStatus:
            updatedRecord?.syncStatus ||
            'backend_accepted'
        },
        mode: 'backend_accepted',
        notificationMode:
          response.data.notificationMode ||
          'development_simulation',
        deduplicated:
          response.data.deduplicated === true
      };
    } catch (error) {
      // Backend may have accepted the incident,
      // but local persistence of the acknowledgement
      // failed. Keep the stable idempotency key so
      // a later retry does not create duplicates.
      console.error(
        '[PALMLOCK EMERGENCY CONFIRMATION]',
        error
      );

      return {
        success: true,
        queued: true,
        delivered: true,
        backendAccepted: true,
        guardianNotified: false,
        queueId,
        incident: backendAlert,
        mode: 'backend_accepted_local_update_failed',
        warning:
          'Backend accepted the emergency, but local queue confirmation failed.'
      };
    }
  }

  // STEP 6:
  // Do not mark the incident delivered
  // when the backend has not confirmed it.
  broadcastLocal(
    'EMERGENCY_INCIDENT_CREATED',
    {
      incident: queuedRecord,
      localOnly: true
    }
  );

  return {
    success: true,
    queued: true,
    delivered: false,
    backendAccepted: false,
    guardianNotified: false,
    queueId,
    incident: queuedRecord,
    mode: 'offline_queued',
    error:
      response.data?.error ||
      'Emergency remains queued because backend acceptance was not confirmed.'
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
    user:
      state.user?.name ||
      'Unknown User',
    cancelledAt:
      new Date().toISOString(),
    reason:
      reason ||
      'User reported accidental trigger.',
    reviewStatus:
      'PENDING_OFFICER_REVIEW',
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

    const existing =
      Array.isArray(stored)
        ? stored
        : [];

    existing.unshift(record);

    localStorage.setItem(
      'palmlock_false_alarms',
      JSON.stringify(existing)
    );

    localRecorded = true;
  } catch (error) {
    console.warn(
      '[PALMLOCK FALSE ALARM]',
      error
    );
  }

  if (localRecorded) {
    broadcastLocal(
      'FALSE_ALARM_REPORTED',
      { record }
    );
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
        error:
          'A four-digit gesture PIN is required.'
      }
    };
  }

  const body = {
    pin,
    amount: Number(amount),
    merchantName:
      String(merchantName || '').trim(),
    location
  };

  // Demo-generated request IDs do not
  // represent persisted PaymentRequest records.
  if (
    typeof paymentRequestId === 'string' &&
    paymentRequestId.trim() &&
    !paymentRequestId.startsWith('REQ-')
  ) {
    body.paymentRequestId =
      paymentRequestId.trim();
  }

  return request(
    '/pin/verify',
    {
      method: 'POST',
      authenticated: true,
      body
    }
  );
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
    body.currentPassword =
      currentPassword;
  }

  return request(
    '/pin/setup',
    {
      method: 'POST',
      authenticated: true,
      body
    }
  );
}

/* ============================================================
   SIMULATED TRANSACTIONS
============================================================ */

export async function apiRecordTransaction(
  txData
) {
  if (
    !txData ||
    typeof txData.authorizationToken !==
      'string' ||
    !txData.authorizationToken
  ) {
    return {
      success: false,
      offline: false,
      status: 400,
      error:
        'Missing payment authorization token.',
      transaction: null
    };
  }

  const body = {
    ...txData
  };

  // Demo request IDs are not persisted
  // PaymentRequest records.
  if (
    typeof body.paymentRequestId ===
      'string' &&
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

  const data =
    response.data || {};

  if (
    response.ok &&
    data.success === true &&
    data.transaction?.status ===
      'completed' &&
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
    offline:
      response.status === 0,
    status:
      response.status,
    error:
      data.error ||
      'Simulated payment was not confirmed.',
    transaction: null
  };
}

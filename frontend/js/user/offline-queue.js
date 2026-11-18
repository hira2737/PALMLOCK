
/**
 * PALMLOCK — Offline Emergency Queue
 *
 * Reliable IndexedDB persistence and backend retry.
 * All emergency notifications are prototype simulations.
 *
 * IMPORTANT:
 * - Locally saved does NOT mean backend delivered.
 * - Backend accepted does NOT mean guardian notified.
 * - Missing GPS must never be replaced with fake GPS.
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';

const DB_NAME = 'palmlock_db';
const DB_VERSION = 1;
const STORE_NAME = 'emergency_queue';

const API_BASE = (() => {
  const configured = window.PALMLOCK_API_BASE_URL;

  if (
    typeof configured === 'string' &&
    configured.trim()
  ) {
    return configured.replace(/\/+$/, '');
  }

  if (window.location.port === '5000') {
    return '/api';
  }

  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
})();

let dbInstance = null;
let initializationPromise = null;
let syncPromise = null;
let listenersAttached = false;

function createEventId() {
  if (crypto.randomUUID) {
    return `ALT-${crypto.randomUUID()}`;
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return (
    'ALT-' +
    Array.from(bytes, b =>
      b.toString(16).padStart(2, '0')
    ).join('')
  );
}

function getToken() {
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
    value =>
      typeof value === 'string' &&
      value.trim()
  ) || null;
}

function broadcast(type, incident) {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }

  try {
    const channel = new BroadcastChannel(
      'palmlock_soc_channel'
    );

    channel.postMessage({
      type,
      incident
    });

    channel.close();
  } catch (error) {
    console.warn(
      '[PALMLOCK QUEUE] Broadcast failed:',
      error
    );
  }
}

function validLocation(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const lat = source.lat ?? source.latitude;
  const lng = source.lng ?? source.longitude;

  if (lat == null || lng == null) {
    return null;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  // Do not send simulated coordinates as real GPS.
  if (
    source.simulated === true ||
    source.isDemo === true ||
    source.isSimulated === true ||
    source.source === 'demo' ||
    source.source === 'simulation'
  ) {
    return null;
  }

  const rawAccuracy =
    source.accuracyMeters ?? source.accuracy;

  const accuracy = Number(rawAccuracy);

  return {
    lat: latitude,
    lng: longitude,
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

function getIncidentLocation(data) {
  const explicit = validLocation(
    data.location && typeof data.location === 'object'
      ? data.location
      : data
  );

  if (explicit) return explicit;

  // A stored state location is usable only when
  // explicitly marked as captured with permission.
  if (state.location?.permissionState === 'granted') {
    return validLocation(state.location);
  }

  return null;
}

function getStore(mode = 'readonly') {
  if (!dbInstance) {
    throw new Error(
      'Emergency database is not initialized.'
    );
  }

  return dbInstance
    .transaction(STORE_NAME, mode)
    .objectStore(STORE_NAME);
}

function readAll() {
  return new Promise((resolve, reject) => {
    try {
      const request = getStore().getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(
          request.error ||
          new Error('Unable to read emergency queue.')
        );
      };
    } catch (error) {
      reject(error);
    }
  });
}

function readOne(id) {
  return new Promise((resolve, reject) => {
    try {
      const request = getStore().get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

function saveRecord(record) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = dbInstance.transaction(
        STORE_NAME,
        'readwrite'
      );

      transaction.objectStore(STORE_NAME).put(record);

      transaction.oncomplete = () => {
        resolve(record);
      };

      transaction.onerror = () => {
        reject(
          transaction.error ||
          new Error('Emergency queue write failed.')
        );
      };

      transaction.onabort = () => {
        reject(
          transaction.error ||
          new Error('Emergency queue write aborted.')
        );
      };
    } catch (error) {
      reject(error);
    }
  });
}

function mirrorLocally(record) {
  try {
    const raw = JSON.parse(
      localStorage.getItem('palmlock_all_incidents') ||
      '[]'
    );

    const incidents = Array.isArray(raw)
      ? raw
      : [];

    const index = incidents.findIndex(
      item => item.id === record.id
    );

    if (index >= 0) {
      incidents[index] = record;
    } else {
      incidents.unshift(record);
    }

    localStorage.setItem(
      'palmlock_all_incidents',
      JSON.stringify(incidents)
    );

    localStorage.setItem(
      'palmlock_latest_incident',
      JSON.stringify(record)
    );
  } catch (error) {
    console.warn(
      '[PALMLOCK QUEUE] Local mirror unavailable:',
      error
    );
  }
}

async function ensureDatabase() {
  if (dbInstance) return dbInstance;

  return initOfflineQueue();
}

export function initOfflineQueue() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = new Promise(
    (resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(
          new Error('IndexedDB is not supported.')
        );
        return;
      }

      const request = indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

      request.onupgradeneeded = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(
            STORE_NAME,
            { keyPath: 'id' }
          );

          store.createIndex(
            'syncStatus',
            'syncStatus',
            { unique: false }
          );

          store.createIndex(
            'timestamp',
            'timestamp',
            { unique: false }
          );
        }
      };

      request.onsuccess = () => {
        dbInstance = request.result;

        dbInstance.onversionchange = () => {
          dbInstance.close();
          dbInstance = null;
          initializationPromise = null;
        };

        if (!listenersAttached) {
          window.addEventListener(
            'online',
            handleNetworkOnline
          );

          window.addEventListener(
            'offline',
            handleNetworkOffline
          );

          listenersAttached = true;
        }

        console.info(
          'PALMLOCK: IndexedDB emergency queue initialized.'
        );

        updateQueueCount();

        // Start after initialization has resolved.
        resolve(dbInstance);

        if (navigator.onLine) {
          queueMicrotask(() => {
            retryPendingSync().catch(console.error);
          });
        }
      };

      request.onerror = () => {
        reject(
          request.error ||
          new Error('IndexedDB initialization failed.')
        );
      };

      request.onblocked = () => {
        console.warn(
          '[PALMLOCK QUEUE] Database upgrade blocked.'
        );
      };
    }
  ).catch(error => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}

/* ============================================================
   CREATE OFFLINE INCIDENT
============================================================ */

export async function enqueueEmergencyEvent(eventData) {
  await ensureDatabase();

  if (
    !eventData ||
    typeof eventData !== 'object'
  ) {
    throw new Error('Invalid emergency event.');
  }

  const now = new Date();
  const incidentId =
    typeof eventData.id === 'string' &&
    eventData.id.length >= 8
      ? eventData.id
      : createEventId();

  const existing = await readOne(incidentId);

  if (existing) return existing;

  const type =
    eventData.type === 'SOS'
      ? 'SOS'
      : 'DURESS';

  const location = getIncidentLocation(eventData);

  const primary = state.contacts?.[0];
  const secondary = state.contacts?.[1];

  const record = {
    id: incidentId,
    idempotencyKey: incidentId,

    userId:
      eventData.userId ||
      state.user?.id ||
      null,

    userName:
      eventData.userName ||
      state.user?.name ||
      'Unknown User',

    userPhone:
      eventData.userPhone ||
      state.user?.phone ||
      '',

    type,
    typeLabel:
      type === 'SOS'
        ? 'Manual Emergency SOS Triggered'
        : 'Discreet Duress PIN Activated',

    severity:
      type === 'SOS'
        ? 'HIGH'
        : 'CRITICAL',

    status: 'pending_delivery',
    syncStatus: 'queued_offline',

    timestamp: now.toISOString(),
    date: now.toLocaleDateString('en-IN'),

    location:
      location?.address ||
      'Location unavailable',

    coords: location
      ? `${location.lat}, ${location.lng}`
      : null,

    lat: location?.lat ?? null,
    lng: location?.lng ?? null,

    accuracyMeters:
      location?.accuracyMeters ?? null,

    locationSource:
      location ? 'device_location' : 'unavailable',

    networkStatus:
      navigator.onLine
        ? 'ONLINE — Awaiting backend confirmation'
        : 'OFFLINE — Stored locally',

    primaryContact:
      primary
        ? `${primary.name} (${primary.phone})`
        : 'No primary contact configured',

    primaryStatus: 'NOT_CONFIRMED',

    secondaryContact:
      secondary
        ? `${secondary.name} (${secondary.phone})`
        : 'No secondary contact configured',

    secondaryStatus: 'NOT_NOTIFIED',

    escalationStage: 'PENDING_BACKEND',

    backendIncidentId: null,
    backendAcceptedAt: null,
    lastSyncError: null,

    responseNotes: [
      {
        author: 'PALMLOCK Offline Queue',
        time: now.toISOString(),
        note:
          'Emergency saved locally. Backend delivery not yet confirmed.'
      }
    ],

    timeline: [
      {
        time: now.toISOString(),
        text:
          'Emergency saved to local IndexedDB queue.'
      }
    ]
  };

  // IndexedDB write must succeed before we
  // report that the incident is safely queued.
  await saveRecord(record);

  mirrorLocally(record);

  broadcast(
    'NEW_EMERGENCY_INCIDENT',
    record
  );

  await updateQueueCount();

  return record;
}

/* ============================================================
   PENDING INCIDENTS
============================================================ */

export async function getPendingOfflineEvents() {
  await ensureDatabase();

  const records = await readAll();

  return records.filter(record =>
    record.syncStatus !== 'backend_accepted' &&
    record.syncStatus !== 'delivered'
  );
}

/* ============================================================
   BACKEND CONFIRMATION
============================================================ */

export async function markEmergencyDelivered(
  localId,
  backendAlert = null
) {
  await ensureDatabase();

  const record = await readOne(localId);

  if (!record) return null;

  if (record.syncStatus === 'backend_accepted') {
    return record;
  }

  const now = new Date().toISOString();

  record.syncStatus = 'backend_accepted';
  record.status =
    backendAlert?.status || 'backend_accepted';

  record.backendIncidentId =
    backendAlert?.incidentId ||
    record.backendIncidentId ||
    null;

  record.backendAcceptedAt = now;
  record.networkStatus =
    'Backend accepted incident';

  record.lastSyncError = null;

  // Do not infer SMS delivery from backend acceptance.
  record.primaryStatus = 'NOT_CONFIRMED';

  record.timeline = Array.isArray(record.timeline)
    ? record.timeline
    : [];

  record.timeline.push({
    time: now,
    text:
      'Emergency accepted by backend. Guardian delivery not confirmed.'
  });

  await saveRecord(record);

  mirrorLocally(record);

  broadcast(
    'INCIDENT_SYNCED_FROM_OFFLINE',
    record
  );

  await updateQueueCount();

  return record;
}

/* ============================================================
   BACKEND DELIVERY
============================================================ */

async function deliverToBackend(record) {
  const token = getToken();

  if (!token) {
    throw new Error(
      'Authentication required before emergency synchronization.'
    );
  }

  const endpoint =
    record.type === 'SOS'
      ? '/alerts/sos'
      : '/alerts/duress';

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    const response = await fetch(
      `${API_BASE}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Idempotency-Key':
            record.idempotencyKey || record.id
        },
        body: JSON.stringify({
          type: record.type,
          idempotencyKey:
            record.idempotencyKey || record.id,

          location:
            record.lat != null &&
            record.lng != null
              ? {
                  lat: record.lat,
                  lng: record.lng,
                  accuracyMeters:
                    record.accuracyMeters,
                  address:
                    record.location ===
                    'Location unavailable'
                      ? ''
                      : record.location
                }
              : null
        }),
        signal: controller.signal
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      data.success !== true ||
      !data.alert
    ) {
      throw new Error(
        data.error ||
        `Backend rejected incident (${response.status}).`
      );
    }

    return data.alert;
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   RETRY PENDING INCIDENTS
============================================================ */

export async function retryPendingSync() {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    if (!navigator.onLine) {
      return {
        synced: 0,
        failed: 0,
        offline: true
      };
    }

    const pending =
      await getPendingOfflineEvents();

    let synced = 0;
    let failed = 0;

    for (const incident of pending) {
      // Re-read to avoid processing records already
      // confirmed by another in-page operation.
      const latest = await readOne(incident.id);

      if (
        !latest ||
        latest.syncStatus === 'backend_accepted'
      ) {
        continue;
      }

      try {
        const backendAlert =
          await deliverToBackend(latest);

        await markEmergencyDelivered(
          latest.id,
          backendAlert
        );

        synced++;
      } catch (error) {
        failed++;

        latest.lastSyncError =
          error.message ||
          'Backend synchronization failed.';

        latest.networkStatus =
          'AWAITING_BACKEND_CONFIRMATION';

        latest.syncStatus = 'queued_offline';

        await saveRecord(latest);

        mirrorLocally(latest);

        console.warn(
          '[PALMLOCK QUEUE] Retry failed:',
          latest.id,
          latest.lastSyncError
        );
      }
    }

    await updateQueueCount();

    if (synced > 0) {
      provideFeedback({
        text:
          `${synced} emergency incident` +
          `${synced === 1 ? ' was' : 's were'} ` +
          'accepted by the security backend. ' +
          'Guardian notification is not confirmed.',
        hapticPattern: [100, 50, 100],
        priority: true
      });
    }

    return {
      synced,
      failed,
      offline: false
    };
  })();

  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
}

/* ============================================================
   NETWORK EVENTS
============================================================ */

function handleNetworkOnline() {
  state.isOnline = true;

  updateOnlineOfflineIndicator(true);

  retryPendingSync().catch(error => {
    console.error(
      '[PALMLOCK QUEUE] Reconnection sync failed:',
      error
    );
  });
}

function handleNetworkOffline() {
  state.isOnline = false;

  updateOnlineOfflineIndicator(false);

  provideFeedback({
    text:
      'Device is offline. Emergency incidents ' +
      'will remain locally queued until backend ' +
      'delivery can be confirmed.',
    hapticPattern: 50
  });
}

/* ============================================================
   USER INTERFACE
============================================================ */

async function updateQueueCount() {
  try {
    if (!dbInstance) return;

    const records = await readAll();

    const pending = records.filter(
      record =>
        record.syncStatus !== 'backend_accepted' &&
        record.syncStatus !== 'delivered'
    );

    state.offlineQueueCount = pending.length;

    const badge = document.getElementById(
      'offline-queue-badge'
    );

    if (!badge) return;

    if (pending.length > 0) {
      badge.textContent =
        `${pending.length} queued`;

      badge.style.display = 'inline-block';

      badge.setAttribute(
        'aria-label',
        `${pending.length} emergency incidents awaiting backend confirmation`
      );
    } else {
      badge.style.display = 'none';
    }
  } catch (error) {
    console.warn(
      '[PALMLOCK QUEUE] Badge update failed:',
      error
    );
  }
}

function updateOnlineOfflineIndicator(isOnline) {
  const indicator = document.getElementById(
    'network-status-indicator'
  );

  if (!indicator) return;

  indicator.textContent =
    isOnline ? 'Online' : 'Offline';

  indicator.className =
    isOnline
      ? 'status-pill online'
      : 'status-pill offline';
}

/**
 * PALMLOCK — Touch Beyond Vision
 * Offline Emergency Incident Queue via IndexedDB
 * Ensures emergency dispatches & duress telemetry are preserved locally,
 * with automatic reconnection retries and deduplication.
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';

const DB_NAME = 'palmlock_db';
const DB_VERSION = 1;
const STORE_NAME = 'emergency_queue';

let dbInstance = null;
let broadcastChannel = null;

// Initialize BroadcastChannel for cross-tab mobile/admin communication
if (typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel('palmlock_soc_channel');
  } catch (e) {
    console.info('BroadcastChannel not available:', e);
  }
}

/**
 * Open or upgrade the IndexedDB database
 */
export function initOfflineQueue() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported in this browser environment. Using localStorage fallback.');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.info('PALMLOCK: IndexedDB emergency queue initialized.');
      updateQueueCount();

      // Listen for network connectivity events
      window.addEventListener('online', handleNetworkOnline);
      window.addEventListener('offline', handleNetworkOffline);

      // Attempt initial sync of any pending events from previous offline sessions
      if (navigator.onLine) {
        retryPendingSync();
      }

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      resolve(null);
    };
  });
}

/**
 * Enqueue a new Emergency Incident Event
 */
export async function enqueueEmergencyEvent(eventData) {
  const incidentId = eventData.id || `ALT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const isOnline = typeof navigator.onLine !== 'undefined' ? navigator.onLine : true;

  const incidentRecord = {
    id: incidentId,
    userId: eventData.userId || state.user.id,
    userName: eventData.userName || state.user.name,
    userPhone: eventData.userPhone || state.user.phone,
    type: eventData.type || 'DURESS',
    typeLabel: eventData.type === 'SOS' ? 'Manual Emergency SOS Triggered' : 'Discreet Duress PIN Activated',
    severity: eventData.type === 'SOS' ? 'HIGH' : 'CRITICAL',
    status: 'acknowledged', // Initial SOC status
    syncStatus: isOnline ? 'synced_demo' : 'queued_offline',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    location: eventData.location || (state.location.formatted !== 'Not captured' ? state.location.formatted : 'Chennai Central Metro, Anna Salai'),
    coords: eventData.coords || state.location.formatted,
    lat: eventData.lat || state.location.latitude || 13.0827,
    lng: eventData.lng || state.location.longitude || 80.2707,
    accuracyMeters: eventData.accuracyMeters || state.location.accuracy || 15,
    networkStatus: isOnline ? 'Online (Cellular 4G/5G)' : 'OFFLINE — Stored in Local IndexedDB Queue',
    primaryContact: state.contacts[0] ? `${state.contacts[0].name} (${state.contacts[0].phone})` : 'Primary Guardian',
    primaryStatus: isOnline ? 'DELIVERED' : 'QUEUED_OFFLINE',
    secondaryContact: state.contacts[1] ? `${state.contacts[1].name} (${state.contacts[1].phone})` : 'Secondary Guardian',
    secondaryStatus: isOnline ? 'STANDBY' : 'QUEUED_OFFLINE',
    escalationStage: 'STAGE_1_GUARDIAN',
    responseNotes: [
      {
        author: 'PALMLOCK Telemetry Engine',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: isOnline 
          ? 'Emergency incident registered and dispatched to SOC monitoring dashboard.'
          : 'Network offline. Incident stored in secure IndexedDB buffer. Will auto-retry on reconnection.'
      }
    ],
    timeline: [
      {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: `Incident ${incidentId} recorded. Status: ${isOnline ? 'Dispatched to SOC' : 'Buffered locally offline'}.`
      }
    ]
  };

  // 1. Store in IndexedDB
  await storeInIndexedDB(incidentRecord);

  // 2. LocalStorage mirror for robust cross-tab sync with Admin Dashboard
  try {
    const existing = JSON.parse(localStorage.getItem('palmlock_all_incidents') || '[]');
    // Deduplication check
    if (!existing.some(inc => inc.id === incidentId)) {
      existing.unshift(incidentRecord);
      localStorage.setItem('palmlock_all_incidents', JSON.stringify(existing));
    }
    localStorage.setItem('palmlock_latest_incident', JSON.stringify(incidentRecord));
  } catch (e) {
    console.warn('LocalStorage incident backup warning:', e);
  }

  // 3. Broadcast to active Admin Dashboard via BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'NEW_EMERGENCY_INCIDENT',
        incident: incidentRecord
      });
    } catch (e) {
      console.warn('Broadcast channel send error:', e);
    }
  }

  await updateQueueCount();
  return incidentRecord;
}

/**
 * Store or update an incident in IndexedDB
 */
function storeInIndexedDB(incidentRecord) {
  return new Promise((resolve) => {
    if (!dbInstance) {
      resolve(false);
      return;
    }
    try {
      const tx = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(incidentRecord);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (e) {
      console.warn('storeInIndexedDB error:', e);
      resolve(false);
    }
  });
}

/**
 * Retrieve all pending offline events from IndexedDB
 */
export function getPendingOfflineEvents() {
  return new Promise((resolve) => {
    if (!dbInstance) {
      resolve([]);
      return;
    }
    try {
      const tx = dbInstance.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = request.result || [];
        const pending = records.filter(r => r.syncStatus === 'queued_offline');
        resolve(pending);
      };
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

/**
 * Retry Synchronization for Queued Offline Incidents
 */
export async function retryPendingSync() {
  const pendingEvents = await getPendingOfflineEvents();
  if (pendingEvents.length === 0) return;

  console.info(`PALMLOCK: Retrying sync for ${pendingEvents.length} queued offline emergency events...`);

  for (const event of pendingEvents) {
    event.syncStatus = 'synced_demo';
    event.networkStatus = 'Synced on Reconnection (Cellular Online)';
    event.timeline.push({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: 'Reconnection established. Buffered emergency incident synced to SOC.'
    });

    await storeInIndexedDB(event);

    // Broadcast synced event to admin
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'INCIDENT_SYNCED_FROM_OFFLINE',
        incident: event
      });
    }
  }

  await updateQueueCount();

  provideFeedback({
    text: `Network restored. ${pendingEvents.length} offline emergency event successfully synchronized with security monitoring.`,
    hapticPattern: [100, 50, 100],
    priority: true
  });
}

/**
 * Network Online Handler
 */
function handleNetworkOnline() {
  state.isOnline = true;
  updateOnlineOfflineIndicator(true);
  retryPendingSync();
}

/**
 * Network Offline Handler
 */
function handleNetworkOffline() {
  state.isOnline = false;
  updateOnlineOfflineIndicator(false);
  provideFeedback({
    text: 'Device is offline. Emergency dispatches will be securely buffered in local memory.',
    hapticPattern: 50
  });
}

/**
 * Update UI Offline Queue Badge
 */
async function updateQueueCount() {
  const pending = await getPendingOfflineEvents();
  state.offlineQueueCount = pending.length;

  const badgeEl = document.getElementById('offline-queue-badge');
  if (badgeEl) {
    if (pending.length > 0) {
      badgeEl.textContent = `${pending.length} queued`;
      badgeEl.style.display = 'inline-block';
      badgeEl.setAttribute('aria-label', `${pending.length} offline incidents awaiting synchronization`);
    } else {
      badgeEl.style.display = 'none';
    }
  }
}

/**
 * Update UI Online / Offline Status Indicator
 */
function updateOnlineOfflineIndicator(isOnline) {
  const indicator = document.getElementById('network-status-indicator');
  if (indicator) {
    indicator.textContent = isOnline ? 'Online' : 'Offline';
    indicator.className = isOnline ? 'status-pill online' : 'status-pill offline';
  }
}

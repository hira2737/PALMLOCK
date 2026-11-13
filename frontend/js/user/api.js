/**
 * PALMLOCK — Touch Beyond Vision
 * Unified Frontend API Service Adapter
 * Provides clean service contracts for future Node.js/Express backend,
 * with reactive local storage simulation for frontend-only demonstration.
 */

import { state } from './state.js';
import { enqueueEmergencyEvent } from './offline-queue.js';
import { DEMO_USER, INDIAN_MERCHANTS, DEMO_INCIDENTS } from '../shared/demoData.js';

const BACKEND_BASE_URL = ''; // Future: '/api/v1'

/**
 * Service Adapter: Verify Merchant from QR
 */
export async function apiVerifyMerchant(qrHash, merchantName) {
  // Check if real backend is available
  if (BACKEND_BASE_URL) {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/merchants/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrHash, merchantName })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend unavailable, falling back to local adapter');
    }
  }

  // Local Adapter: Match against certified Indian merchants
  const found = INDIAN_MERCHANTS.find(m => 
    m.name.toLowerCase().includes(merchantName.toLowerCase()) || 
    merchantName.toLowerCase().includes(m.name.toLowerCase())
  );

  return {
    verified: !!found,
    merchant: found || {
      id: 'MERCH_UNVERIFIED',
      name: merchantName,
      category: 'Unverified Merchant',
      verified: false
    }
  };
}

/**
 * Service Adapter: Submit Emergency Incident
 */
export async function apiReportEmergency(incidentData) {
  // Always enqueue locally via IndexedDB first for offline resilience
  const queuedRecord = await enqueueEmergencyEvent(incidentData);

  if (BACKEND_BASE_URL) {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/emergency/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queuedRecord)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.info('Backend offline. Event securely preserved in local queue.');
    }
  }

  return {
    success: true,
    incident: queuedRecord,
    mode: 'demonstration_local_sync'
  };
}

/**
 * Service Adapter: Report False Alarm / Cancellation
 */
export async function apiReportFalseAlarm(incidentId, reason) {
  const record = {
    incidentId: incidentId,
    user: state.user.name,
    cancelledAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reason: reason || 'User reported accidental trigger.',
    reviewStatus: 'PENDING_OFFICER_REVIEW',
    timestamp: Date.now()
  };

  try {
    const existing = JSON.parse(localStorage.getItem('palmlock_false_alarms') || '[]');
    existing.unshift(record);
    localStorage.setItem('palmlock_false_alarms', JSON.stringify(existing));

    // Broadcast to Admin
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('palmlock_soc_channel');
      bc.postMessage({
        type: 'FALSE_ALARM_REPORTED',
        record: record
      });
    }
  } catch (e) {
    console.warn('False alarm save warning:', e);
  }

  return { success: true, record };
}

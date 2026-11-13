/**
 * PALMLOCK — Security Operations Center (SOC)
 * Incident Details, Interactive Leaflet Map & Response Management Controller
 */

import { adminState } from './state.js';
import { announceAdminEvent } from './admin.js';
import { playAcknowledgeChime } from './audio.js';
import { renderOverview } from './overview.js';
import { renderAlertsTable } from './alerts.js';
import { parseCoordinateString } from './map.js';

let leafletMapInstance = null;
let incidentMarkerLayer = null;
let incidentCircleLayer = null;

export function initIncidentDetailsSection() {
  // Response Action Buttons
  const btnAck = document.getElementById('btn-action-acknowledge');
  if (btnAck) {
    btnAck.addEventListener('click', () => handleAcknowledgeIncident());
  }

  const btnEscalate = document.getElementById('btn-action-escalate');
  if (btnEscalate) {
    btnEscalate.addEventListener('click', () => {
      openEscalateModal();
    });
  }

  const btnResolve = document.getElementById('btn-action-resolve');
  if (btnResolve) {
    btnResolve.addEventListener('click', () => handleResolveIncident());
  }

  // Response Note Form
  const formNote = document.getElementById('form-add-response-note');
  if (formNote) {
    formNote.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAddNote();
    });
  }

  // Escalate Modal Buttons
  const btnCloseEscalate = document.getElementById('btn-close-escalate-modal');
  const btnCancelEscalate = document.getElementById('btn-cancel-escalate');
  const btnConfirmEscalate = document.getElementById('btn-confirm-escalate');

  if (btnCloseEscalate) btnCloseEscalate.addEventListener('click', () => closeEscalateModal());
  if (btnCancelEscalate) btnCancelEscalate.addEventListener('click', () => closeEscalateModal());
  if (btnConfirmEscalate) {
    btnConfirmEscalate.addEventListener('click', () => handleConfirmEscalate());
  }

  renderSelectedIncidentDetails();
}

/**
 * Render the Selected Incident Details Workspace
 */
export function renderSelectedIncidentDetails() {
  const incident = adminState.incidents.find(i => i.id === adminState.selectedIncidentId) || adminState.incidents[0];
  if (!incident) return;

  // Header Elements
  const idEl = document.getElementById('detail-incident-id');
  const badgeEl = document.getElementById('detail-incident-badge');
  const statusPill = document.getElementById('detail-incident-status-pill');

  if (idEl) idEl.textContent = incident.id;
  if (badgeEl) {
    badgeEl.textContent = incident.type;
    badgeEl.className = `incident-type-badge ${incident.severity === 'critical' ? 'critical' : incident.severity === 'high' ? 'warning' : 'info'}`;
  }
  if (statusPill) {
    statusPill.textContent = `Status: ${incident.status.toUpperCase()}`;
    statusPill.className = `status-pill ${incident.status === 'resolved' ? 'success' : incident.status === 'escalated' ? 'critical' : incident.status === 'acknowledged' ? 'warning' : 'critical'}`;
  }

  // Dossier Fields
  const nameEl = document.getElementById('detail-user-name');
  const tierEl = document.getElementById('detail-user-tier');
  const phoneEl = document.getElementById('detail-user-phone');
  const timeEl = document.getElementById('detail-timestamp');
  const elapsedEl = document.getElementById('detail-time-elapsed');
  const merchantEl = document.getElementById('detail-merchant');

  if (nameEl) nameEl.textContent = incident.userName;
  if (tierEl) tierEl.textContent = incident.userImpairment;
  if (phoneEl) phoneEl.textContent = incident.userPhone;
  if (timeEl) timeEl.textContent = incident.timestamp;
  if (elapsedEl) elapsedEl.textContent = incident.timeElapsed;
  if (merchantEl) merchantEl.textContent = `${incident.merchant} (${incident.amount})`;

  // Location & Map Elements
  const gpsEl = document.getElementById('detail-gps-coords');
  const addressEl = document.getElementById('detail-address-text');
  const mapMarkerLabel = document.getElementById('map-marker-label');

  if (gpsEl) gpsEl.textContent = incident.gps;
  if (addressEl) addressEl.innerHTML = `📍 <strong>Street Address:</strong> ${escapeHTML(incident.address)}`;
  if (mapMarkerLabel) mapMarkerLabel.textContent = `${incident.userName} (${incident.type})`;

  // Render Interactive Leaflet Map with Real OSM / CartoDB Tiles
  renderIncidentMap(incident);

  // Guardians Notification List
  const guardiansList = document.getElementById('detail-guardians-list');
  if (guardiansList) {
    guardiansList.innerHTML = '';
    incident.guardians.forEach((g) => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: var(--admin-bg-elevated); border: 1px solid var(--admin-border-subtle); padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.82rem;';
      row.innerHTML = `
        <div>
          <strong style="color: #FFFFFF;">${escapeHTML(g.name)}</strong> <span style="font-size: 0.72rem; color: var(--admin-text-muted);">(${escapeHTML(g.relationship)})</span>
          <div style="font-size: 0.74rem; font-family: var(--font-family-mono); color: var(--admin-color-info-light); margin-top: 2px;">${escapeHTML(g.phone)}</div>
        </div>
        <span class="status-pill ${g.status.includes('Ack Received') ? 'success' : 'info'}">${escapeHTML(g.status)}</span>
      `;
      guardiansList.appendChild(row);
    });
  }

  // Timeline
  renderIncidentTimeline(incident);

  // Notes Feed
  renderResponseNotes(incident);

  // Update Action Button States
  const btnAck = document.getElementById('btn-action-acknowledge');
  const btnResolve = document.getElementById('btn-action-resolve');
  const btnEscalate = document.getElementById('btn-action-escalate');

  if (btnAck) {
    btnAck.disabled = incident.status === 'acknowledged' || incident.status === 'resolved';
    btnAck.textContent = incident.status === 'acknowledged' ? '✓ Acknowledged (Under Operator Triage)' : '✓ Acknowledge Alert (Take Ownership)';
  }
  if (btnResolve) {
    btnResolve.disabled = incident.status === 'resolved';
    btnResolve.textContent = incident.status === 'resolved' ? '✔ Incident Resolved' : '✔ Resolve Incident (Mark Safe)';
  }
  if (btnEscalate) {
    btnEscalate.disabled = incident.status === 'escalated' || incident.status === 'resolved';
  }
}

/**
 * Parse Incident Coordinates into [latitude, longitude]
 */
function parseCoordinates(incident) {
  if (incident.lat && incident.lng) {
    return [incident.lat, incident.lng];
  }
  if (incident.gps) {
    return parseCoordinateString(incident.gps);
  }
  return [13.0827, 80.2707]; // Default to Chennai reference
}

/**
 * Render Interactive Geographic Map using Leaflet.js
 */
export function renderIncidentMap(incident) {
  const mapContainer = document.getElementById('incident-map');
  const fallbackContainer = document.getElementById('incident-map-fallback');
  const mapMarkerLabel = document.getElementById('map-marker-label');

  if (mapMarkerLabel) {
    mapMarkerLabel.textContent = `${incident.userName} (${incident.type})`;
  }

  const [lat, lng] = parseCoordinates(incident);

  // Check if Leaflet.js is available on window.L
  if (typeof window !== 'undefined' && window.L && mapContainer) {
    try {
      if (fallbackContainer) fallbackContainer.style.display = 'none';
      mapContainer.style.display = 'block';

      if (!leafletMapInstance && !mapContainer._leaflet_id) {
        leafletMapInstance = window.L.map('incident-map', {
          center: [lat, lng],
          zoom: 16,
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true
        });

        // CartoDB Dark Matter / OpenStreetMap tiles for security operations aesthetics
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
        }).addTo(leafletMapInstance);

        leafletMapInstance.on('tileerror', () => {
          console.info('CartoDB map tile loaded with fallback note.');
        });
      }

      // Update incident marker and perimeter circle
      if (incidentMarkerLayer) {
        leafletMapInstance.removeLayer(incidentMarkerLayer);
      }
      if (incidentCircleLayer) {
        leafletMapInstance.removeLayer(incidentCircleLayer);
      }

      // Incident proximity perimeter circle (120m)
      incidentCircleLayer = window.L.circle([lat, lng], {
        radius: 120,
        color: incident.severity === 'critical' ? '#F43F5E' : '#F59E0B',
        fillColor: incident.severity === 'critical' ? '#F43F5E' : '#F59E0B',
        fillOpacity: 0.16,
        weight: 2,
        dashArray: '4, 6'
      }).addTo(leafletMapInstance);

      // Custom pulsing incident pin marker
      const customPinIcon = window.L.divIcon({
        className: 'leaflet-incident-pin-wrapper',
        html: `
          <div class="map-marker-pulse ${incident.severity}"></div>
          <div class="map-marker-pin ${incident.severity}">!</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      incidentMarkerLayer = window.L.marker([lat, lng], { icon: customPinIcon }).addTo(leafletMapInstance);

      // Location popup
      incidentMarkerLayer.bindPopup(`
        <div class="leaflet-incident-popup">
          <span class="popup-badge ${incident.severity}">${escapeHTML(incident.type)}</span>
          <div class="popup-user">${escapeHTML(incident.userName)}</div>
          <div class="popup-loc">${escapeHTML(incident.address)}</div>
          <div class="popup-coords">GPS: ${escapeHTML(incident.gps)}</div>
        </div>
      `).openPopup();

      leafletMapInstance.setView([lat, lng], 16, { animate: true });

      setTimeout(() => {
        if (leafletMapInstance) leafletMapInstance.invalidateSize();
      }, 250);
      return;
    } catch (err) {
      console.warn('Leaflet interactive map initialization note:', err);
    }
  }

  // Graceful Fallback if Leaflet is unavailable in offline environment
  if (mapContainer) mapContainer.style.display = 'none';
  if (fallbackContainer) {
    fallbackContainer.style.display = 'flex';
  }
}

/**
 * Invalidate map size when tab or sidebar transitions occur
 */
export function invalidateMapSize() {
  if (leafletMapInstance) {
    setTimeout(() => {
      try {
        leafletMapInstance.invalidateSize();
      } catch (e) {}
    }, 180);
  }
}

/**
 * Render Timeline for Incident
 */
function renderIncidentTimeline(incident) {
  const container = document.getElementById('detail-incident-timeline');
  if (!container) return;

  container.innerHTML = '';
  incident.timeline.forEach(step => {
    const el = document.createElement('div');
    el.className = 'timeline-step';

    el.innerHTML = `
      <div class="timeline-step-dot ${step.type}"></div>
      <div class="timeline-step-time">${escapeHTML(step.time)}</div>
      <div class="timeline-step-title">${escapeHTML(step.title)}</div>
      <div class="timeline-step-desc">${escapeHTML(step.desc)}</div>
    `;

    container.appendChild(el);
  });
}

/**
 * Render Response Notes Feed
 */
function renderResponseNotes(incident) {
  const container = document.getElementById('detail-notes-list');
  if (!container) return;

  container.innerHTML = '';
  if (incident.notes.length === 0) {
    container.innerHTML = `<div style="font-size: 0.8rem; color: var(--admin-text-muted); text-align: center; padding: 12px 0;">No operator response notes logged yet.</div>`;
    return;
  }

  incident.notes.forEach(note => {
    const bubble = document.createElement('div');
    bubble.className = 'note-bubble';

    bubble.innerHTML = `
      <div class="note-bubble-header">
        <span class="note-author">${escapeHTML(note.author)}</span>
        <span class="note-timestamp">${escapeHTML(note.time)}</span>
      </div>
      <div class="note-content">${escapeHTML(note.text)}</div>
    `;

    container.appendChild(bubble);
  });
}

/**
 * Handle Acknowledge Action
 */
function handleAcknowledgeIncident() {
  const incident = adminState.incidents.find(i => i.id === adminState.selectedIncidentId);
  if (!incident || incident.status === 'resolved') return;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  incident.status = 'acknowledged';

  incident.timeline.unshift({
    time: now,
    title: 'Operator Acknowledged Incident',
    desc: 'Assigned to Lead Dispatcher Officer S. Chen. Triage underway.',
    type: 'info'
  });

  incident.notes.unshift({
    author: 'Officer S. Chen',
    time: now,
    text: 'Operator acknowledged incident. Reviewing transit patrol telemetry and camera feeds.'
  });

  playAcknowledgeChime();
  announceAdminEvent(`Incident ${incident.id} marked acknowledged.`);
  renderSelectedIncidentDetails();
  renderAlertsTable();
  renderOverview();
}

/**
 * Handle Escalate Modal Flow
 */
function openEscalateModal() {
  const modal = document.getElementById('modal-escalate');
  if (modal) modal.classList.add('active');
}

function closeEscalateModal() {
  const modal = document.getElementById('modal-escalate');
  if (modal) modal.classList.remove('active');
}

function handleConfirmEscalate() {
  const incident = adminState.incidents.find(i => i.id === adminState.selectedIncidentId);
  const inputEl = document.getElementById('escalate-reason-input');
  const reason = inputEl?.value.trim() || 'Coercion suspected; transit security patrol dispatched.';

  if (!incident) return;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  incident.status = 'escalated';
  incident.severity = 'critical';

  incident.timeline.unshift({
    time: now,
    title: 'Incident Escalated to Tier 2',
    desc: `Justification: ${reason}`,
    type: 'critical'
  });

  incident.notes.unshift({
    author: 'Officer S. Chen (ESCALATION)',
    time: now,
    text: `ESCALATED: ${reason}`
  });

  closeEscalateModal();
  playAcknowledgeChime();
  announceAdminEvent(`Incident ${incident.id} escalated to Tier 2.`);
  renderSelectedIncidentDetails();
  renderAlertsTable();
  renderOverview();
}

/**
 * Handle Resolve Action
 */
function handleResolveIncident() {
  const incident = adminState.incidents.find(i => i.id === adminState.selectedIncidentId);
  if (!incident) return;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  incident.status = 'resolved';

  incident.timeline.unshift({
    time: now,
    title: 'Incident Resolved & Closed',
    desc: 'User confirmed safe by guardian contact. Transit patrol verified location clear.',
    type: 'success'
  });

  incident.notes.unshift({
    author: 'Officer S. Chen',
    time: now,
    text: 'Incident closed. User verified in safe transit. No physical injury or extortion verified.'
  });

  playAcknowledgeChime();
  announceAdminEvent(`Incident ${incident.id} marked resolved.`);
  renderSelectedIncidentDetails();
  renderAlertsTable();
  renderOverview();
}

/**
 * Handle Add Note Submission
 */
function handleAddNote() {
  const incident = adminState.incidents.find(i => i.id === adminState.selectedIncidentId);
  const input = document.getElementById('response-note-input');
  const text = input?.value.trim();

  if (!incident || !text) return;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  incident.notes.unshift({
    author: 'Officer S. Chen',
    time: now,
    text: text
  });

  input.value = '';
  announceAdminEvent('Response note logged.');
  renderResponseNotes(incident);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

/**
 * PALMLOCK — Security Operations Center (SOC)
 * Main Administrator Dashboard Bootstrap & Routing Controller
 */

import { adminState } from './state.js';
import { playEmergencySiren } from './audio.js';
import { renderOverview } from './overview.js';
import { initAlertsSection, renderAlertsTable } from './alerts.js';
import { initIncidentDetailsSection, renderSelectedIncidentDetails, invalidateMapSize } from './incident_details.js';
import { initUsersSection, renderUsersTable } from './users.js';
import { initTransactionsSection, renderTransactionsTable } from './transactions.js';
import { renderAllIncidentMarkers } from './map.js';
import { TUTORIAL_LESSONS } from '../user/tutorial.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initGlobalSearch();
  initSimulationControls();
  initAudioControls();
  initKeyboardShortcuts();
  initCrossTabSync();

  // Initialize all section modules
  renderOverview();
  initAlertsSection();
  initIncidentDetailsSection();
  initUsersSection();
  initTransactionsSection();
  initNewSections();

  console.info('PALMLOCK Desktop Security Operations Center (SOC) initialized.');
});

/**
 * 1. Sidebar Navigation Routing & Collapse Toggle
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav-link[data-view]');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetView = link.getAttribute('data-view');
      if (targetView) {
        switchToView(targetView);
      }
    });
  });

  const btnGotoAlerts = document.getElementById('btn-goto-alerts-tab');
  if (btnGotoAlerts) {
    btnGotoAlerts.addEventListener('click', () => {
      switchToView('section-alerts');
    });
  }

  const btnBackToAlerts = document.getElementById('btn-back-to-alerts');
  if (btnBackToAlerts) {
    btnBackToAlerts.addEventListener('click', () => {
      switchToView('section-alerts');
    });
  }

  // Collapsible Sidebar Toggle
  const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      const layout = document.querySelector('.admin-layout');
      if (layout) {
        layout.classList.toggle('sidebar-collapsed');
        const isCollapsed = layout.classList.contains('sidebar-collapsed');
        toggleSidebarBtn.setAttribute('aria-expanded', (!isCollapsed).toString());
        toggleSidebarBtn.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
        invalidateMapSize();
      }
    });
  }
}

/**
 * Switch Active Dashboard Section
 */
export function switchToView(viewId) {
  const allViews = document.querySelectorAll('.admin-view');
  allViews.forEach(v => v.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
    adminState.currentView = viewId;
  }

  // Sync sidebar active indicator
  const navLinks = document.querySelectorAll('.sidebar-nav-link[data-view]');
  navLinks.forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });

  // Re-render view specific dynamic data
  if (viewId === 'section-overview') {
    renderOverview();
  } else if (viewId === 'section-alerts') {
    renderAlertsTable();
  } else if (viewId === 'section-incident-details') {
    renderSelectedIncidentDetails();
    invalidateMapSize();
  } else if (viewId === 'section-users') {
    renderUsersTable();
  } else if (viewId === 'section-transactions') {
    renderTransactionsTable();
  } else if (viewId === 'section-trusted-contacts') {
    renderTrustedContactsSection();
  } else if (viewId === 'section-location-monitoring') {
    renderLocationMonitoringSection();
  } else if (viewId === 'section-escalation-history') {
    renderEscalationHistorySection();
  } else if (viewId === 'section-false-alarm-records') {
    renderFalseAlarmSection();
  } else if (viewId === 'section-tutorial-management') {
    renderTutorialAdminSection();
  } else if (viewId === 'section-settings') {
    renderSettingsSection();
  }

  // Focus heading for accessibility
  setTimeout(() => {
    const heading = target?.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }, 100);
}

/**
 * Open Specific Incident Details
 */
export function openIncidentDetails(incidentId) {
  adminState.selectedIncidentId = incidentId;
  switchToView('section-incident-details');
  renderSelectedIncidentDetails();
  invalidateMapSize();
}

/**
 * 2. Global Search Controller
 */
function initGlobalSearch() {
  const searchInput = document.getElementById('admin-global-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (adminState.currentView === 'section-users') {
      renderUsersTable(query);
    } else if (adminState.currentView === 'section-transactions') {
      renderTransactionsTable(query);
    } else {
      if (query.length > 2) {
        renderUsersTable(query);
        renderTransactionsTable(query);
      }
    }
  });
}

/**
 * 3. Simulated Live Duress Alert (Test Utility)
 */
function initSimulationControls() {
  const btnSimulate = document.getElementById('btn-simulate-duress-event');
  if (!btnSimulate) return;

  btnSimulate.addEventListener('click', () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `ALT-2026-${randomNum}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newAlert = {
      id: newId,
      severity: 'critical',
      type: 'Duress PIN Activated',
      userId: 'usr_8829104',
      userName: 'Maya Lin',
      userImpairment: 'Low Vision (WCAG AAA Preset)',
      userPhone: '+1 (555) 019-2834',
      timestamp: `Today, ${nowTime}`,
      timeElapsed: 'Just now',
      status: 'active',
      merchant: 'Union Square Express POS #12',
      amount: '$14.20',
      posId: 'POS-US-12',
      gps: '37.7879° N, 122.4074° W',
      address: 'Union Square Central Station, San Francisco, CA',
      networkStatus: 'Cellular 5G Ultra-Wideband',
      guardians: [
        { name: 'Sarah Lin', relationship: 'Sister & Primary Guardian', phone: '+1 (555) 234-8901', status: 'SMS Delivered (Pending Ack)' },
        { name: 'Marcus Vance', relationship: 'Personal Advocate', phone: '+1 (555) 981-4320', status: 'SMS Delivered (Pending Ack)' }
      ],
      timeline: [
        { time: nowTime, title: 'Duress PIN Entered at Union Square', desc: 'Covert gesture pin input recognized. High priority alert emitted.', type: 'critical' },
        { time: nowTime, title: 'Telemetry Relayed to SOC', desc: 'GPS coordinates fixed: 37.7879° N, 122.4074° W', type: 'warning' }
      ],
      notes: [
        { author: 'System Sentinel', time: nowTime, text: 'Live Duress Alert generated via simulation tool. Transit camera feed requested.' }
      ]
    };

    // Prepend to incidents list
    adminState.incidents.unshift(newAlert);
    adminState.selectedIncidentId = newId;

    // Log activity
    adminState.activities.unshift({
      time: nowTime,
      text: `CRITICAL ALERT: Duress PIN triggered at Union Square for user Maya Lin (${newId}).`,
      type: 'critical'
    });

    // Sound emergency siren
    playEmergencySiren();

    // Announce to ARIA live region
    announceAdminEvent(`New Critical Emergency Alert: ${newId} received for Maya Lin.`);

    // Switch to Alerts view or update Overview
    if (adminState.currentView === 'section-overview') {
      renderOverview();
    } else if (adminState.currentView === 'section-alerts') {
      renderAlertsTable();
    } else {
      switchToView('section-alerts');
    }
  });
}

/**
 * 4. Audio Controls & Siren Toggle
 */
function initAudioControls() {
  const btnToggleSiren = document.getElementById('btn-toggle-siren-audio');
  const labelEl = document.getElementById('siren-status-label');

  if (btnToggleSiren) {
    btnToggleSiren.addEventListener('click', () => {
      adminState.sirenAudioEnabled = !adminState.sirenAudioEnabled;
      btnToggleSiren.setAttribute('aria-pressed', (!adminState.sirenAudioEnabled).toString());
      if (labelEl) {
        labelEl.textContent = adminState.sirenAudioEnabled ? 'Alert Siren: On' : 'Alert Siren: Muted';
      }
      announceAdminEvent(`Emergency alert siren ${adminState.sirenAudioEnabled ? 'enabled' : 'muted'}`);
    });
  }
}

/**
 * 5. Keyboard Accessibility Shortcuts (Ctrl+K to focus search)
 */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('admin-global-search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });
}

/**
 * ARIA Live Announcement Helper for Screen Readers
 */
export function announceAdminEvent(message) {
  const el = document.getElementById('admin-aria-live');
  if (el) {
    el.textContent = '';
    setTimeout(() => {
      el.textContent = message;
    }, 50);
  }
}

/**
 * Initialize Filters and Actions for New Sections
 */
function initNewSections() {
  const contactFilter = document.getElementById('filter-contacts-status');
  if (contactFilter) {
    contactFilter.addEventListener('change', (e) => {
      renderTrustedContactsSection(e.target.value);
    });
  }

  const resetBtn = document.getElementById('btn-reset-demo-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('palmlock_all_incidents');
      localStorage.removeItem('palmlock_latest_incident');
      localStorage.removeItem('palmlock_false_alarms');
      alert('Demonstration local storage reset successfully.');
      location.reload();
    });
  }

  // Window global hook for map popup buttons
  window.viewIncidentFromMap = (id) => {
    openIncidentDetails(id);
  };
}

/**
 * Section 6: Render Trusted Contacts
 */
export function renderTrustedContactsSection(filter = 'all') {
  const tbody = document.getElementById('table-contacts-body');
  const countEl = document.getElementById('contacts-filtered-count');
  if (!tbody) return;

  const contacts = adminState.trustedContacts || [];
  const filtered = contacts.filter(c => {
    if (filter === 'verified') return c.verificationStatus === 'verified';
    if (filter === 'pending') return c.verificationStatus === 'pending';
    return true;
  });

  if (countEl) countEl.textContent = filtered.length;
  tbody.innerHTML = '';

  filtered.forEach(c => {
    const tr = document.createElement('tr');
    const isV = c.verificationStatus === 'verified';
    tr.innerHTML = `
      <td><strong>${c.name}</strong></td>
      <td>${c.user}</td>
      <td>${c.relationship}</td>
      <td style="font-family: var(--font-family-mono);">${c.phone}</td>
      <td>
        <span class="status-pill ${c.isPrimary ? 'critical' : 'info'}">
          ${c.isPrimary ? 'PRIMARY' : 'SECONDARY'}
        </span>
      </td>
      <td>
        <span class="status-pill ${isV ? 'success' : 'warning'}">
          ${isV ? 'Verified' : 'OTP Pending'}
        </span>
      </td>
      <td><span class="status-pill info">${(c.notificationStatus || 'DELIVERED').toUpperCase()}</span></td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" onclick="alert('Guardian dispatch channel test signal sent to ${c.phone}')">
          Ping Guardian
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Section 7: Render Location Monitoring
 */
export function renderLocationMonitoringSection() {
  const feed = document.getElementById('location-telemetry-feed');
  if (feed) {
    feed.innerHTML = '';
    adminState.incidents.forEach(inc => {
      const card = document.createElement('div');
      card.className = 'activity-item-compact';
      card.style.cssText = 'padding: 8px; border: 1px solid var(--admin-border-subtle); border-radius: 6px; cursor: pointer;';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: var(--admin-color-critical);">${inc.id}</strong>
          <span class="status-pill ${inc.severity === 'critical' ? 'critical' : 'warning'}">${inc.severity.toUpperCase()}</span>
        </div>
        <div style="font-size: 11px; margin-top: 2px;">${inc.userName} • ${inc.merchant || 'General Transit'}</div>
        <div style="font-size: 10px; color: var(--admin-text-muted); font-family: var(--font-family-mono); margin-top: 2px;">
          ${inc.gps} (±15m)
        </div>
      `;
      card.onclick = () => {
        openIncidentDetails(inc.id);
      };
      feed.appendChild(card);
    });
  }

  // Render multi-marker interactive map
  setTimeout(() => {
    try {
      renderAllIncidentMarkers(adminState.incidents, 'location-monitoring-map');
    } catch (e) {
      console.warn('Location monitoring map load error:', e);
    }
  }, 100);
}

/**
 * Section 8: Render Escalation History
 */
export function renderEscalationHistorySection() {
  const tbody = document.getElementById('table-escalation-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  const escalations = adminState.escalations || [];

  escalations.forEach(esc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color: var(--admin-color-critical);">${esc.incidentId}</strong></td>
      <td>${esc.user}</td>
      <td><span class="status-pill info">${esc.tier}</span></td>
      <td><span class="status-pill success">${esc.primaryAck}</span></td>
      <td><span class="status-pill ${esc.secondaryAck.includes('Acknowledged') ? 'success' : 'info'}">${esc.secondaryAck}</span></td>
      <td style="font-family: var(--font-family-mono);">${esc.elapsedTime}</td>
      <td><span class="status-pill ${esc.status === 'Resolved' ? 'success' : 'critical'}">${esc.status}</span></td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewIncidentFromMap('${esc.incidentId}')">
          View Incident
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Section 9: Render False Alarm Records
 */
export function renderFalseAlarmSection() {
  const tbody = document.getElementById('table-false-alarm-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  const alarms = adminState.falseAlarms || [];

  alarms.forEach(fa => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${fa.incidentId}</strong></td>
      <td>${fa.user}</td>
      <td><span class="status-pill warning">${fa.alertType}</span></td>
      <td>${fa.cancelledAt}</td>
      <td style="max-width: 280px; font-size: 11px;">"${fa.reason}"</td>
      <td><span class="status-pill success">${fa.reviewStatus}</span></td>
      <td>${fa.reviewingOfficer}</td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" onclick="alert('Officer resolution confirmed for ${fa.incidentId}')">
          Verify & Close
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Section 10: Render Tutorial Management
 */
export function renderTutorialAdminSection() {
  const tbody = document.getElementById('table-tutorial-admin-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  const lessons = TUTORIAL_LESSONS || [];

  lessons.forEach((les, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${idx + 1}</strong></td>
      <td><strong>${les.title}</strong></td>
      <td><span class="status-pill info">${les.category}</span></td>
      <td style="max-width: 300px; font-size: 11px; color: var(--admin-text-secondary);">${les.body.slice(0, 85)}...</td>
      <td><span class="status-pill info">Polished Audio & Visual</span></td>
      <td><span class="status-pill success">Active</span></td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" onclick="alert('Previewing Lesson ${idx + 1}: ${les.title}')">
          Preview
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Section 11: Render Settings Section
 */
export function renderSettingsSection() {
  // Static controls loaded in HTML
}

/**
 * Cross-Tab Broadcast Channel Sync
 * Receives emergency alerts in real-time when triggered in mobile tab!
 */
function initCrossTabSync() {
  if (typeof BroadcastChannel === 'undefined') return;

  try {
    const bc = new BroadcastChannel('palmlock_soc_channel');
    bc.onmessage = (event) => {
      const { type, incident, record } = event.data;

      if ((type === 'NEW_EMERGENCY_INCIDENT' || type === 'INCIDENT_SYNCED_FROM_OFFLINE') && incident) {
        // Prepend to incidents list if not already present
        if (!adminState.incidents.some(i => i.id === incident.id)) {
          adminState.incidents.unshift(incident);
        } else {
          // Update existing incident
          const idx = adminState.incidents.findIndex(i => i.id === incident.id);
          if (idx !== -1) adminState.incidents[idx] = incident;
        }

        // Update active alerts count badge
        const badge = document.getElementById('badge-active-alerts');
        if (badge) {
          badge.textContent = adminState.incidents.filter(i => i.status !== 'resolved').length;
        }

        // Trigger Audio Siren if enabled
        if (adminState.sirenAudioEnabled) {
          playEmergencySiren();
        }

        // Announce
        announceAdminEvent(`PRIORITY ALERT: New emergency incident ${incident.id} received from ${incident.userName}!`);

        // Re-render overview & alerts
        renderOverview();
        renderAlertsTable();
      }

      if (type === 'FALSE_ALARM_REPORTED' && record) {
        adminState.falseAlarms.unshift({
          id: `FA-${Date.now()}`,
          incidentId: record.incidentId,
          user: record.user,
          alertType: 'SOS / Duress Trigger',
          cancelledAt: record.cancelledAt,
          reason: record.reason,
          reviewStatus: 'Pending Review',
          reviewingOfficer: 'Officer K. Ramanathan',
          notes: 'User reported false alarm from mobile application.'
        });
        renderFalseAlarmSection();
      }
    };
  } catch (e) {
    console.info('BroadcastChannel cross-tab listener warning:', e);
  }
}

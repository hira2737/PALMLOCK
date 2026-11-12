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

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initGlobalSearch();
  initSimulationControls();
  initAudioControls();
  initKeyboardShortcuts();

  // Initialize all section modules
  renderOverview();
  initAlertsSection();
  initIncidentDetailsSection();
  initUsersSection();
  initTransactionsSection();

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

/**
 * PALMLOCK — Security Operations Center (SOC)
 * Emergency Alerts Table & Incident Triage Controller
 */

import { adminState } from './state.js';
import { openIncidentDetails, announceAdminEvent } from './admin.js';
import { playAcknowledgeChime } from './audio.js';
import { renderOverview } from './overview.js';

export function initAlertsSection() {
  const statusFilter = document.getElementById('filter-alert-status');
  const severityFilter = document.getElementById('filter-alert-severity');

  if (statusFilter) {
    statusFilter.addEventListener('change', () => renderAlertsTable());
  }
  if (severityFilter) {
    severityFilter.addEventListener('change', () => renderAlertsTable());
  }

  renderAlertsTable();
}

/**
 * Render Filtered Alerts Table
 */
export function renderAlertsTable() {
  const tbody = document.getElementById('table-alerts-body');
  const countEl = document.getElementById('alerts-filtered-count');
  const statusFilter = document.getElementById('filter-alert-status')?.value || 'active';
  const severityFilter = document.getElementById('filter-alert-severity')?.value || 'all';

  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = adminState.incidents.filter(item => {
    // Status filter
    if (statusFilter === 'active' && item.status === 'resolved') return false;
    if (statusFilter === 'escalated' && item.status !== 'escalated') return false;
    if (statusFilter === 'resolved' && item.status !== 'resolved') return false;

    // Severity filter
    if (severityFilter !== 'all' && item.severity !== severityFilter) return false;

    return true;
  });

  if (countEl) countEl.textContent = filtered.length.toString();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: var(--space-6); color: var(--admin-text-muted);">
          No emergency incidents found matching the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');

    const sevBadge = item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'warning' : 'info';
    const statusPill = item.status === 'resolved' ? 'success' : item.status === 'escalated' ? 'critical' : item.status === 'acknowledged' ? 'warning' : 'critical';

    tr.innerHTML = `
      <td><span class="incident-id-tag">${escapeHTML(item.id)}</span></td>
      <td><span class="status-pill ${sevBadge}">${escapeHTML(item.severity.toUpperCase())}</span></td>
      <td><strong>${escapeHTML(item.type)}</strong></td>
      <td>
        <div><strong>${escapeHTML(item.userName)}</strong></div>
        <div style="font-size: var(--font-size-xs); color: var(--admin-text-muted);">${escapeHTML(item.userImpairment)}</div>
      </td>
      <td>
        <div>${escapeHTML(item.timestamp)}</div>
        <div style="font-size: var(--font-size-xs); color: var(--admin-text-muted);">${escapeHTML(item.timeElapsed)}</div>
      </td>
      <td>
        <div>${escapeHTML(item.merchant)}</div>
        <div style="font-size: var(--font-size-xs); font-family: var(--font-family-mono); color: var(--admin-text-muted);">${escapeHTML(item.gps)}</div>
      </td>
      <td>
        <div style="font-size: var(--font-size-xs);">
          <div>${escapeHTML(item.guardians[0]?.name || 'N/A')}: <strong>${escapeHTML(item.guardians[0]?.status || 'Pending')}</strong></div>
          ${item.guardians[1] ? `<div style="color: var(--admin-text-muted);">${escapeHTML(item.guardians[1].name)}: ${escapeHTML(item.guardians[1].status)}</div>` : ''}
        </div>
      </td>
      <td><span class="status-pill info">${escapeHTML(item.networkStatus)}</span></td>
      <td>
        <div class="btn-group-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-inspect-alert" data-id="${item.id}" title="Inspect Dossier & Dispatch">
            Inspect ›
          </button>
          ${item.status === 'active' ? `
            <button type="button" class="btn btn-primary btn-sm btn-quick-ack" data-id="${item.id}" title="Acknowledge Incident">
              Ack
            </button>
          ` : ''}
        </div>
      </td>
    `;

    // Click handlers
    const inspectBtn = tr.querySelector('.btn-inspect-alert');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', () => {
        openIncidentDetails(item.id);
      });
    }

    const ackBtn = tr.querySelector('.btn-quick-ack');
    if (ackBtn) {
      ackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickAcknowledgeAlert(item.id);
      });
    }

    tbody.appendChild(tr);
  });
}

/**
 * Quick Acknowledge Helper
 */
function quickAcknowledgeAlert(id) {
  const incident = adminState.incidents.find(i => i.id === id);
  if (!incident) return;

  incident.status = 'acknowledged';
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  incident.timeline.unshift({
    time: now,
    title: 'Operator Acknowledged Alert',
    desc: 'Incident ownership claimed by Officer S. Chen in SOC console.',
    type: 'info'
  });

  incident.notes.unshift({
    author: 'Officer S. Chen',
    time: now,
    text: 'Operator acknowledged incident via quick-action console.'
  });

  playAcknowledgeChime();
  announceAdminEvent(`Incident ${id} acknowledged by operator.`);
  renderAlertsTable();
  renderOverview();
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

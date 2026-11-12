/**
 * PALMLOCK — Security Operations Center (SOC)
 * Overview Dashboard Controller: KPI Metrics, Activity Feeds, Severity Bar
 */

import { adminState } from './state.js';
import { switchToView, openIncidentDetails } from './admin.js';

export function renderOverview() {
  updateKPIMetrics();
  renderOverviewActiveAlerts();
  renderSeverityBar();
  renderActivityStream();
}

/**
 * 1. Calculate & Update KPI Metric Values
 */
function updateKPIMetrics() {
  const activeAlerts = adminState.incidents.filter(i => i.status !== 'resolved');
  const resolvedAlerts = adminState.incidents.filter(i => i.status === 'resolved');

  const kpiAlertsEl = document.getElementById('kpi-active-alerts-count');
  const kpiAlertsBadge = document.getElementById('kpi-alerts-badge');
  const sidebarAlertsBadge = document.getElementById('badge-active-alerts');

  if (kpiAlertsEl) kpiAlertsEl.textContent = activeAlerts.length.toString();
  if (kpiAlertsBadge) {
    kpiAlertsBadge.textContent = activeAlerts.length > 0 ? `${activeAlerts.length} Active` : 'All Clear';
    kpiAlertsBadge.className = activeAlerts.length > 0 ? 'status-pill critical' : 'status-pill success';
  }
  if (sidebarAlertsBadge) {
    sidebarAlertsBadge.textContent = activeAlerts.length.toString();
    sidebarAlertsBadge.style.display = activeAlerts.length > 0 ? 'inline-block' : 'none';
  }

  const kpiUsersEl = document.getElementById('kpi-total-users-count');
  if (kpiUsersEl) {
    kpiUsersEl.textContent = (1240 + adminState.users.length).toLocaleString();
  }

  const kpiResolvedEl = document.getElementById('kpi-resolved-incidents-count');
  if (kpiResolvedEl) {
    kpiResolvedEl.textContent = (18 + resolvedAlerts.length).toString();
  }
}

/**
 * 2. Render Overview Active Alerts Stream
 */
function renderOverviewActiveAlerts() {
  const container = document.getElementById('overview-active-alerts-feed');
  if (!container) return;

  container.innerHTML = '';
  const activeList = adminState.incidents.filter(i => i.status !== 'resolved');

  if (activeList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-6); color: var(--admin-text-muted);">
        <span style="font-size: 2rem;">✓</span>
        <p style="margin-top: var(--space-2);">No active emergency alerts. All monitored users secure.</p>
      </div>
    `;
    return;
  }

  activeList.forEach(item => {
    const card = document.createElement('article');
    card.className = `incident-card ${item.severity}`;
    card.setAttribute('aria-label', `Incident ${item.id}: ${item.type} for ${item.userName}`);

    const badgeClass = item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'warning' : 'info';

    card.innerHTML = `
      <div class="incident-header-row">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="incident-type-badge ${badgeClass}">${escapeHTML(item.type)}</span>
          <span class="incident-id-tag">${escapeHTML(item.id)}</span>
        </div>
        <span class="status-pill ${item.status === 'escalated' ? 'critical' : item.status === 'acknowledged' ? 'warning' : 'critical'}">
          ${item.status.toUpperCase()}
        </span>
      </div>

      <div class="incident-details-grid">
        <div class="incident-detail-item">
          <span class="detail-label">User</span>
          <span class="detail-value">${escapeHTML(item.userName)}</span>
          <span class="detail-sub">${escapeHTML(item.userImpairment)}</span>
        </div>
        <div class="incident-detail-item">
          <span class="detail-label">Location</span>
          <span class="detail-value">${escapeHTML(item.merchant)}</span>
          <span class="detail-sub">${escapeHTML(item.gps)}</span>
        </div>
        <div class="incident-detail-item">
          <span class="detail-label">Time</span>
          <span class="detail-value">${escapeHTML(item.timeElapsed)}</span>
          <span class="detail-sub">${escapeHTML(item.timestamp)}</span>
        </div>
      </div>

      <div class="incident-actions-row">
        <div style="font-size: var(--font-size-xs); color: var(--admin-text-muted);">
          Guardians: <strong>${item.guardians[0]?.name || 'Registered'} (${item.guardians[0]?.status || 'Dispatched'})</strong>
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-inspect-incident" data-id="${item.id}">
          Inspect & Dispatch Incident ›
        </button>
      </div>
    `;

    const btn = card.querySelector('.btn-inspect-incident');
    if (btn) {
      btn.addEventListener('click', () => {
        openIncidentDetails(item.id);
      });
    }

    container.appendChild(card);
  });
}

/**
 * 3. Render Alert Severity Distribution Bar
 */
function renderSeverityBar() {
  const container = document.getElementById('overview-severity-bar');
  if (!container) return;

  const critical = adminState.incidents.filter(i => i.severity === 'critical').length;
  const high = adminState.incidents.filter(i => i.severity === 'high').length;
  const medium = adminState.incidents.filter(i => i.severity === 'medium').length;
  const total = critical + high + medium || 1;

  const pCrit = Math.max(10, Math.round((critical / total) * 100));
  const pHigh = Math.max(10, Math.round((high / total) * 100));
  const pMed = 100 - (pCrit + pHigh);

  container.innerHTML = `
    <div class="severity-bar-segment critical" style="width: ${pCrit}%;" title="Critical: ${critical}"></div>
    <div class="severity-bar-segment warning" style="width: ${pHigh}%;" title="High: ${high}"></div>
    <div class="severity-bar-segment info" style="width: ${pMed}%;" title="Medium: ${medium}"></div>
  `;
}

/**
 * 4. Render Activity Stream
 */
function renderActivityStream() {
  const container = document.getElementById('overview-activity-stream');
  if (!container) return;

  container.innerHTML = '';
  adminState.activities.forEach(act => {
    const step = document.createElement('div');
    step.className = 'timeline-step';

    step.innerHTML = `
      <div class="timeline-step-dot ${act.type}"></div>
      <div class="timeline-step-time">${escapeHTML(act.time)}</div>
      <div class="timeline-step-desc">${escapeHTML(act.text)}</div>
    `;

    container.appendChild(step);
  });
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

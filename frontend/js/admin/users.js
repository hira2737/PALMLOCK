/**
 * PALMLOCK — Security Operations Center (SOC)
 * User Directory & Accessibility Profile Controller
 */

import { adminState } from './state.js';

export function initUsersSection() {
  const impairmentFilter = document.getElementById('filter-user-impairment');
  const statusFilter = document.getElementById('filter-user-status');

  if (impairmentFilter) impairmentFilter.addEventListener('change', () => renderUsersTable());
  if (statusFilter) statusFilter.addEventListener('change', () => renderUsersTable());

  // Modal Close Buttons
  const closeBtn = document.getElementById('btn-close-user-modal');
  const dismissBtn = document.getElementById('btn-dismiss-user-modal');

  if (closeBtn) closeBtn.addEventListener('click', () => closeUserModal());
  if (dismissBtn) dismissBtn.addEventListener('click', () => closeUserModal());

  renderUsersTable();
}

/**
 * Render Filtered Users Table
 */
export function renderUsersTable(searchTerm = '') {
  const tbody = document.getElementById('table-users-body');
  const countEl = document.getElementById('users-filtered-count');
  const impairmentFilter = document.getElementById('filter-user-impairment')?.value || 'all';
  const statusFilter = document.getElementById('filter-user-status')?.value || 'all';

  if (!tbody) return;
  tbody.innerHTML = '';

  const q = searchTerm.toLowerCase();

  const filtered = adminState.users.filter(user => {
    // Impairment filter
    if (impairmentFilter !== 'all' && user.visionLevel !== impairmentFilter) return false;

    // Status filter
    if (statusFilter !== 'all' && user.status !== statusFilter) return false;

    // Search query
    if (q) {
      const matchName = user.name.toLowerCase().includes(q);
      const matchEmail = user.email.toLowerCase().includes(q);
      const matchPhone = user.phone.includes(q);
      const matchId = user.id.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
    }

    return true;
  });

  if (countEl) countEl.textContent = filtered.length.toString();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: var(--space-6); color: var(--admin-text-muted);">
          No user profiles found matching current criteria.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(user => {
    const tr = document.createElement('tr');

    const statusPill = user.status === 'flagged' ? 'critical' : 'success';

    tr.innerHTML = `
      <td><span class="incident-id-tag">${escapeHTML(user.id)}</span></td>
      <td>
        <strong>${escapeHTML(user.name)}</strong>
        <div style="font-size: var(--font-size-xs); color: var(--admin-text-muted);">${escapeHTML(user.email)}</div>
      </td>
      <td><span class="status-pill info">${escapeHTML(user.visionDisplay)}</span></td>
      <td>${escapeHTML(user.phone)}</td>
      <td><strong>${user.guardiansCount} Registered</strong></td>
      <td>${escapeHTML(user.balance)}</td>
      <td><span class="status-pill ${statusPill}">${escapeHTML(user.status.toUpperCase())}</span></td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm btn-inspect-user" data-id="${user.id}">
          Profile Dossier ›
        </button>
      </td>
    `;

    const inspectBtn = tr.querySelector('.btn-inspect-user');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', () => openUserModal(user.id));
    }

    tbody.appendChild(tr);
  });
}

/**
 * Open User Profile Dossier Modal
 */
function openUserModal(userId) {
  const user = adminState.users.find(u => u.id === userId);
  const modal = document.getElementById('modal-user-profile');
  const body = document.getElementById('modal-user-body');

  if (!user || !modal || !body) return;

  body.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2);">
      <div class="admin-avatar" style="width: 50px; height: 50px; font-size: 1.2rem;">${escapeHTML(user.name.charAt(0))}</div>
      <div>
        <h3 style="font-size: var(--font-size-lg); font-weight: 700; color: #fff;">${escapeHTML(user.name)}</h3>
        <div style="font-size: var(--font-size-xs); color: var(--admin-text-muted);">${escapeHTML(user.email)} • ${escapeHTML(user.id)}</div>
      </div>
    </div>

    <div class="incident-details-grid" style="margin-bottom: var(--space-3);">
      <div class="incident-detail-item">
        <span class="detail-label">Visual Impairment Tier</span>
        <span class="detail-value" style="color: var(--admin-color-info);">${escapeHTML(user.visionDisplay)}</span>
      </div>
      <div class="incident-detail-item">
        <span class="detail-label">Mobile Phone</span>
        <span class="detail-value">${escapeHTML(user.phone)}</span>
      </div>
      <div class="incident-detail-item">
        <span class="detail-label">Linked Account</span>
        <span class="detail-value">Checking (${escapeHTML(user.accountNumber)})</span>
      </div>
      <div class="incident-detail-item">
        <span class="detail-label">Duress Alerts Triggered</span>
        <span class="detail-value" style="color: ${user.duressCount > 0 ? 'var(--admin-color-critical)' : 'var(--admin-color-success)'};">${user.duressCount} Recorded</span>
      </div>
    </div>

    <h4 style="font-size: var(--font-size-sm); font-weight: 700; text-transform: uppercase; color: var(--admin-text-muted); margin-bottom: var(--space-2);">
      Registered Emergency Guardians (${user.guardians.length})
    </h4>

    <div style="display: flex; flex-direction: column; gap: var(--space-2);">
      ${user.guardians.map(g => `
        <div style="background: var(--admin-bg-elevated); padding: var(--space-3); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; color: #fff;">${escapeHTML(g.name)}</div>
            <div style="font-size: var(--font-size-xs); color: var(--admin-text-muted);">${escapeHTML(g.rel)}</div>
          </div>
          <span style="font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--admin-color-info);">${escapeHTML(g.phone)}</span>
        </div>
      `).join('')}
    </div>
  `;

  modal.classList.add('active');
}

function closeUserModal() {
  const modal = document.getElementById('modal-user-profile');
  if (modal) modal.classList.remove('active');
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

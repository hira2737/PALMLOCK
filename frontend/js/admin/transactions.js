/**
 * PALMLOCK — Security Operations Center (SOC)
 * Transaction Security Audit Ledger Controller
 */

import { adminState } from './state.js';

export function initTransactionsSection() {
  const filterSelect = document.getElementById('filter-tx-status');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => renderTransactionsTable());
  }

  renderTransactionsTable();
}

/**
 * Render Filtered Transactions Table
 */
export function renderTransactionsTable(searchTerm = '') {
  const tbody = document.getElementById('table-tx-body');
  const countEl = document.getElementById('tx-filtered-count');
  const statusFilter = document.getElementById('filter-tx-status')?.value || 'all';

  if (!tbody) return;
  tbody.innerHTML = '';

  const q = searchTerm.toLowerCase();

  const filtered = adminState.transactions.filter(item => {
    // Status filter
    if (statusFilter === 'completed' && item.status !== 'completed') return false;
    if (statusFilter === 'duress' && item.status !== 'duress_intercepted') return false;

    // Search query
    if (q) {
      const matchMerchant = item.merchant.toLowerCase().includes(q);
      const matchUser = item.user.toLowerCase().includes(q);
      const matchRef = item.reference.toLowerCase().includes(q);
      if (!matchMerchant && !matchUser && !matchRef) return false;
    }

    return true;
  });

  if (countEl) countEl.textContent = filtered.length.toString();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: var(--space-6); color: var(--admin-text-muted);">
          No transaction audit records match the current criteria.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(tx => {
    const tr = document.createElement('tr');
    const isDuress = tx.status === 'duress_intercepted';

    tr.innerHTML = `
      <td><span class="incident-id-tag">${escapeHTML(tx.reference)}</span></td>
      <td>${escapeHTML(tx.date)}</td>
      <td><strong>${escapeHTML(tx.user)}</strong></td>
      <td>${escapeHTML(tx.merchant)}</td>
      <td><span class="status-pill info">${escapeHTML(tx.category)}</span></td>
      <td><strong style="font-size: var(--font-size-base);">${escapeHTML(tx.amount)}</strong></td>
      <td>
        <span class="status-pill ${isDuress ? 'critical' : 'success'}">
          ${escapeHTML(tx.statusLabel)}
        </span>
      </td>
      <td>
        <div style="font-size: var(--font-size-xs); color: var(--admin-text-muted);">
          Auth: <strong>${escapeHTML(tx.authMethod)}</strong>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
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

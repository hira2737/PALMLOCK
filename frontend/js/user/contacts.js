/**
 * PALMLOCK — Touch Beyond Vision
 * Trusted Emergency Contacts & Guardian Management
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';
import { openModal, closeModal } from './navigation.js';

/**
 * Initialize Contacts UI & Form Listeners
 */
export function initContacts() {
  const triggerBtn = document.getElementById('btn-add-contact-trigger');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      openModal('modal-add-contact');
    });
  }

  const cancelBtn = document.getElementById('btn-cancel-add-contact');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal('modal-add-contact');
    });
  }

  const form = document.getElementById('form-new-contact');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAddNewContact();
    });
  }

  renderContactsList();
}

/**
 * Render Contacts Cards
 */
export function renderContactsList() {
  const container = document.getElementById('contacts-list-container');
  if (!container) return;

  container.innerHTML = '';

  if (state.contacts.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted);">
        No trusted contacts registered. Add at least one emergency guardian.
      </div>
    `;
    return;
  }

  state.contacts.forEach((contact, index) => {
    const card = document.createElement('article');
    card.className = 'contact-item-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `Guardian ${index + 1}: ${contact.name}, ${contact.relationship}, ${contact.phone}`);

    card.innerHTML = `
      <div class="contact-info">
        <div class="contact-name">${escapeHTML(contact.name)}</div>
        <div class="contact-phone">${escapeHTML(contact.phone)}</div>
        <div style="margin-top: 4px;">
          <span class="contact-tag">${escapeHTML(contact.relationship)}</span>
          ${contact.notifyOnDuress ? '<span class="history-badge duress" style="margin-left: 6px;">Duress Alerts ON</span>' : ''}
        </div>
      </div>
      <div>
        <button type="button" class="btn-icon-access btn-delete-contact" data-id="${contact.id}" aria-label="Remove ${contact.name} from emergency contacts" title="Delete Contact">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    const deleteBtn = card.querySelector('.btn-delete-contact');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteContact(contact.id);
      });
    }

    container.appendChild(card);
  });
}

function handleAddNewContact() {
  const nameInput = document.getElementById('contact-name-input');
  const relInput = document.getElementById('contact-relationship-input');
  const phoneInput = document.getElementById('contact-phone-input');
  const duressInput = document.getElementById('contact-duress-notify');

  const name = nameInput?.value.trim();
  const rel = relInput?.value.trim();
  const phone = phoneInput?.value.trim();
  const notify = duressInput?.checked ?? true;

  if (!name || !phone) {
    provideFeedback({
      text: 'Please enter both a contact name and phone number.',
      gesture: 'ERROR'
    });
    return;
  }

  const newContact = {
    id: `cnt_${Date.now()}`,
    name: name,
    relationship: rel || 'Emergency Guardian',
    phone: phone,
    notifyOnDuress: notify
  };

  state.contacts.push(newContact);
  renderContactsList();
  closeModal('modal-add-contact');

  // Reset inputs
  if (nameInput) nameInput.value = '';
  if (relInput) relInput.value = '';
  if (phoneInput) phoneInput.value = '';

  provideFeedback({
    text: `Added ${name} to trusted emergency contacts.`,
    gesture: 'SUCCESS',
    hapticPattern: 100,
    hapticLabel: 'Contact Added'
  });
}

function deleteContact(id) {
  const target = state.contacts.find(c => c.id === id);
  state.contacts = state.contacts.filter(c => c.id !== id);
  renderContactsList();

  provideFeedback({
    text: `Removed ${target ? target.name : 'contact'} from emergency contacts.`,
    hapticPattern: 80,
    hapticLabel: 'Contact Removed'
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

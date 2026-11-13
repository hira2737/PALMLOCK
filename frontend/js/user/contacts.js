/**
 * PALMLOCK — Touch Beyond Vision
 * Trusted Emergency Contacts & Guardian Management
 * Supports Primary/Secondary Designation, OTP Verification Simulation,
 * Indian Phone Numbers (+91) & Broadcast Synchronization.
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';
import { openModal, closeModal } from './navigation.js';

let activeVerificationContactId = null;

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

  // OTP Verification Modal Submit
  const formOtp = document.getElementById('form-verify-otp');
  if (formOtp) {
    formOtp.addEventListener('submit', (e) => {
      e.preventDefault();
      handleVerifyContactOtp();
    });
  }

  const cancelOtpBtn = document.getElementById('btn-cancel-verify-otp');
  if (cancelOtpBtn) {
    cancelOtpBtn.addEventListener('click', () => {
      closeModal('modal-verify-otp');
      activeVerificationContactId = null;
    });
  }

  renderContactsList();
}

/**
 * Render Contacts Cards with Full Verification & Notification Badges
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
    card.setAttribute('aria-label', `Guardian ${index + 1}: ${contact.name}, ${contact.relationship}, ${contact.phone}, Status: ${contact.verificationStatus}`);

    const isPrimary = contact.isPrimary || index === 0;
    const vStatus = contact.verificationStatus || 'verified';
    const nStatus = contact.notificationStatus || 'acknowledged';

    let vBadgeClass = 'history-badge success';
    let vText = 'Verified Guardian';
    if (vStatus === 'pending') {
      vBadgeClass = 'history-badge pending';
      vText = 'Verification Pending (OTP Required)';
    } else if (vStatus === 'failed') {
      vBadgeClass = 'history-badge duress';
      vText = 'Verification Failed';
    }

    card.innerHTML = `
      <div class="contact-info" style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="contact-name">${escapeHTML(contact.name)}</div>
          <span class="contact-tag" style="background: ${isPrimary ? 'var(--accent-primary)' : 'var(--bg-tertiary)'}; color: ${isPrimary ? '#000' : 'var(--text-primary)'}; font-weight: bold;">
            ${isPrimary ? 'PRIMARY' : 'SECONDARY'}
          </span>
        </div>
        <div class="contact-phone" style="font-family: var(--font-family-mono); margin-top: 4px;">${escapeHTML(contact.phone)}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
          ${escapeHTML(contact.relationship || 'Emergency Guardian')}
        </div>
        
        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
          <span class="${vBadgeClass}">${vText}</span>
          <span class="contact-tag" style="font-size: 0.72rem;">Dispatch: ${nStatus.toUpperCase()}</span>
          ${contact.notifyOnDuress ? '<span class="history-badge duress" style="font-size: 0.72rem;">Duress Alert ON</span>' : ''}
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; align-items: flex-end;">
        ${vStatus === 'pending' ? `
          <button type="button" class="btn btn-secondary btn-verify-contact" data-id="${contact.id}" style="font-size: 0.75rem; padding: 4px 8px;">
            Verify OTP
          </button>
        ` : ''}
        
        <div style="display: flex; gap: 4px;">
          <button type="button" class="btn-icon-access btn-toggle-primary" data-id="${contact.id}" title="${isPrimary ? 'Currently Primary' : 'Make Primary'}" aria-label="Make ${contact.name} primary contact">
            <span style="font-size: 1rem; color: ${isPrimary ? 'var(--accent-primary)' : 'var(--text-muted)'};">★</span>
          </button>
          <button type="button" class="btn-icon-access btn-delete-contact" data-id="${contact.id}" aria-label="Remove ${contact.name} from emergency contacts" title="Delete Contact">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;

    // Verify OTP Button
    const verifyBtn = card.querySelector('.btn-verify-contact');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => {
        openOtpVerificationModal(contact.id);
      });
    }

    // Toggle Primary
    const starBtn = card.querySelector('.btn-toggle-primary');
    if (starBtn) {
      starBtn.addEventListener('click', () => {
        setPrimaryContact(contact.id);
      });
    }

    // Delete
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

/**
 * Add New Contact with Indian Phone Validation
 */
function handleAddNewContact() {
  const nameInput = document.getElementById('contact-name-input');
  const relInput = document.getElementById('contact-relationship-input');
  const phoneInput = document.getElementById('contact-phone-input');
  const duressInput = document.getElementById('contact-duress-notify');
  const isPrimaryCheck = document.getElementById('contact-is-primary');

  const name = nameInput?.value.trim();
  const rel = relInput?.value.trim();
  let phone = phoneInput?.value.trim() || '';
  const notify = duressInput?.checked ?? true;
  const isPrimary = isPrimaryCheck ? isPrimaryCheck.checked : (state.contacts.length === 0);

  if (!name || !phone) {
    provideFeedback({
      text: 'Please enter both a contact name and phone number.',
      gesture: 'ERROR'
    });
    return;
  }

  // Ensure Indian +91 format if entered as 10 digits
  if (/^\d{10}$/.test(phone)) {
    phone = `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
  }

  const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

  const newContact = {
    id: `cnt_${Date.now()}`,
    name: name,
    relationship: rel || 'Emergency Guardian',
    phone: phone,
    isPrimary: isPrimary,
    notifyOnDuress: notify,
    verificationStatus: 'pending', // Starts in pending OTP verification
    notificationStatus: 'pending',
    otpCode: generatedOtp
  };

  if (isPrimary) {
    state.contacts.forEach(c => c.isPrimary = false);
  }

  state.contacts.push(newContact);
  renderContactsList();
  closeModal('modal-add-contact');

  // Reset inputs
  if (nameInput) nameInput.value = '';
  if (relInput) relInput.value = '';
  if (phoneInput) phoneInput.value = '';

  provideFeedback({
    text: `Contact ${name} added. A demonstration verification OTP ${generatedOtp} has been generated. Tap Verify OTP to complete registration.`,
    gesture: 'SUCCESS',
    priority: true
  });

  // Prompt OTP verification immediately
  setTimeout(() => {
    openOtpVerificationModal(newContact.id);
  }, 1200);
}

/**
 * Open OTP Verification Modal
 */
export function openOtpVerificationModal(contactId) {
  activeVerificationContactId = contactId;
  const target = state.contacts.find(c => c.id === contactId);
  if (!target) return;

  const hintEl = document.getElementById('otp-guardian-hint');
  if (hintEl) {
    hintEl.textContent = `Enter simulated OTP sent to ${target.phone} (Demo Code: ${target.otpCode || '4829'}).`;
  }

  openModal('modal-verify-otp');
  provideFeedback({
    text: `Verification OTP required for ${target.name}. Demo code is ${target.otpCode || '4829'}.`,
    priority: true
  });
}

/**
 * Verify OTP entered by user
 */
function handleVerifyContactOtp() {
  const input = document.getElementById('input-verify-otp');
  const code = input ? input.value.trim() : '';

  const target = state.contacts.find(c => c.id === activeVerificationContactId);
  if (!target) {
    closeModal('modal-verify-otp');
    return;
  }

  if (code === target.otpCode || code === '4829' || code === '1234') {
    target.verificationStatus = 'verified';
    target.notificationStatus = 'delivered';
    renderContactsList();
    closeModal('modal-verify-otp');

    provideFeedback({
      text: `OTP verified! Guardian ${target.name} is now verified and active for emergency dispatch.`,
      gesture: 'SUCCESS',
      hapticPattern: [100, 50, 100],
      priority: true
    });
  } else {
    provideFeedback({
      text: 'Incorrect OTP entered. Please check the code and try again.',
      gesture: 'ERROR',
      hapticPattern: [50, 50, 50]
    });
  }
}

/**
 * Set a contact as Primary
 */
function setPrimaryContact(id) {
  state.contacts.forEach(c => {
    c.isPrimary = (c.id === id);
  });
  renderContactsList();

  const target = state.contacts.find(c => c.id === id);
  provideFeedback({
    text: `${target ? target.name : 'Contact'} designated as Primary Guardian.`,
    hapticPattern: 50
  });
}

/**
 * Delete a Contact
 */
function deleteContact(id) {
  const target = state.contacts.find(c => c.id === id);
  state.contacts = state.contacts.filter(c => c.id !== id);
  // Ensure there is at least one primary if contacts remain
  if (state.contacts.length > 0 && !state.contacts.some(c => c.isPrimary)) {
    state.contacts[0].isPrimary = true;
  }
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


/**
 * PALMLOCK — Trusted Emergency Contacts
 * MongoDB-backed guardian management.
 *
 * Features:
 * - Load contacts from MongoDB
 * - Add primary and secondary guardians
 * - Simulated six-digit OTP verification
 * - Resend simulated OTP
 * - Set primary guardian
 * - Enable or disable duress notifications
 * - Delete guardians
 * - Synchronize guardian onboarding status
 *
 * IMPORTANT:
 * OTP delivery and emergency notifications are simulated.
 * No real SMS is sent.
 */

import { state } from './state.js';

import {
  provideFeedback
} from './accessibility.js';

import {
  openModal,
  closeModal
} from './navigation.js';

/* ============================================================
   CONFIGURATION
============================================================ */

const API_BASE =
  window.location.port === '5000'
    ? '/api'
    : window.location.protocol.startsWith('http')
      ? `${window.location.protocol}//${window.location.hostname}:5000/api`
      : '/api';

const REQUEST_TIMEOUT_MS = 12000;
const MAX_CONTACTS = 5;

let activeVerificationContactId = null;
let contactBusy = false;
let otpBusy = false;
let mutationBusy = false;
let initialized = false;

/* ============================================================
   COMMON HELPERS
============================================================ */

function el(id) {
  return document.getElementById(id);
}

function feedback(text, success = false) {
  provideFeedback({
    text,
    gesture: success ? 'SUCCESS' : 'ERROR',
    priority: true
  });
}

function token() {
  try {
    return (
      sessionStorage.getItem('palmlock_token') ||
      localStorage.getItem('palmlock_token') ||
      state.authToken ||
      null
    );
  } catch (_) {
    return state.authToken || null;
  }
}

function emitContactsUpdated() {
  // This event is emitted after successful contact
  // mutations and refreshes, not from loadContacts().
  //
  // app.js can safely listen for it and perform
  // its own verification refresh.

  document.dispatchEvent(
    new CustomEvent('palmlock:contacts-updated')
  );
}

function setButtonBusy(button, busy, label) {
  if (!button) return;

  if (busy) {
    if (!button.dataset.originalText) {
      button.dataset.originalText =
        button.textContent;
    }

    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent =
        button.dataset.originalText;

      delete button.dataset.originalText;
    }
  }
}

function normalizePhone(value) {
  const digits =
    String(value || '').replace(/\D/g, '');

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  throw new Error(
    'Enter a valid 10-digit Indian mobile number.'
  );
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
}

function normalizeContact(contact) {
  if (!contact || typeof contact !== 'object') {
    throw new Error('Invalid guardian record.');
  }

  const id = contact.id || contact._id;

  if (!id) {
    throw new Error(
      'Guardian record is missing an identifier.'
    );
  }

  return {
    ...contact,
    id: String(id),

    isPrimary:
      contact.isPrimary === true,

    notifyOnDuress:
      contact.notifyOnDuress === true,

    verificationStatus:
      contact.verificationStatus === 'verified'
        ? 'verified'
        : 'pending'
  };
}

function updateContacts(contacts) {
  if (!Array.isArray(contacts)) {
    throw new Error(
      'Invalid trusted contacts response.'
    );
  }

  state.contacts =
    contacts.map(normalizeContact);

  renderContactsList();
}

function getContact(contactId) {
  return Array.isArray(state.contacts)
    ? state.contacts.find(
        item => item.id === String(contactId)
      )
    : null;
}

/* ============================================================
   API REQUESTS
============================================================ */

async function request(
  path,
  method = 'GET',
  body
) {
  const authToken = token();

  if (!authToken) {
    throw new Error(
      'Please sign in to manage contacts.'
    );
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${API_BASE}${path}`,
      {
        method,

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },

        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body)
            }),

        signal: controller.signal
      }
    );

    let data;

    try {
      data = await response.json();
    } catch (_) {
      throw new Error(
        'Invalid response from contact server.'
      );
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      const error = new Error(
        data.error ||
        data.message ||
        'Contact request failed.'
      );

      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Contact request timed out. Please retry.'
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        'Cannot connect to contact server.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   INITIALIZATION
============================================================ */

export function initContacts() {
  if (initialized) return;

  initialized = true;

  if (!Array.isArray(state.contacts)) {
    state.contacts = [];
  }

  /* ---------------- ADD CONTACT MODAL ---------------- */

  el('btn-add-contact-trigger')
    ?.addEventListener('click', () => {
      if (!token()) {
        feedback(
          'Please sign in before adding a guardian.'
        );
        return;
      }

      if (state.contacts.length >= MAX_CONTACTS) {
        feedback(
          `Maximum ${MAX_CONTACTS} trusted contacts allowed.`
        );
        return;
      }

      const primaryCheckbox =
        el('contact-is-primary');

      const notifyCheckbox =
        el('contact-duress-notify');

      // The first guardian must be primary.
      if (primaryCheckbox) {
        primaryCheckbox.checked =
          state.contacts.length === 0;
      }

      // Emergency notifications default to enabled.
      if (notifyCheckbox) {
        notifyCheckbox.checked = true;
      }

      openModal('modal-add-contact');
    });

  el('btn-cancel-add-contact')
    ?.addEventListener('click', () => {
      if (contactBusy) return;

      closeModal('modal-add-contact');
    });

  el('form-new-contact')
    ?.addEventListener(
      'submit',
      async event => {
        event.preventDefault();
        await handleAddNewContact();
      }
    );

  /* ---------------- OTP MODAL ---------------- */

  el('form-verify-otp')
    ?.addEventListener(
      'submit',
      async event => {
        event.preventDefault();
        await handleVerifyContactOtp();
      }
    );

  el('btn-cancel-verify-otp')
    ?.addEventListener('click', () => {
      if (otpBusy) return;

      closeModal('modal-verify-otp');

      activeVerificationContactId = null;
    });

  /* ---------------- INITIAL DISPLAY ---------------- */

  renderContactsList();
}

/* ============================================================
   LOAD CONTACTS FROM MONGODB
============================================================ */

export async function loadContacts() {
  if (!token()) {
    updateContacts([]);
    return [];
  }

  try {
    const data =
      await request('/contacts');

    if (!Array.isArray(data.contacts)) {
      throw new Error(
        'Invalid contacts response.'
      );
    }

    updateContacts(data.contacts);

    // IMPORTANT:
    // Do not emit palmlock:contacts-updated here.
    // app.js uses that event to trigger another load.
    // Emitting here would cause an infinite loop.

    return state.contacts;
  } catch (error) {
    console.warn(
      '[PALMLOCK CONTACTS] Load failed:',
      error.message
    );

    throw error;
  }
}

/* ============================================================
   CONTACT CARD RENDERING
============================================================ */

export function renderContactsList() {
  const container =
    el('contacts-list-container');

  if (!container) return;

  container.innerHTML = '';

  if (
    !Array.isArray(state.contacts) ||
    state.contacts.length === 0
  ) {
    const empty =
      document.createElement('div');

    empty.className = 'card';
    empty.style.textAlign = 'center';

    empty.textContent =
      'No trusted contacts registered. ' +
      'Add and verify a primary guardian ' +
      'to complete your emergency setup.';

    container.appendChild(empty);
    return;
  }

  state.contacts.forEach(
    (contact, index) => {
      const verified =
        contact.verificationStatus === 'verified';

      const primary =
        contact.isPrimary === true;

      const notificationsEnabled =
        contact.notifyOnDuress === true;

      const card =
        document.createElement('article');

      card.className =
        'contact-item-card';

      card.setAttribute(
        'role',
        'listitem'
      );

      card.setAttribute(
        'aria-label',
        `Guardian ${index + 1}: ` +
        `${contact.name}, ` +
        `${contact.relationship || 'Guardian'}, ` +
        `${contact.phone}. ` +
        `${primary ? 'Primary' : 'Secondary'}. ` +
        `${verified ? 'Verified' : 'Verification pending'}. ` +
        `Emergency notifications ` +
        `${notificationsEnabled ? 'enabled' : 'disabled'}.`
      );

      const name =
        escapeHTML(contact.name);

      const phone =
        escapeHTML(contact.phone);

      const relationship =
        escapeHTML(
          contact.relationship || 'Guardian'
        );

      card.innerHTML = `
        <div class="contact-info"
             style="flex:1;min-width:0">

          <div style="
            display:flex;
            align-items:center;
            gap:8px;
            flex-wrap:wrap
          ">
            <div class="contact-name">
              ${name}
            </div>

            <span class="contact-tag">
              ${primary ? 'PRIMARY' : 'SECONDARY'}
            </span>
          </div>

          <div class="contact-phone"
               style="
                 font-family:var(--font-family-mono);
                 margin-top:4px;
                 overflow-wrap:anywhere
               ">
            ${phone}
          </div>

          <div style="
            font-size:.8rem;
            color:var(--text-secondary);
            margin-top:2px
          ">
            ${relationship}
          </div>

          <div style="
            margin-top:8px;
            display:flex;
            gap:6px;
            flex-wrap:wrap
          ">
            <span class="history-badge ${verified ? 'success' : 'pending'}">
              ${verified ? 'Verified Guardian' : 'Verification Pending'}
            </span>

            ${
              notificationsEnabled
                ? '<span class="history-badge duress">Duress Alert ON</span>'
                : '<span class="contact-tag">Duress Alert OFF</span>'
            }
          </div>

          ${
            primary &&
            verified &&
            notificationsEnabled
              ? `
                <p style="
                  margin-top:8px;
                  font-size:.8rem;
                  color:var(--text-secondary)
                ">
                  Guardian setup requirements met
                </p>
              `
              : ''
          }
        </div>

        <div style="
          display:flex;
          flex-direction:column;
          gap:8px;
          align-items:flex-end
        ">

          ${
            !verified
              ? `
                <button
                  type="button"
                  class="btn btn-secondary btn-verify-contact"
                >
                  Verify OTP
                </button>
              `
              : ''
          }

          <button
            type="button"
            class="btn btn-secondary btn-toggle-notifications"
            aria-label="${
              notificationsEnabled
                ? `Disable emergency notifications for ${name}`
                : `Enable emergency notifications for ${name}`
            }"
            aria-pressed="${notificationsEnabled}"
            style="font-size:.78rem"
          >
            ${
              notificationsEnabled
                ? 'Alerts: ON'
                : 'Alerts: OFF'
            }
          </button>

          <div style="
            display:flex;
            gap:6px
          ">
            <button
              type="button"
              class="btn-icon-access btn-toggle-primary"
              aria-label="${
                primary
                  ? `${name} is the primary guardian`
                  : `Make ${name} primary guardian`
              }"
              title="${
                primary
                  ? 'Current Primary'
                  : 'Make Primary'
              }"
              ${primary ? 'disabled' : ''}
            >
              ★
            </button>

            <button
              type="button"
              class="btn-icon-access btn-delete-contact"
              aria-label="Delete ${name}"
              title="Delete Contact"
            >
              ✕
            </button>
          </div>
        </div>
      `;

      /* ---------------- VERIFY OTP ---------------- */

      card.querySelector(
        '.btn-verify-contact'
      )?.addEventListener(
        'click',
        () => {
          openOtpVerificationModal(
            contact.id
          );
        }
      );

      /* ---------------- SET PRIMARY ---------------- */

      card.querySelector(
        '.btn-toggle-primary'
      )?.addEventListener(
        'click',
        async () => {
          await setPrimaryContact(
            contact.id
          );
        }
      );

      /* ---------------- TOGGLE NOTIFICATIONS ---------------- */

      card.querySelector(
        '.btn-toggle-notifications'
      )?.addEventListener(
        'click',
        async () => {
          await toggleContactNotifications(
            contact.id
          );
        }
      );

      /* ---------------- DELETE CONTACT ---------------- */

      card.querySelector(
        '.btn-delete-contact'
      )?.addEventListener(
        'click',
        async () => {
          await deleteContact(
            contact.id
          );
        }
      );

      container.appendChild(card);
    }
  );
}

/* ============================================================
   ADD NEW CONTACT
============================================================ */

async function handleAddNewContact() {
  if (contactBusy) return;

  const form =
    el('form-new-contact');

  const submitButton =
    form?.querySelector(
      'button[type="submit"]'
    );

  try {
    if (!token()) {
      throw new Error(
        'Please sign in before adding a guardian.'
      );
    }

    const name =
      el('contact-name-input')?.value.trim();

    const relationship =
      el('contact-relationship-input')?.value.trim() ||
      'Guardian';

    const phone =
      normalizePhone(
        el('contact-phone-input')?.value
      );

    if (!name) {
      throw new Error(
        'Contact name is required.'
      );
    }

    if (
      state.contacts.length >= MAX_CONTACTS
    ) {
      throw new Error(
        `Maximum ${MAX_CONTACTS} trusted contacts allowed.`
      );
    }

    const isFirstContact =
      state.contacts.length === 0;

    const isPrimary =
      isFirstContact ||
      (
        el('contact-is-primary')?.checked ??
        false
      );

    const notifyOnDuress =
      el('contact-duress-notify')?.checked ??
      true;

    contactBusy = true;

    setButtonBusy(
      submitButton,
      true,
      'Saving contact...'
    );

    const data =
      await request(
        '/contacts',
        'POST',
        {
          name,
          phone,
          relationship,
          isPrimary,
          notifyOnDuress
        }
      );

    const newContactId =
      data.contact?.id ||
      data.contact?._id ||
      null;

    // Fetch the authoritative MongoDB records.
    await loadContacts();

    // Notify app.js that guardian data changed.
    emitContactsUpdated();

    closeModal('modal-add-contact');

    form?.reset();

    feedback(
      `Contact ${name} saved successfully. ` +
      'A simulated six-digit OTP was generated. ' +
      'Check your backend terminal for the code.',
      true
    );

    if (newContactId) {
      openOtpVerificationModal(
        String(newContactId)
      );
    }
  } catch (error) {
    console.error(
      '[PALMLOCK CONTACTS] Add failed:',
      error
    );

    feedback(error.message);
  } finally {
    contactBusy = false;

    setButtonBusy(
      submitButton,
      false
    );
  }
}

/* ============================================================
   OPEN OTP VERIFICATION MODAL
============================================================ */

export function openOtpVerificationModal(
  contactId
) {
  const contact =
    getContact(contactId);

  if (!contact) {
    feedback(
      'Contact not found. Refresh the contact list.'
    );
    return;
  }

  if (
    contact.verificationStatus === 'verified'
  ) {
    feedback(
      'This contact is already verified.',
      true
    );
    return;
  }

  activeVerificationContactId =
    contact.id;

  const input =
    el('input-verify-otp');

  if (input) {
    input.value = '';

    input.setAttribute(
      'maxlength',
      '6'
    );

    input.setAttribute(
      'minlength',
      '6'
    );

    input.setAttribute(
      'inputmode',
      'numeric'
    );

    input.setAttribute(
      'autocomplete',
      'one-time-code'
    );

    input.setAttribute(
      'pattern',
      '[0-9]{6}'
    );

    input.setAttribute(
      'placeholder',
      '000000'
    );
  }

  const hint =
    el('otp-guardian-hint');

  if (hint) {
    hint.textContent =
      `Enter the six-digit development OTP for ` +
      `${contact.name} (${contact.phone}). ` +
      'No real SMS is sent. ' +
      'Find the generated OTP in your backend terminal.';
  }

  openModal('modal-verify-otp');

  feedback(
    `Enter the six-digit simulated OTP for ${contact.name}.`,
    true
  );

  input?.focus();
}

/* ============================================================
   VERIFY CONTACT OTP
============================================================ */

async function handleVerifyContactOtp() {
  if (otpBusy) return;

  const contactId =
    activeVerificationContactId;

  const otp =
    el('input-verify-otp')?.value.trim() ||
    '';

  if (!contactId) {
    feedback(
      'Select a contact to verify.'
    );
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    feedback(
      'Enter a valid six-digit OTP.'
    );
    return;
  }

  const form =
    el('form-verify-otp');

  const submitButton =
    form?.querySelector(
      'button[type="submit"]'
    );

  otpBusy = true;

  setButtonBusy(
    submitButton,
    true,
    'Verifying...'
  );

  try {
    const data =
      await request(
        '/contacts/verify',
        'POST',
        {
          contactId,
          otp
        }
      );

    if (
      data.contact?.verificationStatus !==
      'verified'
    ) {
      throw new Error(
        'Server did not confirm contact verification.'
      );
    }

    const contactName =
      data.contact.name ||
      'Guardian';

    // Load the verified state from MongoDB.
    await loadContacts();

    const verifiedContact =
      getContact(contactId);

    if (
      !verifiedContact ||
      verifiedContact.verificationStatus !==
      'verified'
    ) {
      throw new Error(
        'Guardian verification could not be confirmed after refresh.'
      );
    }

    closeModal('modal-verify-otp');

    activeVerificationContactId = null;

    const input =
      el('input-verify-otp');

    if (input) {
      input.value = '';
    }

    // Refresh the dashboard onboarding state.
    emitContactsUpdated();

    feedback(
      `${contactName} verified successfully in MongoDB. ` +
      'Emergency notifications remain simulated.',
      true
    );
  } catch (error) {
    console.error(
      '[PALMLOCK CONTACTS] OTP verification failed:',
      error
    );

    feedback(error.message);
  } finally {
    otpBusy = false;

    setButtonBusy(
      submitButton,
      false
    );
  }
}

/* ============================================================
   RESEND SIMULATED OTP
============================================================ */

export async function resendContactOtp(
  contactId
) {
  const contact =
    getContact(contactId);

  if (!contact) {
    feedback(
      'Contact not found.'
    );
    return false;
  }

  if (
    contact.verificationStatus === 'verified'
  ) {
    feedback(
      'This guardian is already verified.',
      true
    );
    return false;
  }

  try {
    await request(
      `/contacts/${encodeURIComponent(contactId)}/resend-otp`,
      'POST',
      {}
    );

    feedback(
      'A new simulated six-digit OTP was generated. ' +
      'Check the backend terminal. No SMS was sent.',
      true
    );

    return true;
  } catch (error) {
    feedback(error.message);
    return false;
  }
}

/* ============================================================
   SET PRIMARY GUARDIAN
============================================================ */

async function setPrimaryContact(
  contactId
) {
  if (mutationBusy) return;

  const contact =
    getContact(contactId);

  if (!contact) {
    feedback(
      'Guardian not found.'
    );
    return;
  }

  if (contact.isPrimary) {
    feedback(
      `${contact.name} is already the primary guardian.`,
      true
    );
    return;
  }

  mutationBusy = true;

  try {
    await request(
      `/contacts/${encodeURIComponent(contactId)}`,
      'PATCH',
      {
        isPrimary: true
      }
    );

    await loadContacts();

    const updated =
      getContact(contactId);

    if (!updated?.isPrimary) {
      throw new Error(
        'Primary guardian change was not confirmed by the server.'
      );
    }

    emitContactsUpdated();

    feedback(
      `${contact.name} is now your primary guardian.`,
      true
    );
  } catch (error) {
    console.error(
      '[PALMLOCK CONTACTS] Primary update failed:',
      error
    );

    feedback(error.message);
  } finally {
    mutationBusy = false;
  }
}

/* ============================================================
   TOGGLE EMERGENCY NOTIFICATIONS
============================================================ */

async function toggleContactNotifications(
  contactId
) {
  if (mutationBusy) return;

  const contact =
    getContact(contactId);

  if (!contact) {
    feedback(
      'Guardian not found.'
    );
    return;
  }

  const newValue =
    !contact.notifyOnDuress;

  mutationBusy = true;

  try {
    await request(
      `/contacts/${encodeURIComponent(contactId)}`,
      'PATCH',
      {
        notifyOnDuress: newValue
      }
    );

    await loadContacts();

    const updated =
      getContact(contactId);

    if (
      !updated ||
      updated.notifyOnDuress !== newValue
    ) {
      throw new Error(
        'Emergency notification setting was not confirmed by the server.'
      );
    }

    emitContactsUpdated();

    feedback(
      `Emergency notifications for ${contact.name} ` +
      `${newValue ? 'enabled' : 'disabled'}.`,
      true
    );
  } catch (error) {
    console.error(
      '[PALMLOCK CONTACTS] Notification update failed:',
      error
    );

    feedback(error.message);
  } finally {
    mutationBusy = false;
  }
}

/* ============================================================
   DELETE GUARDIAN
============================================================ */

async function deleteContact(
  contactId
) {
  if (mutationBusy) return;

  const contact =
    getContact(contactId);

  if (!contact) {
    feedback(
      'Guardian not found.'
    );
    return;
  }

  const confirmed =
    window.confirm(
      `Remove ${contact.name} from trusted contacts?`
    );

  if (!confirmed) return;

  mutationBusy = true;

  try {
    await request(
      `/contacts/${encodeURIComponent(contactId)}`,
      'DELETE'
    );

    await loadContacts();

    if (getContact(contactId)) {
      throw new Error(
        'Guardian deletion was not confirmed by the server.'
      );
    }

    emitContactsUpdated();

    feedback(
      `${contact.name} removed from the server.`,
      true
    );

    if (
      state.contacts.length > 0 &&
      !state.contacts.some(
        item => item.isPrimary
      )
    ) {
      feedback(
        'Please designate another primary guardian.'
      );
    }

    if (
      state.contacts.length === 0
    ) {
      feedback(
        'No trusted guardians remain. ' +
        'Add and verify a primary guardian.'
      );
    }
  } catch (error) {
    console.error(
      '[PALMLOCK CONTACTS] Delete failed:',
      error
    );

    feedback(error.message);
  } finally {
    mutationBusy = false;
  }
}

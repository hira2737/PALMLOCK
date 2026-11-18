
/**
 * PALMLOCK — Touch Beyond Vision
 * Main Application Controller
 *
 * Backend authentication, guardian onboarding,
 * gesture PIN, simulated payments, real GPS,
 * offline SOS and accessibility.
 *
 * IMPORTANT:
 * Payments and guardian notifications are simulated.
 * PALMLOCK is not an emergency dispatch service.
 */

import { state } from './state.js';

import {
  provideFeedback,
  stopSpeech,
  setTheme,
  cycleTheme,
  setFontSize,
  cycleFontSize
} from './accessibility.js';

import {
  navigateTo,
  navigateBack,
  openModal,
  closeModal
} from './navigation.js';

import {
  GestureRecognizer,
  handlePinGesture,
  undoPinGesture,
  clearPinGestures,
  setPinCompleteCallback,
  setupShakeToClear,
  GESTURE_TO_DIGIT
} from './gestures.js';

import {
  startCamera,
  stopCamera,
  toggleTorch,
  simulateScannedQR,
  onQRCodeLocked
} from './scanner.js';

import {
  readPaymentDetails,
  verifyEnteredPin,
  renderHistoryList,
  renderDashboardRecentTransactions,
  updateVerificationScreen,
  playTactileCurrencyPattern,
  stopTactileCurrencyPattern,
  repeatTactileCurrencyPattern
} from './payments.js';

import {
  initContacts,
  loadContacts
} from './contacts.js';

import { initTutorial } from './tutorial.js';

import {
  initOfflineQueue,
  retryPendingSync
} from './offline-queue.js';

import {
  captureEmergencyLocation
} from './location.js';

import {
  apiReportEmergency,
  apiReportFalseAlarm,
  apiSetupPin
} from './api.js';

/* ============================================================
   CONFIGURATION
============================================================ */

const API_BASE = (() => {
  const configured = window.PALMLOCK_API_BASE_URL;

  if (
    typeof configured === 'string' &&
    configured.trim()
  ) {
    return configured.replace(/\/+$/, '');
  }

  if (window.location.port === '5000') {
    return '/api';
  }

  if (
    window.location.protocol === 'http:' ||
    window.location.protocol === 'https:'
  ) {
    return (
      `${window.location.protocol}//` +
      `${window.location.hostname}:5000/api`
    );
  }

  return 'http://localhost:5000/api';
})();

const AUTH_TIMEOUT_MS = 12000;

let authBusy = false;
let pinSetupBusy = false;
let guardianContinueBusy = false;
let sosBusy = false;
let falseAlarmBusy = false;
let lastSosIncidentId = null;
let onboardingRequired = false;
let contactsReady = false;
let initialized = false;

/* ============================================================
   COMMON HELPERS
============================================================ */

function getField(id) {
  return document.getElementById(id);
}

function getValue(id) {
  return getField(id)?.value?.trim() || '';
}

function showFieldError(id, message = '') {
  const element = getField(id);

  if (element) {
    element.textContent = message;
  }
}

function announceError(message) {
  provideFeedback({
    text: message,
    gesture: 'ERROR',
    hapticPattern: [150, 100, 150],
    priority: true
  });
}

function announceSuccess(message) {
  provideFeedback({
    text: message,
    gesture: 'SUCCESS',
    hapticPattern: [100, 70, 100],
    priority: true
  });
}

function getStoredToken() {
  if (
    typeof state.authToken === 'string' &&
    state.authToken.trim()
  ) {
    return state.authToken;
  }

  try {
    return (
      sessionStorage.getItem('palmlock_token') ||
      localStorage.getItem('palmlock_token') ||
      localStorage.getItem('authToken') ||
      null
    );
  } catch (_) {
    return null;
  }
}

function saveSession(token, user) {
  if (
    typeof token !== 'string' ||
    !token.trim()
  ) {
    throw new Error(
      'Authentication server did not return a valid token.'
    );
  }

  try {
    sessionStorage.setItem(
      'palmlock_token',
      token
    );

    localStorage.removeItem('palmlock_token');
    localStorage.removeItem('authToken');
  } catch (_) {
    // In-memory authentication remains available.
  }

  state.authToken = token;

  if (
    !state.auth ||
    typeof state.auth !== 'object'
  ) {
    state.auth = {};
  }

  state.auth.token = token;

  state.user = {
    ...user,
    id: user.id || user._id
  };

  // Never carry guardians from a previous account.
  state.contacts = [];
  contactsReady = false;

  updateGuardianOnboardingUI();
}

function clearSession() {
  state.authToken = null;
  state.user = null;
  state.contacts = [];
  state.currentTransaction = null;
  state.enteredPin = [];

  if (state.auth) {
    state.auth.token = null;
  }

  onboardingRequired = false;
  contactsReady = false;
  guardianContinueBusy = false;
  lastSosIncidentId = null;

  try {
    sessionStorage.removeItem('palmlock_token');
    localStorage.removeItem('palmlock_token');
    localStorage.removeItem('authToken');
  } catch (_) {}

  const container = getField(
    'contacts-list-container'
  );

  if (container) {
    container.textContent =
      'Sign in to view your trusted contacts.';
  }

  updateGuardianOnboardingUI();
}

function extractSession(data) {
  const payload = data?.data || data || {};

  return {
    token:
      payload.token ||
      payload.accessToken ||
      payload.authToken ||
      data?.token ||
      null,

    user:
      payload.user ||
      data?.user ||
      null,

    onboardingRequired:
      payload.onboardingRequired ??
      data?.onboardingRequired ??
      false
  };
}

function setBusy(button, busy, label) {
  if (!button) return;

  if (busy) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel =
        button.innerHTML;
    }

    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;

    if (button.dataset.originalLabel) {
      button.innerHTML =
        button.dataset.originalLabel;

      delete button.dataset.originalLabel;
    }
  }
}

/* ============================================================
   AUTHENTICATION REQUESTS
============================================================ */

async function authRequest(endpoint, payload) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    AUTH_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${API_BASE}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    const raw = await response.text();

    let data;

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {
        ok: false,
        status: response.status,
        data: {
          success: false,
          error:
            'Authentication server returned invalid JSON.'
        }
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        error:
          error.name === 'AbortError'
            ? 'Authentication request timed out.'
            : 'Unable to connect to the authentication server.'
      }
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   TRUSTED CONTACTS
============================================================ */

function hasVerifiedPrimaryGuardian() {
  return (
    contactsReady &&
    Array.isArray(state.contacts) &&
    state.contacts.some(contact =>
      contact.isPrimary === true &&
      contact.verificationStatus === 'verified' &&
      contact.notifyOnDuress === true
    )
  );
}

function updateGuardianOnboardingUI() {
  const button = getField(
    'btn-continue-dashboard'
  );

  const status = getField(
    'guardian-onboarding-status'
  );

  if (!button || !status) return;

  button.disabled = true;

  if (guardianContinueBusy) {
    button.textContent = 'Verifying Guardian...';

    status.textContent =
      'Confirming guardian status with the server.';

    return;
  }

  if (!getStoredToken()) {
    button.textContent = 'Sign In to Continue';

    status.textContent =
      'Please sign in to complete guardian setup.';

    return;
  }

  if (onboardingRequired) {
    button.textContent =
      'Complete Security PIN Setup';

    status.textContent =
      'Complete security PIN setup before continuing.';

    return;
  }

  if (!contactsReady) {
    button.textContent =
      'Checking Guardian Verification...';

    status.textContent =
      'Guardian verification has not been confirmed.';

    return;
  }

  if (!hasVerifiedPrimaryGuardian()) {
    button.textContent =
      'Verify Primary Guardian to Continue';

    status.textContent =
      'A verified primary guardian with emergency ' +
      'notifications enabled is required.';

    return;
  }

  button.disabled = false;
  button.textContent = 'Continue to Dashboard';

  status.textContent =
    'Primary guardian verified. ' +
    'You can continue to your dashboard.';
}

async function refreshTrustedContacts({
  silent = false
} = {}) {
  if (!getStoredToken()) {
    state.contacts = [];
    contactsReady = false;

    updateGuardianOnboardingUI();
    return false;
  }

  contactsReady = false;
  updateGuardianOnboardingUI();

  try {
    const result = await loadContacts();

    const contacts =
      Array.isArray(result)
        ? result
        : Array.isArray(result?.contacts)
          ? result.contacts
          : Array.isArray(result?.data?.contacts)
            ? result.data.contacts
            : Array.isArray(state.contacts)
              ? state.contacts
              : null;

    if (!Array.isArray(contacts)) {
      throw new Error(
        'Invalid trusted contacts response.'
      );
    }

    state.contacts = contacts;
    contactsReady = true;

    updateGuardianOnboardingUI();

    return true;
  } catch (error) {
    state.contacts = [];
    contactsReady = false;

    updateGuardianOnboardingUI();

    console.warn(
      '[PALMLOCK CONTACTS]',
      error
    );

    if (!silent) {
      announceError(
        'Unable to load trusted contacts. Please retry.'
      );
    }

    return false;
  }
}

async function openContactsScreen() {
  if (!getStoredToken()) {
    announceError(
      'Please sign in to manage guardians.'
    );

    navigateTo('screen-welcome');
    return;
  }

  navigateTo('screen-contacts');

  await refreshTrustedContacts({
    silent: true
  });
}

function canAccessProtectedScreens() {
  if (!getStoredToken()) {
    announceError('Please sign in first.');

    navigateTo('screen-welcome');
    return false;
  }

  if (onboardingRequired) {
    announceError(
      'Complete security PIN setup first.'
    );

    openPinSetup();
    return false;
  }

  return true;
}

function navigateProtected(target) {
  if (!canAccessProtectedScreens()) {
    return;
  }

  if (target === 'screen-contacts') {
    void openContactsScreen();
    return;
  }

  if (target === 'screen-scanner') {
    navigateTo(target);

    Promise.resolve(startCamera()).catch(
      error => {
        console.warn(
          '[PALMLOCK CAMERA]',
          error
        );
      }
    );

    return;
  }

  stopCamera();
  navigateTo(target);
}

/* ============================================================
   PIN SETUP HELPERS
============================================================ */

function clearPinSetupFields() {
  [
    'setup-standard-pin',
    'setup-standard-confirm',
    'setup-duress-pin',
    'setup-duress-confirm',
    'setup-current-password'
  ].forEach(id => {
    const field = getField(id);

    if (field) {
      field.value = '';
    }
  });
}

function validatePinSetup() {
  const standardPin =
    getField('setup-standard-pin')?.value || '';

  const standardConfirm =
    getField('setup-standard-confirm')?.value || '';

  const duressPin =
    getField('setup-duress-pin')?.value || '';

  const duressConfirm =
    getField('setup-duress-confirm')?.value || '';

  if (
    !/^\d{4}$/.test(standardPin) ||
    !/^\d{4}$/.test(duressPin)
  ) {
    throw new Error(
      'Both PINs must contain exactly four digits.'
    );
  }

  if (standardPin !== standardConfirm) {
    throw new Error(
      'Normal PIN confirmation does not match.'
    );
  }

  if (duressPin !== duressConfirm) {
    throw new Error(
      'Emergency PIN confirmation does not match.'
    );
  }

  if (standardPin === duressPin) {
    throw new Error(
      'Normal and emergency PINs must be different.'
    );
  }

  return {
    standardPin,
    duressPin
  };
}

/**
 * Add a password field to the existing PIN form.
 *
 * It is optional for first-time PIN setup,
 * but required by the backend when changing PINs.
 */
function ensurePinPasswordField() {
  const form = getField('form-pin-setup');

  if (!form) return null;

  let input = getField(
    'setup-current-password'
  );

  if (input) return input;

  const wrapper = document.createElement('div');

  wrapper.id =
    'setup-current-password-wrapper';

  wrapper.className = 'form-group';

  const label = document.createElement('label');

  label.className = 'form-label';
  label.htmlFor = 'setup-current-password';

  label.textContent =
    'Current account password (required when changing existing PINs)';

  input = document.createElement('input');

  input.id = 'setup-current-password';
  input.name = 'currentPassword';
  input.className = 'form-input';
  input.type = 'password';
  input.autocomplete = 'current-password';

  input.setAttribute(
    'aria-describedby',
    'setup-current-password-help'
  );

  const help = document.createElement('p');

  help.id = 'setup-current-password-help';
  help.className = 'form-help';

  help.textContent =
    'Leave blank for first-time setup. ' +
    'Enter your login password when updating existing PINs.';

  wrapper.append(
    label,
    input,
    help
  );

  const submitButton = getField(
    'btn-submit-pin-setup'
  );

  if (submitButton) {
    submitButton.before(wrapper);
  } else {
    form.appendChild(wrapper);
  }

  return input;
}

function openPinSetup() {
  ensurePinPasswordField();
  clearPinSetupFields();

  showFieldError('pin-setup-error', '');

  navigateTo('screen-pin-setup');
}

/* ============================================================
   APPLICATION BOOTSTRAP
============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    if (initialized) return;

    initialized = true;

    ensurePinPasswordField();

    try {
      await initOfflineQueue();
    } catch (error) {
      console.error(
        '[PALMLOCK OFFLINE STORAGE]',
        error
      );

      announceError(
        'Offline emergency storage is unavailable. ' +
        'Do not rely on offline emergency delivery.'
      );
    }

    initTopAccessibilityBar();
    initDesktopPreviewBar();
    initNavigation();
    initFormInteractions();
    initGestureEngines();
    initScannerControls();
    initPaymentActions();
    initPracticeLab();
    initSettingsControls();

    initContacts();
    initTutorial();
    initGlobalKeyboardShortcuts();

    renderDashboardRecentTransactions();
    renderHistoryList('all');
    updateVerificationScreen();

    updateGuardianOnboardingUI();

    if (!getStoredToken()) {
      navigateTo(
        'screen-welcome',
        false
      );
    } else {
      navigateTo(
        'screen-contacts',
        false
      );

      const loaded =
        await refreshTrustedContacts({
          silent: true
        });

      if (!loaded) {
        provideFeedback({
          text:
            'Saved session found, but guardian verification ' +
            'could not be loaded.',
          priority: true
        });
      }
    }

    console.info(
      'PALMLOCK mobile accessibility interface initialized.'
    );
  }
);

/* ============================================================
   SOS EMERGENCY HANDLING
============================================================ */

function formatEmergencyCoordinates(location) {
  if (
    location?.isRealGPS !== true ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    return 'Location unavailable';
  }

  return (
    `${location.lat.toFixed(6)}, ` +
    `${location.lng.toFixed(6)}` +
    (
      Number.isFinite(location.accuracyMeters)
        ? ` (±${location.accuracyMeters}m)`
        : ''
    )
  );
}

function buildEmergencyLocation(location) {
  if (
    location?.isRealGPS !== true ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    return null;
  }

  return {
    lat: location.lat,
    lng: location.lng,
    accuracyMeters:
      location.accuracyMeters ?? null,
    source: 'device',
    simulated: false,
    capturedAt:
      location.capturedAt || null
  };
}

async function handleSOS() {
  if (sosBusy) return;

  if (!getStoredToken()) {
    announceError(
      'Sign in before using emergency reporting.'
    );

    return;
  }

  sosBusy = true;
  lastSosIncidentId = null;

  const button = getField('btn-trigger-sos');

  setBusy(
    button,
    true,
    'Recording SOS...'
  );

  openModal('modal-sos-alert');

  const recipientsEl =
    getField('sos-modal-recipients');

  const coordsEl =
    getField('sos-modal-coords');

  if (recipientsEl) {
    recipientsEl.textContent =
      'Saving emergency incident...';
  }

  if (coordsEl) {
    coordsEl.textContent =
      'Obtaining device location...';
  }

  try {
    let location = null;

    try {
      location =
        await captureEmergencyLocation();
    } catch (error) {
      console.warn(
        '[PALMLOCK SOS GPS]',
        error
      );
    }

    if (coordsEl) {
      coordsEl.textContent =
        formatEmergencyCoordinates(location);
    }

    const emergencyLocation =
      buildEmergencyLocation(location);

    const result =
      await apiReportEmergency({
        type: 'SOS',

        userId:
          state.user?.id ||
          state.user?._id ||
          null,

        userName:
          state.user?.name ||
          'Unknown User',

        userPhone:
          state.user?.phone ||
          '',

        location: emergencyLocation
      });

    /*
     * False alarm must use a backend incident ID,
     * not the local IndexedDB queue ID.
     */
    if (result?.backendAccepted === true) {
      lastSosIncidentId =
        result.incident?.incidentId ||
        result.incident?.backendIncidentId ||
        null;
    }

    if (result?.backendAccepted === true) {
      if (recipientsEl) {
        recipientsEl.textContent =
          'Incident accepted by PALMLOCK server. ' +
          'Guardian notification not confirmed.';
      }

      provideFeedback({
        text:
          'SOS incident recorded on the PALMLOCK server. ' +
          'Guardian notification is simulated and not confirmed.',
        hapticPattern:
          [300, 100, 300, 100, 300],
        priority: true
      });
    } else if (result?.queued === true) {
      if (recipientsEl) {
        recipientsEl.textContent =
          'SOS saved locally. Server delivery pending.';
      }

      provideFeedback({
        text:
          'SOS saved on this device. ' +
          'The server has not confirmed receiving it. ' +
          'Use another emergency contact method if help is needed.',
        hapticPattern:
          [300, 100, 300],
        priority: true
      });
    } else {
      if (recipientsEl) {
        recipientsEl.textContent =
          'Emergency recording not confirmed.';
      }

      announceError(
        'SOS could not be saved or delivered. ' +
        'Use another emergency contact method.'
      );
    }
  } catch (error) {
    console.error(
      '[PALMLOCK SOS]',
      error
    );

    if (recipientsEl) {
      recipientsEl.textContent =
        'Emergency recording failed.';
    }

    announceError(
      'Unable to record SOS. ' +
      'Use another emergency contact method.'
    );
  } finally {
    sosBusy = false;

    setBusy(
      button,
      false
    );
  }
}

async function handleFalseAlarm() {
  if (falseAlarmBusy) return;

  if (!lastSosIncidentId) {
    announceError(
      'No server-confirmed SOS incident is available ' +
      'for false-alarm reporting.'
    );

    return;
  }

  falseAlarmBusy = true;

  const button = getField(
    'btn-report-false-alarm'
  );

  setBusy(
    button,
    true,
    'Reporting...'
  );

  try {
    const result =
      await apiReportFalseAlarm(
        lastSosIncidentId,
        'User reported accidental SOS trigger.'
      );

    if (result.backendConfirmed) {
      closeModal('modal-sos-alert');

      lastSosIncidentId = null;

      announceSuccess(
        'False alarm report confirmed by the server.'
      );
    } else {
      announceError(
        'False alarm was not confirmed by the server. ' +
        'Please retry.'
      );
    }
  } catch (error) {
    console.error(
      '[PALMLOCK FALSE ALARM]',
      error
    );

    announceError(
      'Unable to confirm the false alarm.'
    );
  } finally {
    falseAlarmBusy = false;

    setBusy(
      button,
      false
    );
  }
}

/* ============================================================
   ACCESSIBILITY BAR
============================================================ */

function initTopAccessibilityBar() {
  const speechToggle = getField(
    'btn-toggle-speech'
  );

  speechToggle?.addEventListener(
    'click',
    () => {
      state.preferences.speechEnabled =
        !state.preferences.speechEnabled;

      const enabled =
        state.preferences.speechEnabled;

      speechToggle.setAttribute(
        'aria-pressed',
        String(enabled)
      );

      speechToggle.title =
        `Audio Announcements: ${enabled ? 'On' : 'Off'}`;

      if (!enabled) {
        stopSpeech();
      }

      provideFeedback({
        text:
          `Audio announcements ${enabled ? 'enabled' : 'disabled'}`,
        hapticPattern: 50
      });
    }
  );

  getField('btn-cycle-theme')
    ?.addEventListener(
      'click',
      cycleTheme
    );

  getField('btn-cycle-font')
    ?.addEventListener(
      'click',
      cycleFontSize
    );

  getField('btn-trigger-sos')
    ?.addEventListener(
      'click',
      handleSOS
    );

  getField('btn-report-false-alarm')
    ?.addEventListener(
      'click',
      handleFalseAlarm
    );

  getField('btn-close-sos-modal')
    ?.addEventListener(
      'click',
      () => {
        closeModal('modal-sos-alert');
      }
    );

  getField('brand-home-link')
    ?.addEventListener(
      'click',
      event => {
        event.preventDefault();

        navigateProtected(
          'screen-dashboard'
        );
      }
    );
}

/* ============================================================
   DESKTOP PREVIEW
============================================================ */

function initDesktopPreviewBar() {
  getField('screen-fast-nav')
    ?.addEventListener(
      'change',
      event => {
        navigateProtected(
          event.target.value
        );
      }
    );

  getField('btn-toggle-fullscreen')
    ?.addEventListener(
      'click',
      event => {
        document.body.classList.toggle(
          'fullscreen-mode'
        );

        const enabled =
          document.body.classList.contains(
            'fullscreen-mode'
          );

        event.currentTarget.textContent =
          enabled
            ? 'Mobile Frame'
            : 'Toggle Frame';

        provideFeedback({
          text: enabled
            ? 'Fullscreen mode activated.'
            : 'Phone frame mode activated.',
          hapticPattern: 40
        });
      }
    );
}

/* ============================================================
   NAVIGATION
============================================================ */

function initNavigation() {
  document.querySelectorAll(
    '.bottom-nav .nav-item'
  ).forEach(item => {
    item.addEventListener(
      'click',
      () => {
        const target =
          item.getAttribute('data-nav');

        if (target) {
          navigateProtected(target);
        }
      }
    );
  });

  document.querySelectorAll(
    '[data-back], .btn-header-back'
  ).forEach(button => {
    button.addEventListener(
      'click',
      () => {
        stopCamera();

        const target =
          button.getAttribute('data-back');

        if (target) {
          if (
            [
              'screen-welcome',
              'screen-login',
              'screen-register'
            ].includes(target)
          ) {
            navigateTo(target);
          } else {
            navigateProtected(target);
          }
        } else if (
          canAccessProtectedScreens()
        ) {
          navigateBack();
        }
      }
    );
  });

  getField('dash-btn-scan')
    ?.addEventListener(
      'click',
      () => {
        navigateProtected(
          'screen-scanner'
        );
      }
    );

  getField('dash-btn-stealth')
    ?.addEventListener(
      'click',
      () => {
        if (!canAccessProtectedScreens()) {
          return;
        }

        navigateTo('screen-stealth');

        provideFeedback({
          text:
            'Black Stealth Mode activated.',
          priority: true
        });
      }
    );

  getField('dash-btn-practice')
    ?.addEventListener(
      'click',
      () => {
        navigateProtected(
          'screen-practice'
        );
      }
    );

  getField('dash-btn-tutorial')
    ?.addEventListener(
      'click',
      () => {
        navigateProtected(
          'screen-tutorial'
        );
      }
    );

  getField('btn-see-all-history')
    ?.addEventListener(
      'click',
      () => {
        navigateProtected(
          'screen-history'
        );
      }
    );
}

/* ============================================================
   LOGIN, REGISTRATION, ONBOARDING
============================================================ */

function initFormInteractions() {
  const formLogin =
    getField('form-login');

  const formRegister =
    getField('form-register');

  const formPinSetup =
    getField('form-pin-setup');

  /* ---------------- GUARDIAN CONTINUE ---------------- */

  getField('btn-continue-dashboard')
    ?.addEventListener(
      'click',
      async () => {
        if (guardianContinueBusy) {
          return;
        }

        if (!getStoredToken()) {
          announceError(
            'Please sign in again.'
          );

          navigateTo('screen-welcome');
          return;
        }

        if (onboardingRequired) {
          openPinSetup();
          return;
        }

        guardianContinueBusy = true;

        updateGuardianOnboardingUI();

        try {
          const loaded =
            await refreshTrustedContacts({
              silent: true
            });

          if (!loaded) {
            announceError(
              'Unable to verify guardians with the server.'
            );

            return;
          }

          if (!hasVerifiedPrimaryGuardian()) {
            announceError(
              'Verify a primary guardian and enable emergency notifications.'
            );

            return;
          }

          announceSuccess(
            'Guardian verified. Opening dashboard.'
          );

          navigateTo('screen-dashboard');
        } finally {
          guardianContinueBusy = false;

          updateGuardianOnboardingUI();
        }
      }
    );

  document.addEventListener(
    'palmlock:contacts-updated',
    () => {
      void refreshTrustedContacts({
        silent: true
      });
    }
  );

  /* ---------------- DEMO LOGIN FILL ---------------- */

  getField('btn-fill-demo-login')
    ?.addEventListener(
      'click',
      () => {
        const email =
          getField('login-email');

        if (email) {
          email.value =
            state.user?.email || '';
        }

        provideFeedback({
          text:
            'Enter the password for your registered account.',
          hapticPattern: 40
        });
      }
    );

  getField('audio-btn-welcome')
    ?.addEventListener(
      'click',
      () => {
        provideFeedback({
          text:
            'Welcome to PALMLOCK. Touch Beyond Vision. ' +
            'An accessible simulated payment system ' +
            'with gesture security and emergency assistance.',
          priority: true
        });
      }
    );

  getField('btn-goto-register')
    ?.addEventListener(
      'click',
      () => {
        navigateTo(
          'screen-register'
        );
      }
    );

  /* ---------------- LOGIN ---------------- */

  formLogin?.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (authBusy) return;

      const email =
        getValue('login-email');

      const password =
        getField('login-password')?.value ||
        '';

      showFieldError(
        'login-email-error'
      );

      showFieldError(
        'login-password-error'
      );

      if (!email || !password) {
        if (!email) {
          showFieldError(
            'login-email-error',
            'Please enter your email.'
          );
        }

        if (!password) {
          showFieldError(
            'login-password-error',
            'Please enter your password.'
          );
        }

        announceError(
          'Complete all login fields.'
        );

        return;
      }

      authBusy = true;

      const submitButton =
        formLogin.querySelector(
          'button[type="submit"]'
        );

      setBusy(
        submitButton,
        true,
        'Signing in...'
      );

      let authenticated = false;

      try {
        const result =
          await authRequest(
            '/auth/login',
            {
              email,
              password
            }
          );

        if (
          !result.ok ||
          result.data?.success === false
        ) {
          throw new Error(
            result.data?.error ||
            result.data?.message ||
            'Login failed.'
          );
        }

        const session =
          extractSession(result.data);

        if (
          !session.token ||
          !session.user
        ) {
          throw new Error(
            'Server returned an incomplete session.'
          );
        }

        saveSession(
          session.token,
          session.user
        );

        authenticated = true;

        onboardingRequired =
          Boolean(
            session.onboardingRequired
          );

        getField('login-password').value = '';

        updateGuardianOnboardingUI();

        await refreshTrustedContacts({
          silent: true
        });

        if (onboardingRequired) {
          announceSuccess(
            'Signed in. Complete your PIN setup.'
          );

          openPinSetup();
          return;
        }

        if (
          !contactsReady ||
          !hasVerifiedPrimaryGuardian()
        ) {
          announceSuccess(
            'Signed in. Please verify your primary guardian.'
          );

          navigateTo('screen-contacts');
          return;
        }

        announceSuccess(
          `Welcome back, ${state.user?.name || 'User'}.`
        );

        navigateTo('screen-dashboard');

        // Retry previous emergencies only after
        // the user has authenticated.
        void retryPendingSync().catch(
          error => {
            console.warn(
              '[PALMLOCK SYNC]',
              error
            );
          }
        );
      } catch (error) {
        if (!authenticated) {
          clearSession();
        }

        showFieldError(
          'login-password-error',
          error.message
        );

        announceError(
          error.message
        );
      } finally {
        authBusy = false;

        setBusy(
          submitButton,
          false
        );
      }
    }
  );

  /* ---------------- REGISTRATION ---------------- */

  formRegister?.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (authBusy) return;

      const name =
        getValue('reg-fullname');

      const phone =
        getValue('reg-phone');

      const email =
        getValue('reg-email');

      const password =
        getField('reg-password')?.value ||
        '';

      const vision =
        getValue('reg-vision-level');

      if (
        !name ||
        !phone ||
        !email ||
        password.length < 6
      ) {
        announceError(
          'Enter your name, phone number, email ' +
          'and a password of at least six characters.'
        );

        return;
      }

      authBusy = true;

      const submitButton =
        formRegister.querySelector(
          'button[type="submit"]'
        );

      setBusy(
        submitButton,
        true,
        'Creating account...'
      );

      try {
        const result =
          await authRequest(
            '/auth/register',
            {
              name,
              phone,
              email,
              password,
              visionLevel: vision
            }
          );

        if (
          !result.ok ||
          result.data?.success === false
        ) {
          throw new Error(
            result.data?.error ||
            result.data?.message ||
            'Registration failed.'
          );
        }

        const session =
          extractSession(result.data);

        const passwordField =
          getField('reg-password');

        if (passwordField) {
          passwordField.value = '';
        }

        if (
          session.token &&
          session.user
        ) {
          saveSession(
            session.token,
            session.user
          );

          onboardingRequired = true;

          updateGuardianOnboardingUI();

          await refreshTrustedContacts({
            silent: true
          });

          navigateTo('screen-setup');

          announceSuccess(
            `Account created for ${name}. ` +
            'Configure accessibility settings.'
          );
        } else {
          clearSession();

          navigateTo('screen-welcome');

          announceSuccess(
            'Registration completed. Please sign in.'
          );
        }
      } catch (error) {
        announceError(
          error.message
        );
      } finally {
        authBusy = false;

        setBusy(
          submitButton,
          false
        );
      }
    }
  );

  /* ---------------- ACCESSIBILITY SETUP ---------------- */

  getField('btn-save-setup')
    ?.addEventListener(
      'click',
      () => {
        if (!getStoredToken()) {
          announceError(
            'Please sign in first.'
          );

          navigateTo('screen-welcome');
          return;
        }

        const audioToggle =
          getField('setup-audio-toggle');

        const hapticToggle =
          getField('setup-haptic-toggle');

        const themeSelect =
          getField('setup-theme-select');

        if (audioToggle) {
          state.preferences.speechEnabled =
            audioToggle.checked;
        }

        if (hapticToggle) {
          state.preferences.hapticEnabled =
            hapticToggle.checked;
        }

        if (themeSelect?.value) {
          setTheme(
            themeSelect.value
          );
        }

        announceSuccess(
          'Accessibility preferences applied. ' +
          'Now configure security PINs.'
        );

        openPinSetup();
      }
    );

  /* ---------------- SECURITY PIN SETUP ---------------- */

  formPinSetup?.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (pinSetupBusy) return;

      showFieldError(
        'pin-setup-error'
      );

      if (!getStoredToken()) {
        announceError(
          'Please sign in first.'
        );

        navigateTo('screen-welcome');
        return;
      }

      let pins;

      try {
        pins = validatePinSetup();
      } catch (error) {
        showFieldError(
          'pin-setup-error',
          error.message
        );

        announceError(
          error.message
        );

        return;
      }

      pinSetupBusy = true;

      const submitButton =
        getField(
          'btn-submit-pin-setup'
        );

      setBusy(
        submitButton,
        true,
        'Saving PINs...'
      );

      try {
        const passwordInput =
          ensurePinPasswordField();

        const currentPassword =
          passwordInput?.value || '';

        const result =
          await apiSetupPin({
            standardPin:
              pins.standardPin,

            duressPin:
              pins.duressPin,

            ...(currentPassword
              ? { currentPassword }
              : {})
          });

        if (
          !result.ok ||
          result.data?.success !== true
        ) {
          const message =
            result.data?.error ||
            'Unable to save security PINs.';

          if (
            result.status === 403 &&
            /current password/i.test(message)
          ) {
            passwordInput.required = true;

            passwordInput.focus();

            throw new Error(
              'These PINs already exist. ' +
              'Enter your current login password to update them.'
            );
          }

          const error =
            new Error(message);

          error.status =
            result.status;

          throw error;
        }

        onboardingRequired = false;

        clearPinSetupFields();

        if (passwordInput) {
          passwordInput.required = false;
        }

        updateGuardianOnboardingUI();

        announceSuccess(
          'Both security PINs saved successfully. ' +
          'Now verify your trusted guardians.'
        );

        navigateTo('screen-contacts');

        await refreshTrustedContacts({
          silent: true
        });
      } catch (error) {
        showFieldError(
          'pin-setup-error',
          error.message
        );

        announceError(
          error.message
        );

        if (error.status === 401) {
          clearSession();
          clearPinSetupFields();

          navigateTo('screen-welcome');
        }
      } finally {
        pinSetupBusy = false;

        setBusy(
          submitButton,
          false
        );
      }
    }
  );
}

/* ============================================================
   GESTURE PIN ENGINES
============================================================ */

function initGestureEngines() {
  const pinCanvas =
    getField('pin-gesture-canvas');

  if (pinCanvas) {
    new GestureRecognizer(
      pinCanvas,
      handlePinGesture
    );
  }

  setPinCompleteCallback(
    sequence => {
      if (!canAccessProtectedScreens()) {
        clearPinGestures();
        return;
      }

      verifyEnteredPin(sequence);
    }
  );

  getField('btn-pin-undo')
    ?.addEventListener(
      'click',
      undoPinGesture
    );

  getField('btn-pin-clear')
    ?.addEventListener(
      'click',
      clearPinGestures
    );

  document.querySelectorAll(
    '.btn-pin-digit'
  ).forEach(button => {
    button.addEventListener(
      'click',
      () => {
        if (!canAccessProtectedScreens()) {
          return;
        }

        const gesture =
          button.getAttribute(
            'data-gesture'
          );

        if (gesture) {
          handlePinGesture(gesture);
        }
      }
    );
  });

  setupShakeToClear(
    () => {
      clearPinGestures();

      provideFeedback({
        text:
          'Shake detected. PIN cleared.',
        hapticPattern: 60
      });
    }
  );

  getField('btn-switch-to-stealth')
    ?.addEventListener(
      'click',
      () => {
        if (!canAccessProtectedScreens()) {
          return;
        }

        navigateTo('screen-stealth');
      }
    );

  const stealthCanvas =
    getField('stealth-touch-canvas');

  if (stealthCanvas) {
    new GestureRecognizer(
      stealthCanvas,
      gesture => {
        if (!getStoredToken()) {
          return;
        }

        if (state.currentTransaction) {
          handlePinGesture(gesture);
        } else {
          provideFeedback({
            gesture,
            hapticPattern: 60,
            hapticLabel:
              `Stealth: ${gesture}`
          });
        }
      }
    );
  }

  getField('btn-exit-stealth')
    ?.addEventListener(
      'click',
      exitStealthMode
    );
}

function exitStealthMode() {
  clearPinGestures();

  navigateProtected(
    'screen-dashboard'
  );

  provideFeedback({
    text:
      'Stealth mode exited.',
    hapticPattern: 60
  });
}

/* ============================================================
   QR SCANNER
============================================================ */

function initScannerControls() {
  getField('btn-toggle-camera-torch')
    ?.addEventListener(
      'click',
      toggleTorch
    );

  document.querySelectorAll(
    '.btn-simulate-qr'
  ).forEach(button => {
    button.addEventListener(
      'click',
      () => {
        if (!canAccessProtectedScreens()) {
          return;
        }

        simulateScannedQR({
          merchant:
            button.getAttribute(
              'data-merchant'
            ),

          amount:
            button.getAttribute(
              'data-amount'
            ),

          fee:
            button.getAttribute(
              'data-fee'
            ),

          category:
            button.getAttribute(
              'data-category'
            )
        });
      }
    );
  });

  getField('btn-decode-manual-qr')
    ?.addEventListener(
      'click',
      () => {
        if (!canAccessProtectedScreens()) {
          return;
        }

        const raw =
          getValue('input-manual-qr');

        if (!raw) {
          announceError(
            'Enter a QR payload first.'
          );

          return;
        }

        onQRCodeLocked(raw);
      }
    );
}

/* ============================================================
   PAYMENT CONTROLS
============================================================ */

function initPaymentActions() {
  getField('btn-read-payment-details')
    ?.addEventListener(
      'click',
      readPaymentDetails
    );

  getField('btn-play-currency-vibrate')
    ?.addEventListener(
      'click',
      playTactileCurrencyPattern
    );

  getField('btn-stop-currency-vibrate')
    ?.addEventListener(
      'click',
      stopTactileCurrencyPattern
    );

  getField('btn-repeat-currency-vibrate')
    ?.addEventListener(
      'click',
      repeatTactileCurrencyPattern
    );

  getField('btn-proceed-to-pin')
    ?.addEventListener(
      'click',
      () => {
        if (!canAccessProtectedScreens()) {
          return;
        }

        clearPinGestures();

        navigateTo('screen-gesture-pin');

        provideFeedback({
          text:
            'Enter your four-gesture security PIN.',
          priority: true
        });
      }
    );

  getField('btn-cancel-payment')
    ?.addEventListener(
      'click',
      () => {
        clearPinGestures();

        state.currentTransaction = null;

        provideFeedback({
          text:
            'Transaction cancelled.',
          hapticPattern: 60
        });

        navigateProtected(
          'screen-dashboard'
        );
      }
    );

  getField('btn-result-done')
    ?.addEventListener(
      'click',
      () => {
        navigateProtected(
          'screen-dashboard'
        );
      }
    );

  getField('btn-result-retry')
    ?.addEventListener(
      'click',
      () => {
        if (!canAccessProtectedScreens()) {
          return;
        }

        clearPinGestures();

        navigateTo(
          'screen-gesture-pin'
        );
      }
    );

  getField('btn-result-cancel')
    ?.addEventListener(
      'click',
      () => {
        navigateProtected(
          'screen-dashboard'
        );
      }
    );

  getField('history-filter-select')
    ?.addEventListener(
      'change',
      event => {
        renderHistoryList(
          event.target.value
        );
      }
    );
}

/* ============================================================
   GESTURE PRACTICE LAB
============================================================ */

function initPracticeLab() {
  const canvas =
    getField('practice-gesture-canvas');

  const detectedText =
    getField('practice-detected-text');

  if (canvas) {
    new GestureRecognizer(
      canvas,
      gesture => {
        const digit =
          GESTURE_TO_DIGIT[gesture] ??
          '';

        if (detectedText) {
          detectedText.textContent =
            `Detected: ${gesture} (Digit ${digit})`;
        }

        provideFeedback({
          text:
            `${gesture}, Digit ${digit}`,
          gesture,
          hapticPattern:
            gesture === 'TAP' ||
            gesture === 'SINGLE_TAP'
              ? 40
              : 80,
          priority: true
        });
      }
    );
  }

  getField('btn-practice-reset')
    ?.addEventListener(
      'click',
      () => {
        if (detectedText) {
          detectedText.textContent =
            'Swipe or Tap Inside Box';
        }

        provideFeedback({
          text:
            'Practice log reset.'
        });
      }
    );

  getField('btn-practice-test-pin')
    ?.addEventListener(
      'click',
      () => {
        provideFeedback({
          text:
            'Practice gestures in the gesture box. ' +
            'Practice mode cannot authorize payments.',
          priority: true
        });
      }
    );
}

/* ============================================================
   SETTINGS
============================================================ */

function initSettingsControls() {
  const speechToggle =
    getField('settings-speech-toggle');

  if (speechToggle) {
    speechToggle.checked =
      state.preferences.speechEnabled;

    speechToggle.addEventListener(
      'change',
      event => {
        const enabled =
          event.target.checked;

        state.preferences.speechEnabled =
          enabled;

        getField('btn-toggle-speech')
          ?.setAttribute(
            'aria-pressed',
            String(enabled)
          );

        if (!enabled) {
          stopSpeech();
        }

        provideFeedback({
          text:
            `Speech synthesis ${enabled ? 'enabled' : 'disabled'}`
        });
      }
    );
  }

  const rateSlider =
    getField('settings-speech-rate');

  const rateLabel =
    getField('speech-rate-label');

  if (rateSlider) {
    rateSlider.value =
      String(
        state.preferences.speechRate
      );

    rateSlider.addEventListener(
      'input',
      event => {
        const value =
          Number(
            event.target.value
          );

        state.preferences.speechRate =
          value;

        if (rateLabel) {
          rateLabel.textContent =
            `${value.toFixed(1)}x`;
        }
      }
    );

    rateSlider.addEventListener(
      'change',
      event => {
        provideFeedback({
          text:
            `Speech speed set to ${event.target.value} times.`
        });
      }
    );
  }

  const vibrateToggle =
    getField('settings-vibrate-toggle');

  if (vibrateToggle) {
    vibrateToggle.checked =
      state.preferences.hapticEnabled;

    vibrateToggle.addEventListener(
      'change',
      event => {
        const enabled =
          event.target.checked;

        state.preferences.hapticEnabled =
          enabled;

        provideFeedback({
          text:
            `Tactile vibrations ${enabled ? 'enabled' : 'disabled'}`,
          hapticPattern: 60
        });
      }
    );
  }

  const themeSelect =
    getField('settings-theme-select');

  if (themeSelect) {
    themeSelect.value =
      state.preferences.theme;

    themeSelect.addEventListener(
      'change',
      event => {
        setTheme(
          event.target.value
        );
      }
    );
  }

  const fontSelect =
    getField('settings-font-select');

  if (fontSelect) {
    fontSelect.value =
      state.preferences.fontSize;

    fontSelect.addEventListener(
      'change',
      event => {
        setFontSize(
          event.target.value
        );
      }
    );
  }

  getField(
    'btn-manage-contacts-from-settings'
  )?.addEventListener(
    'click',
    () => {
      void openContactsScreen();
    }
  );
}

/* ============================================================
   GLOBAL KEYBOARD SHORTCUTS
============================================================ */

function initGlobalKeyboardShortcuts() {
  document.addEventListener(
    'keydown',
    event => {
      const target =
        event.target;

      const isTyping =
        target instanceof HTMLElement &&
        (
          target.matches(
            'input, textarea, select'
          ) ||
          target.isContentEditable
        );

      if (
        event.altKey &&
        !isTyping
      ) {
        switch (
          event.key.toLowerCase()
        ) {
          case 's':
            event.preventDefault();

            if (
              !canAccessProtectedScreens()
            ) {
              return;
            }

            if (state.isStealthActive) {
              exitStealthMode();
            } else {
              navigateTo(
                'screen-stealth'
              );
            }

            break;

          case 'q':
            event.preventDefault();

            navigateProtected(
              'screen-scanner'
            );

            break;

          case 'h':
            event.preventDefault();

            navigateProtected(
              'screen-dashboard'
            );

            break;

          case 't':
            event.preventDefault();

            cycleTheme();
            break;
        }
      } else if (
        event.key === 'Escape'
      ) {
        const activeModal =
          document.querySelector(
            '.modal-overlay.active'
          );

        if (activeModal) {
          activeModal.classList.remove(
            'active'
          );

          activeModal.setAttribute(
            'aria-hidden',
            'true'
          );
        } else if (
          state.isStealthActive
        ) {
          exitStealthMode();
        }
      }
    }
  );
}

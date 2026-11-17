
/**
 * PALMLOCK — Touch Beyond Vision
 * Main Application Bootstrap & Controller
 *
 * Backend-authenticated registration and login.
 * Security PIN onboarding.
 * MongoDB-backed trusted contact integration.
 * Accessible navigation, gestures, QR scanning,
 * simulated payments, SOS and settings.
 *
 * IMPORTANT:
 * All payments and OTP notifications are simulated.
 * Emergency reporting does not guarantee SMS delivery
 * or contact with emergency services.
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
import { initOfflineQueue } from './offline-queue.js';

import {
  captureEmergencyLocation
} from './location.js';

import {
  apiReportEmergency,
  apiReportFalseAlarm
} from './api.js';

/* ============================================================
   CONFIGURATION
============================================================ */

const API_BASE =
  window.location.port === '5000'
    ? '/api'
    : window.location.protocol.startsWith('http')
      ? `${window.location.protocol}//${window.location.hostname}:5000/api`
      : '/api';

const AUTH_TIMEOUT_MS = 12000;

let authBusy = false;
let pinSetupBusy = false;
let guardianContinueBusy = false;
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

function showFieldError(id, message) {
  const element = getField(id);

  if (element) {
    element.textContent = message || '';
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

function saveSession(token, user) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(
      'Authentication succeeded without a valid token.'
    );
  }

  try {
    sessionStorage.setItem('palmlock_token', token);
    localStorage.removeItem('palmlock_token');
  } catch (_) {
    // The current tab can still use the in-memory token.
  }

  state.authToken = token;

  if (!state.auth || typeof state.auth !== 'object') {
    state.auth = {};
  }

  state.auth.token = token;

  if (user && typeof user === 'object') {
    state.user = {
      ...user,
      id: user.id || user._id
    };
  }

  // Never retain another account's guardian data.
  state.contacts = [];
  contactsReady = false;

  updateGuardianOnboardingUI();
}

function clearSession() {
  state.authToken = null;
  state.user = null;
  state.contacts = [];
  state.currentTransaction = null;

  onboardingRequired = false;
  contactsReady = false;
  guardianContinueBusy = false;
  lastSosIncidentId = null;

  if (state.auth && typeof state.auth === 'object') {
    state.auth.token = null;
  }

  try {
    sessionStorage.removeItem('palmlock_token');
    localStorage.removeItem('palmlock_token');
    localStorage.removeItem('authToken');
  } catch (_) {
    // Storage may be unavailable.
  }

  renderContactsSafely();
  updateGuardianOnboardingUI();
}

function renderContactsSafely() {
  // Contact UI is rendered by contacts.js.
  // A successful loadContacts() refreshes that UI.

  const container = getField('contacts-list-container');

  if (container && !getStoredToken()) {
    container.textContent =
      'Sign in to view your trusted contacts.';
  }
}

function extractSession(data) {
  const payload = data?.data || data || {};

  return {
    token:
      payload.token ||
      payload.accessToken ||
      payload.authToken ||
      data?.token ||
      data?.accessToken ||
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

function setBusy(button, busy, busyLabel) {
  if (!button) return;

  if (busy) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.innerHTML;
    }

    button.disabled = true;
    button.textContent = busyLabel;
  } else {
    button.disabled = false;

    if (button.dataset.originalLabel) {
      button.innerHTML = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }
}

/* ============================================================
   BACKEND REQUESTS
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
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {
        ok: false,
        status: response.status,
        data: {
          error: 'Invalid authentication server response.'
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

async function authenticatedRequest(endpoint, payload) {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      'Your session is missing. Please sign in again.'
    );
  }

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
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    let data;

    try {
      data = await response.json();
    } catch (_) {
      throw new Error(
        'Invalid response from the security server.'
      );
    }

    if (!response.ok || data.success === false) {
      const error = new Error(
        data.error ||
        data.message ||
        'Security request failed.'
      );

      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Security request timed out. Check your connection.'
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        'Unable to connect to the security server.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   TRUSTED CONTACT INTEGRATION
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
  const button = getField('btn-continue-dashboard');
  const status = getField('guardian-onboarding-status');

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
    button.textContent = 'Complete Security PIN Setup';
    status.textContent =
      'Complete your security PIN setup before continuing.';
    return;
  }

  if (!contactsReady) {
    button.textContent = 'Checking Guardian Verification...';
    status.textContent =
      'Guardian verification has not been confirmed. ' +
      'Please check your connection.';
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
    'Your primary guardian is verified and emergency ' +
    'notifications are enabled. You can now continue.';
}

async function refreshTrustedContacts(options = {}) {
  const { silent = false } = options;

  if (!getStoredToken()) {
    contactsReady = false;
    state.contacts = [];
    updateGuardianOnboardingUI();
    return false;
  }

  contactsReady = false;
  updateGuardianOnboardingUI();

  try {
    const result = await loadContacts();

    // The expected contacts.js contract returns an array.
    // Some implementations instead update state.contacts
    // and return the API response object.
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
    contactsReady = false;
    state.contacts = [];

    updateGuardianOnboardingUI();

    console.warn(
      '[PALMLOCK CONTACTS] Load failed:',
      error.message
    );

    if (!silent) {
      announceError(
        'Unable to load trusted contacts. ' +
        'Please check your connection and retry.'
      );
    }

    return false;
  }
}

async function openContactsScreen() {
  if (!getStoredToken()) {
    announceError(
      'Please sign in to manage contacts.'
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
    announceError('Please sign in to continue.');
    navigateTo('screen-welcome');
    return false;
  }

  if (onboardingRequired) {
    announceError(
      'Complete your security PIN setup first.'
    );

    openPinSetup();
    return false;
  }

  return true;
}

function navigateProtected(target) {
  if (!canAccessProtectedScreens()) return;

  if (target === 'screen-contacts') {
    void openContactsScreen();
    return;
  }

  if (target === 'screen-scanner') {
    navigateTo(target);
    startCamera();
    return;
  }

  stopCamera();
  navigateTo(target);
}

/* ============================================================
   ONBOARDING HELPERS
============================================================ */

function clearPinSetupFields() {
  [
    'setup-standard-pin',
    'setup-standard-confirm',
    'setup-duress-pin',
    'setup-duress-confirm'
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
      'Both security PINs must contain exactly four digits.'
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

function openPinSetup() {
  clearPinSetupFields();
  showFieldError('pin-setup-error', '');
  navigateTo('screen-pin-setup');
}

/* ============================================================
   BOOTSTRAP
============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    if (initialized) return;

    initialized = true;

    initOfflineQueue();
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
      navigateTo('screen-welcome', false);
    } else {
      // Check saved-session contacts with the server.
      // A saved token alone does not prove that
      // guardian verification is still valid.

      navigateTo('screen-contacts', false);

      const loaded = await refreshTrustedContacts({
        silent: true
      });

      if (!loaded) {
        provideFeedback({
          text:
            'Your saved session could not load trusted ' +
            'contacts. Please sign in again if the ' +
            'problem continues.',
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
   ACCESSIBILITY BAR AND SOS
============================================================ */

function initTopAccessibilityBar() {
  const speechToggle = getField('btn-toggle-speech');

  speechToggle?.addEventListener('click', () => {
    state.preferences.speechEnabled =
      !state.preferences.speechEnabled;

    const enabled = state.preferences.speechEnabled;

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
  });

  getField('btn-cycle-theme')
    ?.addEventListener('click', cycleTheme);

  getField('btn-cycle-font')
    ?.addEventListener('click', cycleFontSize);

  const sosBtn = getField('btn-trigger-sos');

  sosBtn?.addEventListener('click', async () => {
    if (!getStoredToken()) {
      announceError(
        'Sign in before using PALMLOCK emergency reporting.'
      );
      return;
    }

    // The modal is opened immediately, but the backend
    // incident must still be confirmed separately.
    openModal('modal-sos-alert');

    const recipientsEl =
      getField('sos-modal-recipients');

    if (recipientsEl) {
      recipientsEl.textContent =
        'Checking configured guardians...';
    }

    let location = null;

    try {
      location = await captureEmergencyLocation();
    } catch (error) {
      console.warn(
        '[PALMLOCK SOS] Location unavailable.',
        error
      );
    }

    const coordsEl = getField('sos-modal-coords');

    if (coordsEl) {
      coordsEl.textContent =
        location?.coords
          ? typeof location.coords === 'string'
            ? location.coords
            : JSON.stringify(location.coords)
          : 'Location unavailable';
    }

    let result;

    try {
      result = await apiReportEmergency({
        type: 'SOS',
        userId: state.user?.id,
        userName: state.user?.name,
        userPhone: state.user?.phone,
        location: location?.coords || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        accuracyMeters:
          location?.accuracyMeters ?? null
      });
    } catch (error) {
      console.error('[PALMLOCK SOS]', error);

      if (recipientsEl) {
        recipientsEl.textContent =
          'Notification not confirmed';
      }

      announceError(
        'Emergency report failed. ' +
        'Please use another emergency contact method.'
      );
      return;
    }

    lastSosIncidentId =
      result?.incident?.incidentId ||
      result?.incident?.id ||
      result?.incident?._id ||
      null;

    if (recipientsEl) {
      recipientsEl.textContent =
        result?.delivered
          ? 'Server incident accepted; guardian notification unconfirmed'
          : result?.queued
            ? 'Alert queued locally; notification pending'
            : 'No guardian notification confirmed';
    }

    const message = result?.delivered
      ? 'SOS incident accepted by the PALMLOCK server. ' +
        'Guardian delivery is not yet confirmed.'
      : result?.queued
        ? 'SOS saved locally. Server delivery is pending.'
        : 'SOS could not be confirmed or saved. ' +
          'Please use another emergency contact method.';

    provideFeedback({
      text: message,
      gesture: 'ERROR',
      hapticPattern: [300, 100, 300, 100, 300],
      priority: true
    });
  });

  getField('btn-report-false-alarm')
    ?.addEventListener('click', async () => {
      if (!lastSosIncidentId) {
        announceError(
          'No confirmed SOS incident identifier is available.'
        );
        return;
      }

      try {
        const result = await apiReportFalseAlarm(
          lastSosIncidentId,
          'User reported accidental SOS trigger.'
        );

        if (result.backendConfirmed) {
          closeModal('modal-sos-alert');

          announceSuccess(
            'False alarm report confirmed by the server.'
          );
        } else {
          provideFeedback({
            text:
              'False alarm recorded locally. ' +
              'Server confirmation is pending.',
            priority: true
          });
        }
      } catch (error) {
        announceError(
          'Unable to confirm false alarm with the server.'
        );
      }
    });

  getField('btn-close-sos-modal')
    ?.addEventListener('click', () => {
      closeModal('modal-sos-alert');
    });

  getField('brand-home-link')
    ?.addEventListener('click', event => {
      event.preventDefault();
      navigateProtected('screen-dashboard');
    });
}

/* ============================================================
   DESKTOP PREVIEW
============================================================ */

function initDesktopPreviewBar() {
  getField('screen-fast-nav')
    ?.addEventListener('change', event => {
      navigateProtected(event.target.value);
    });

  getField('btn-toggle-fullscreen')
    ?.addEventListener('click', event => {
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
          ? 'Switched to fullscreen responsive mode.'
          : 'Switched to simulated phone frame.',
        hapticPattern: 40
      });
    });
}

/* ============================================================
   NAVIGATION
============================================================ */

function initNavigation() {
  document.querySelectorAll(
    '.bottom-nav .nav-item'
  ).forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-nav');

      if (target) {
        navigateProtected(target);
      }
    });
  });

  document.querySelectorAll(
    '[data-back], .btn-header-back'
  ).forEach(button => {
    button.addEventListener('click', () => {
      stopCamera();

      const target =
        button.getAttribute('data-back');

      if (target) {
        if (
          target === 'screen-welcome' ||
          target === 'screen-login' ||
          target === 'screen-register'
        ) {
          navigateTo(target);
        } else {
          navigateProtected(target);
        }
      } else if (canAccessProtectedScreens()) {
        navigateBack();
      }
    });
  });

  getField('dash-btn-scan')
    ?.addEventListener('click', () => {
      navigateProtected('screen-scanner');
    });

  getField('dash-btn-stealth')
    ?.addEventListener('click', () => {
      if (!canAccessProtectedScreens()) return;

      navigateTo('screen-stealth');

      provideFeedback({
        text:
          'Black Stealth Mode activated. Display is dark.',
        priority: true
      });
    });

  getField('dash-btn-practice')
    ?.addEventListener('click', () => {
      navigateProtected('screen-practice');
    });

  getField('dash-btn-tutorial')
    ?.addEventListener('click', () => {
      navigateProtected('screen-tutorial');
    });

  getField('btn-see-all-history')
    ?.addEventListener('click', () => {
      navigateProtected('screen-history');
    });
}

/* ============================================================
   LOGIN, REGISTRATION AND ONBOARDING
============================================================ */

function initFormInteractions() {
  // Each form is declared exactly once.
  const formLogin = getField('form-login');
  const formRegister = getField('form-register');
  const formPinSetup = getField('form-pin-setup');

  /* ---------------- GUARDIAN CONTINUE ---------------- */

  getField('btn-continue-dashboard')
    ?.addEventListener('click', async () => {
      if (guardianContinueBusy) return;

      const button =
        getField('btn-continue-dashboard');

      if (!getStoredToken()) {
        announceError('Please sign in again.');
        navigateTo('screen-welcome');
        return;
      }

      if (onboardingRequired) {
        announceError(
          'Complete your security PIN setup first.'
        );

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
            'Unable to verify guardian status with the server. ' +
            'Please check your connection.'
          );
          return;
        }

        if (!hasVerifiedPrimaryGuardian()) {
          announceError(
            'Verify a primary guardian and enable ' +
            'emergency notifications before continuing.'
          );
          return;
        }

        announceSuccess(
          'Guardian verified. Opening your PALMLOCK dashboard.'
        );

        navigateTo('screen-dashboard');
      } catch (error) {
        console.error(
          '[PALMLOCK ONBOARDING]',
          error
        );

        announceError(
          'Unable to complete onboarding. Please retry.'
        );
      } finally {
        guardianContinueBusy = false;
        updateGuardianOnboardingUI();
      }
    });

  /*
   * contacts.js should dispatch this event after
   * successfully refreshing MongoDB-backed contacts.
   *
   * Example:
   * document.dispatchEvent(
   *   new CustomEvent('palmlock:contacts-updated')
   * );
   */

  document.addEventListener(
    'palmlock:contacts-updated',
    () => {
      // The event is a UI refresh signal, not proof
      // that the server has verified the guardian.
      void refreshTrustedContacts({
        silent: true
      });
    }
  );

  /* ---------------- DEMO LOGIN FILL ---------------- */

  getField('btn-fill-demo-login')
    ?.addEventListener('click', () => {
      const email = getField('login-email');

      if (email) {
        email.value =
          state.user?.email || '';
      }

      provideFeedback({
        text:
          'Enter the password for your registered account. ' +
          'Backend authentication is required.',
        hapticPattern: 40
      });
    });

  getField('audio-btn-welcome')
    ?.addEventListener('click', () => {
      provideFeedback({
        text:
          'Welcome to PALMLOCK. Touch Beyond Vision. ' +
          'An accessible simulated payment system with ' +
          'directional gestures, audio and tactile feedback.',
        priority: true
      });
    });

  getField('btn-goto-register')
    ?.addEventListener('click', () => {
      navigateTo('screen-register');
    });

  /* ---------------- LOGIN ---------------- */

  formLogin?.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (authBusy) return;

      const email = getValue('login-email');

      const password =
        getField('login-password')?.value || '';

      showFieldError(
        'login-email-error',
        ''
      );

      showFieldError(
        'login-password-error',
        ''
      );

      if (!email || !password) {
        if (!email) {
          showFieldError(
            'login-email-error',
            'Please enter your email address.'
          );
        }

        if (!password) {
          showFieldError(
            'login-password-error',
            'Please enter your password.'
          );
        }

        announceError(
          'Please complete the login fields.'
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
        const result = await authRequest(
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

        if (!session.token || !session.user) {
          throw new Error(
            'The server did not return a complete login session.'
          );
        }

        saveSession(
          session.token,
          session.user
        );

        authenticated = true;

        onboardingRequired =
          Boolean(session.onboardingRequired);

        updateGuardianOnboardingUI();

        const passwordField =
          getField('login-password');

        if (passwordField) {
          passwordField.value = '';
        }

        await refreshTrustedContacts({
          silent: true
        });

        if (onboardingRequired) {
          announceSuccess(
            'Welcome back. Complete your security PIN setup.'
          );

          openPinSetup();
          return;
        }

        if (!contactsReady) {
          announceSuccess(
            'Signed in successfully. Trusted contacts ' +
            'could not be loaded. Please check your connection.'
          );

          navigateTo('screen-contacts');
          return;
        }

        if (!hasVerifiedPrimaryGuardian()) {
          announceSuccess(
            'Welcome back. Please verify a primary ' +
            'guardian with emergency alerts enabled.'
          );

          navigateTo('screen-contacts');
          return;
        }

        announceSuccess(
          `Welcome back, ${state.user?.name || 'User'}. ` +
          'Opening your dashboard.'
        );

        navigateTo('screen-dashboard');
      } catch (error) {
        if (!authenticated) {
          clearSession();
        }

        showFieldError(
          'login-password-error',
          error.message
        );

        announceError(error.message);
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
        getField('reg-password')?.value || '';

      const vision =
        getValue('reg-vision-level');

      if (
        !name ||
        !phone ||
        !email ||
        password.length < 6
      ) {
        announceError(
          'Please enter your name, phone number, ' +
          'email address and a password of at least ' +
          'six characters.'
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
        const result = await authRequest(
          '/auth/register',
          {
            name,
            email,
            phone,
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

        if (session.token && session.user) {
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
            'Configure your accessibility preferences.'
          );
        } else {
          clearSession();

          navigateTo('screen-welcome');

          announceSuccess(
            'Registration completed. Please sign in to continue.'
          );
        }
      } catch (error) {
        announceError(error.message);
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
    ?.addEventListener('click', () => {
      if (!getStoredToken()) {
        announceError(
          'Please sign in before configuring security.'
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
        setTheme(themeSelect.value);
      }

      announceSuccess(
        'Accessibility preferences applied. ' +
        'Now create your normal and emergency security PINs.'
      );

      openPinSetup();
    });

  /* ---------------- SECURITY PIN SETUP ---------------- */

  formPinSetup?.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (pinSetupBusy) return;

      showFieldError(
        'pin-setup-error',
        ''
      );

      if (!getStoredToken()) {
        announceError(
          'Please sign in before setting security PINs.'
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

        announceError(error.message);
        return;
      }

      pinSetupBusy = true;

      const submitButton =
        getField('btn-submit-pin-setup');

      setBusy(
        submitButton,
        true,
        'Saving PINs securely...'
      );

      try {
        const result =
          await authenticatedRequest(
            '/pin/setup',
            {
              standardPin:
                pins.standardPin,

              duressPin:
                pins.duressPin
            }
          );

        if (!result.success) {
          throw new Error(
            result.error ||
            'Unable to save security PINs.'
          );
        }

        onboardingRequired = false;

        clearPinSetupFields();
        updateGuardianOnboardingUI();

        announceSuccess(
          'Both security PINs were saved successfully. ' +
          'Next, register and verify your trusted contacts.'
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

        announceError(error.message);

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
   GESTURE ENGINES
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

  setPinCompleteCallback(sequence => {
    if (!canAccessProtectedScreens()) {
      clearPinGestures();
      return;
    }

    verifyEnteredPin(sequence);
  });

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
    button.addEventListener('click', () => {
      if (!canAccessProtectedScreens()) {
        return;
      }

      const gesture =
        button.getAttribute('data-gesture');

      if (gesture) {
        handlePinGesture(gesture);
      }
    });
  });

  setupShakeToClear(() => {
    clearPinGestures();

    provideFeedback({
      text:
        'Motion shake detected. PIN slots cleared.',
      gesture: 'ERROR',
      hapticPattern: 60
    });
  });

  getField('btn-switch-to-stealth')
    ?.addEventListener('click', () => {
      if (!canAccessProtectedScreens()) {
        return;
      }

      navigateTo('screen-stealth');
    });

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

  navigateProtected('screen-dashboard');

  provideFeedback({
    text:
      'Exited Black Stealth Mode. Display restored.',
    gesture: 'SUCCESS',
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
    button.addEventListener('click', () => {
      if (!canAccessProtectedScreens()) {
        return;
      }

      simulateScannedQR({
        merchant:
          button.getAttribute('data-merchant'),

        amount:
          button.getAttribute('data-amount'),

        fee:
          button.getAttribute('data-fee'),

        category:
          button.getAttribute('data-category')
      });
    });
  });

  getField('btn-decode-manual-qr')
    ?.addEventListener('click', () => {
      if (!canAccessProtectedScreens()) {
        return;
      }

      const raw =
        getValue('input-manual-qr');

      if (raw) {
        onQRCodeLocked(raw);
      } else {
        announceError(
          'Please enter a QR payload to decode.'
        );
      }
    });
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
    ?.addEventListener('click', () => {
      playTactileCurrencyPattern();
    });

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
    ?.addEventListener('click', () => {
      if (!canAccessProtectedScreens()) {
        return;
      }

      clearPinGestures();

      navigateTo('screen-gesture-pin');

      provideFeedback({
        text:
          'Enter your four-gesture PIN.',
        priority: true
      });
    });

  getField('btn-cancel-payment')
    ?.addEventListener('click', () => {
      clearPinGestures();

      provideFeedback({
        text: 'Transaction cancelled.',
        gesture: 'ERROR',
        hapticPattern: 60
      });

      navigateProtected('screen-dashboard');
    });

  getField('btn-result-done')
    ?.addEventListener('click', () => {
      navigateProtected('screen-dashboard');
    });

  getField('btn-result-retry')
    ?.addEventListener('click', () => {
      if (!canAccessProtectedScreens()) {
        return;
      }

      clearPinGestures();
      navigateTo('screen-gesture-pin');
    });

  getField('btn-result-cancel')
    ?.addEventListener('click', () => {
      navigateProtected('screen-dashboard');
    });

  getField('history-filter-select')
    ?.addEventListener('change', event => {
      renderHistoryList(
        event.target.value
      );
    });
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
          GESTURE_TO_DIGIT[gesture] ?? '';

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

          hapticLabel:
            `Practiced: ${gesture}`,

          priority: true
        });
      }
    );
  }

  getField('btn-practice-reset')
    ?.addEventListener('click', () => {
      if (detectedText) {
        detectedText.textContent =
          'Swipe or Tap Inside Box';
      }

      provideFeedback({
        text:
          'Practice log reset.'
      });
    });

  getField('btn-practice-test-pin')
    ?.addEventListener('click', () => {
      // Practice must never authorize a payment.

      provideFeedback({
        text:
          'Practice mode is available in the gesture box. ' +
          'Real PIN verification is not part of this practice test.',
        priority: true
      });
    });
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
      String(state.preferences.speechRate);

    rateSlider.addEventListener(
      'input',
      event => {
        const value =
          Number(event.target.value);

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
        setTheme(event.target.value);
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
        setFontSize(event.target.value);
      }
    );
  }

  getField('btn-manage-contacts-from-settings')
    ?.addEventListener('click', () => {
      void openContactsScreen();
    });
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

      if (event.altKey && !isTyping) {
        switch (event.key.toLowerCase()) {
          case 's':
            event.preventDefault();

            if (!canAccessProtectedScreens()) {
              return;
            }

            if (state.isStealthActive) {
              exitStealthMode();
            } else {
              navigateTo('screen-stealth');
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
      } else if (event.key === 'Escape') {
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
        } else if (state.isStealthActive) {
          exitStealthMode();
        }
      }
    }
  );
}

/**
 * PALMLOCK — Touch Beyond Vision
 * Main Application Bootstrap & Controller
 */

import { state } from './state.js';
import {
  provideFeedback,
  speak,
  stopSpeech,
  setTheme,
  cycleTheme,
  setFontSize,
  cycleFontSize,
  triggerHaptic
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
import { initContacts } from './contacts.js';
import { initTutorial } from './tutorial.js';
import { initOfflineQueue } from './offline-queue.js';
import { captureEmergencyLocation, requestLocationAccess } from './location.js';
import { apiReportEmergency, apiReportFalseAlarm } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
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

  // Initial Data Renders
  renderDashboardRecentTransactions();
  renderHistoryList('all');
  updateVerificationScreen();

  console.info('PALMLOCK mobile accessibility interface initialized successfully.');
});

/**
 * 1. Top Persistent Accessibility Bar Controls
 */
function initTopAccessibilityBar() {
  const speechToggle = document.getElementById('btn-toggle-speech');
  if (speechToggle) {
    speechToggle.addEventListener('click', () => {
      state.preferences.speechEnabled = !state.preferences.speechEnabled;
      speechToggle.setAttribute('aria-pressed', state.preferences.speechEnabled.toString());
      speechToggle.title = `Audio Announcements: ${state.preferences.speechEnabled ? 'On' : 'Off'}`;
      if (!state.preferences.speechEnabled) {
        stopSpeech();
      }
      provideFeedback({
        text: `Audio announcements ${state.preferences.speechEnabled ? 'enabled' : 'disabled'}`,
        hapticPattern: 50,
        hapticLabel: 'Speech Toggled'
      });
    });
  }

  const themeBtn = document.getElementById('btn-cycle-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      cycleTheme();
    });
  }

  const fontBtn = document.getElementById('btn-cycle-font');
  if (fontBtn) {
    fontBtn.addEventListener('click', () => {
      cycleFontSize();
    });
  }

  const sosBtn = document.getElementById('btn-trigger-sos');
  if (sosBtn) {
    sosBtn.addEventListener('click', async () => {
      openModal('modal-sos-alert');
      const loc = await captureEmergencyLocation();
      const coordsEl = document.getElementById('sos-modal-coords');
      if (coordsEl) coordsEl.textContent = loc.coords;

      await apiReportEmergency({
        type: 'SOS',
        userId: state.user.id,
        userName: state.user.name,
        userPhone: state.user.phone,
        location: loc.coords,
        lat: loc.lat,
        lng: loc.lng,
        accuracyMeters: loc.accuracyMeters
      });

      provideFeedback({
        text: 'Emergency SOS alert activated. Location coordinates and incident telemetry dispatched to trusted contacts.',
        gesture: 'ERROR',
        hapticPattern: [300, 100, 300, 100, 300],
        hapticLabel: 'SOS Triggered',
        priority: true
      });
    });
  }

  const falseAlarmBtn = document.getElementById('btn-report-false-alarm');
  if (falseAlarmBtn) {
    falseAlarmBtn.addEventListener('click', async () => {
      await apiReportFalseAlarm(`ALT-${new Date().getFullYear()}-SOS`, 'User cancelled accidental SOS trigger.');
      closeModal('modal-sos-alert');
      provideFeedback({
        text: 'False alarm reported to security operations center. Alert status updated.',
        gesture: 'SUCCESS',
        hapticPattern: [100, 50, 100],
        priority: true
      });
    });
  }

  const closeSosBtn = document.getElementById('btn-close-sos-modal');
  if (closeSosBtn) {
    closeSosBtn.addEventListener('click', () => {
      closeModal('modal-sos-alert');
    });
  }

  const brandLink = document.getElementById('brand-home-link');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('screen-dashboard');
    });
  }
}

/**
 * 2. Desktop Preview Bar & Direct Screen Switcher
 */
function initDesktopPreviewBar() {
  const fastNav = document.getElementById('screen-fast-nav');
  if (fastNav) {
    fastNav.addEventListener('change', (e) => {
      const targetScreen = e.target.value;
      if (targetScreen === 'screen-scanner') {
        navigateTo(targetScreen);
        startCamera();
      } else {
        stopCamera();
        navigateTo(targetScreen);
      }
    });
  }

  const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      document.body.classList.toggle('fullscreen-mode');
      const isFull = document.body.classList.contains('fullscreen-mode');
      fullscreenBtn.textContent = isFull ? 'Mobile Frame' : 'Toggle Frame';
      provideFeedback({
        text: isFull ? 'Switched to fullscreen responsive mode' : 'Switched to simulated phone frame',
        hapticPattern: 40
      });
    });
  }
}

/**
 * 3. Bottom Navigation & Header Back Buttons
 */
function initNavigation() {
  // Bottom Navigation Bar
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-nav');
      if (target) {
        if (target === 'screen-scanner') {
          navigateTo(target);
          startCamera();
        } else {
          stopCamera();
          navigateTo(target);
        }
      }
    });
  });

  // Contextual Header Back Buttons
  const backButtons = document.querySelectorAll('[data-back], .btn-header-back');
  backButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      stopCamera();
      const explicitBack = btn.getAttribute('data-back');
      if (explicitBack) {
        navigateTo(explicitBack);
      } else {
        navigateBack();
      }
    });
  });

  // Dashboard Action Tiles
  const dashScan = document.getElementById('dash-btn-scan');
  if (dashScan) {
    dashScan.addEventListener('click', () => {
      navigateTo('screen-scanner');
      startCamera();
    });
  }

  const dashStealth = document.getElementById('dash-btn-stealth');
  if (dashStealth) {
    dashStealth.addEventListener('click', () => {
      navigateTo('screen-stealth');
      provideFeedback({
        text: 'Black Stealth Mode activated. Display is dark. Gestures enabled.',
        priority: true
      });
    });
  }

  const dashPractice = document.getElementById('dash-btn-practice');
  if (dashPractice) {
    dashPractice.addEventListener('click', () => {
      navigateTo('screen-practice');
    });
  }

  const dashTutorial = document.getElementById('dash-btn-tutorial');
  if (dashTutorial) {
    dashTutorial.addEventListener('click', () => {
      navigateTo('screen-tutorial');
    });
  }

  const seeAllHistoryBtn = document.getElementById('btn-see-all-history');
  if (seeAllHistoryBtn) {
    seeAllHistoryBtn.addEventListener('click', () => {
      navigateTo('screen-history');
    });
  }
}

/**
 * 4. Form Interactions & Demonstration Authentication
 */
function initFormInteractions() {
  // Welcome / Login Form
  const formLogin = document.getElementById('form-login');
  const demoFillBtn = document.getElementById('btn-fill-demo-login');
  const audioWelcomeBtn = document.getElementById('audio-btn-welcome');
  const gotoRegBtn = document.getElementById('btn-goto-register');

  if (demoFillBtn) {
    demoFillBtn.addEventListener('click', () => {
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (emailInput) emailInput.value = state.user.email;
      if (passInput) passInput.value = 'DemoPass2026!';
      provideFeedback({
        text: 'Filled demonstrative user credentials.',
        hapticPattern: 40
      });
    });
  }

  if (audioWelcomeBtn) {
    audioWelcomeBtn.addEventListener('click', () => {
      provideFeedback({
        text: 'Welcome to PALMLOCK. Touch Beyond Vision. An accessible payment system combining directional audio, haptic vibrations, and gesture PIN security.',
        priority: true
      });
    });
  }

  if (gotoRegBtn) {
    gotoRegBtn.addEventListener('click', () => {
      navigateTo('screen-register');
    });
  }

  if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value.trim();
      const pass = document.getElementById('login-password')?.value;
      const emailErr = document.getElementById('login-email-error');
      const passErr = document.getElementById('login-password-error');

      if (emailErr) emailErr.textContent = '';
      if (passErr) passErr.textContent = '';

      let hasError = false;
      if (!email) {
        if (emailErr) emailErr.textContent = 'Please enter your email or phone number.';
        hasError = true;
      }
      if (!pass || pass.length < 4) {
        if (passErr) passErr.textContent = 'Please enter your account password.';
        hasError = true;
      }

      if (hasError) {
        provideFeedback({ text: 'Please complete all required login fields.', gesture: 'ERROR' });
        return;
      }

      // Demonstration sign-in successful
      provideFeedback({
        text: `Welcome back, ${state.user.name}. Opening your dashboard.`,
        gesture: 'SUCCESS',
        hapticPattern: 100
      });
      navigateTo('screen-dashboard');
    });
  }

  // Registration Form
  const formRegister = document.getElementById('form-register');
  if (formRegister) {
    formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-fullname')?.value.trim();
      const phone = document.getElementById('reg-phone')?.value.trim();
      const pass = document.getElementById('reg-password')?.value;
      const vision = document.getElementById('reg-vision-level')?.value;

      if (!name || !phone || !pass || pass.length < 6) {
        provideFeedback({
          text: 'Please check your registration information. Password must be at least 6 characters.',
          gesture: 'ERROR'
        });
        return;
      }

      state.user.name = name;
      state.user.phone = phone;
      state.user.visionLevel = vision;

      provideFeedback({
        text: `Account profile created for ${name}. Let's configure your sensory preferences.`,
        gesture: 'SUCCESS'
      });
      navigateTo('screen-setup');
    });
  }

  // User Setup Screen
  const btnSaveSetup = document.getElementById('btn-save-setup');
  if (btnSaveSetup) {
    btnSaveSetup.addEventListener('click', () => {
      const audioToggle = document.getElementById('setup-audio-toggle')?.checked;
      const hapticToggle = document.getElementById('setup-haptic-toggle')?.checked;
      const themeSelect = document.getElementById('setup-theme-select')?.value;

      state.preferences.speechEnabled = audioToggle ?? true;
      state.preferences.hapticEnabled = hapticToggle ?? true;
      if (themeSelect) setTheme(themeSelect);

      provideFeedback({
        text: 'Accessibility profile saved. Navigating to home dashboard.',
        gesture: 'SUCCESS'
      });
      navigateTo('screen-dashboard');
    });
  }
}

/**
 * 5. Gesture Recognition Engines (PIN, Practice & Stealth)
 */
function initGestureEngines() {
  // Main PIN Entry Canvas
  const pinCanvas = document.getElementById('pin-gesture-canvas');
  if (pinCanvas) {
    new GestureRecognizer(pinCanvas, (gesture) => {
      handlePinGesture(gesture);
    });
  }

  // Register callback when 4 PIN gestures are completed
  setPinCompleteCallback((enteredDigits) => {
    verifyEnteredPin(enteredDigits);
  });

  // Undo & Clear Controls for PIN Entry
  const pinUndoBtn = document.getElementById('btn-pin-undo');
  if (pinUndoBtn) {
    pinUndoBtn.addEventListener('click', () => undoPinGesture());
  }

  const pinClearBtn = document.getElementById('btn-pin-clear');
  if (pinClearBtn) {
    pinClearBtn.addEventListener('click', () => clearPinGestures());
  }

  // Accessible numeric buttons for screen readers & direct entry
  const pinDigitButtons = document.querySelectorAll('.btn-pin-digit');
  pinDigitButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const gesture = btn.getAttribute('data-gesture');
      if (gesture) handlePinGesture(gesture);
    });
  });

  // Opt-in Shake-to-Clear motion gesture
  setupShakeToClear(() => {
    clearPinGestures();
    provideFeedback({
      text: 'Motion shake detected. Gesture PIN slots cleared.',
      gesture: 'ERROR',
      hapticPattern: 60
    });
  });

  const btnSwitchStealth = document.getElementById('btn-switch-to-stealth');
  if (btnSwitchStealth) {
    btnSwitchStealth.addEventListener('click', () => {
      navigateTo('screen-stealth');
    });
  }

  // Stealth Mode Touch Surface
  const stealthCanvas = document.getElementById('stealth-touch-canvas');
  if (stealthCanvas) {
    let lastTapTime = 0;
    new GestureRecognizer(stealthCanvas, (gesture) => {
      // Check for double tap to exit stealth mode
      if (gesture === 'TAP') {
        const now = Date.now();
        if (now - lastTapTime < 450) {
          exitStealthMode();
          return;
        }
        lastTapTime = now;
      }

      // Enter gesture directly into PIN buffer if a transaction is pending
      if (state.currentTransaction) {
        handlePinGesture(gesture);
      } else {
        provideFeedback({
          gesture: gesture,
          hapticPattern: 60,
          hapticLabel: `Stealth: ${gesture}`
        });
      }
    });
  }

  const exitStealthBtn = document.getElementById('btn-exit-stealth');
  if (exitStealthBtn) {
    exitStealthBtn.addEventListener('click', () => exitStealthMode());
  }
}

function exitStealthMode() {
  navigateTo('screen-dashboard');
  provideFeedback({
    text: 'Exited Black Stealth Mode. Display restored.',
    gesture: 'SUCCESS',
    hapticPattern: 60
  });
}

/**
 * 6. Scanner Controls & Test Payloads
 */
function initScannerControls() {
  const torchBtn = document.getElementById('btn-toggle-camera-torch');
  if (torchBtn) {
    torchBtn.addEventListener('click', () => toggleTorch());
  }

  const simulateBtns = document.querySelectorAll('.btn-simulate-qr');
  simulateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const merchant = btn.getAttribute('data-merchant');
      const amount = btn.getAttribute('data-amount');
      const fee = btn.getAttribute('data-fee');
      const category = btn.getAttribute('data-category');

      simulateScannedQR({ merchant, amount, fee, category });
    });
  });

  const manualDecodeBtn = document.getElementById('btn-decode-manual-qr');
  if (manualDecodeBtn) {
    manualDecodeBtn.addEventListener('click', () => {
      const input = document.getElementById('input-manual-qr');
      const rawText = input ? input.value.trim() : '';
      if (rawText) {
        onQRCodeLocked(rawText);
      } else {
        provideFeedback({
          text: 'Please paste or enter a QR text payload to decode.',
          gesture: 'ERROR'
        });
      }
    });
  }
}

/**
 * 7. Payment Verification Actions & Result Screen
 */
function initPaymentActions() {
  const readDetailsBtn = document.getElementById('btn-read-payment-details');
  if (readDetailsBtn) {
    readDetailsBtn.addEventListener('click', () => readPaymentDetails());
  }

  // Tactile Currency Verification Controls (Priority 2)
  const playVibrateBtn = document.getElementById('btn-play-currency-vibrate');
  if (playVibrateBtn) {
    playVibrateBtn.addEventListener('click', () => playTactileCurrencyPattern());
  }

  const stopVibrateBtn = document.getElementById('btn-stop-currency-vibrate');
  if (stopVibrateBtn) {
    stopVibrateBtn.addEventListener('click', () => stopTactileCurrencyPattern());
  }

  const repeatVibrateBtn = document.getElementById('btn-repeat-currency-vibrate');
  if (repeatVibrateBtn) {
    repeatVibrateBtn.addEventListener('click', () => repeatTactileCurrencyPattern());
  }

  const proceedPinBtn = document.getElementById('btn-proceed-to-pin');
  if (proceedPinBtn) {
    proceedPinBtn.addEventListener('click', () => {
      clearPinGestures();
      navigateTo('screen-gesture-pin');
      provideFeedback({
        text: 'Enter your 4-gesture PIN. Swipe Up, Down, Left, Right or Tap.',
        priority: true
      });
    });
  }

  const cancelPayBtn = document.getElementById('btn-cancel-payment');
  if (cancelPayBtn) {
    cancelPayBtn.addEventListener('click', () => {
      provideFeedback({
        text: 'Transaction cancelled.',
        gesture: 'ERROR',
        hapticPattern: 60
      });
      navigateTo('screen-dashboard');
    });
  }

  // Result Screen Buttons
  const resultDoneBtn = document.getElementById('btn-result-done');
  if (resultDoneBtn) {
    resultDoneBtn.addEventListener('click', () => {
      navigateTo('screen-dashboard');
    });
  }

  const resultRetryBtn = document.getElementById('btn-result-retry');
  if (resultRetryBtn) {
    resultRetryBtn.addEventListener('click', () => {
      clearPinGestures();
      navigateTo('screen-gesture-pin');
    });
  }

  const resultCancelBtn = document.getElementById('btn-result-cancel');
  if (resultCancelBtn) {
    resultCancelBtn.addEventListener('click', () => {
      navigateTo('screen-dashboard');
    });
  }

  // History Filter
  const historyFilter = document.getElementById('history-filter-select');
  if (historyFilter) {
    historyFilter.addEventListener('change', (e) => {
      renderHistoryList(e.target.value);
    });
  }
}

/**
 * 8. Practice Lab Canvas & Controls
 */
function initPracticeLab() {
  const practiceCanvas = document.getElementById('practice-gesture-canvas');
  const detectedText = document.getElementById('practice-detected-text');

  if (practiceCanvas) {
    new GestureRecognizer(practiceCanvas, (gesture) => {
      const digit = GESTURE_TO_DIGIT[gesture] !== undefined ? GESTURE_TO_DIGIT[gesture] : '';
      if (detectedText) {
        detectedText.textContent = `Detected: ${gesture} (Digit ${digit})`;
      }
      provideFeedback({
        text: `${gesture}, Digit ${digit}`,
        gesture: gesture,
        hapticPattern: gesture === 'TAP' || gesture === 'SINGLE_TAP' ? 40 : 80,
        hapticLabel: `Practiced: ${gesture} (Digit ${digit})`,
        priority: true
      });
    });
  }

  const resetBtn = document.getElementById('btn-practice-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (detectedText) detectedText.textContent = 'Swipe or Tap Inside Box';
      provideFeedback({ text: 'Practice log reset.' });
    });
  }

  const testPinBtn = document.getElementById('btn-practice-test-pin');
  if (testPinBtn) {
    testPinBtn.addEventListener('click', () => {
      clearPinGestures();
      navigateTo('screen-gesture-pin');
    });
  }
}

/**
 * 9. Settings Screen Controls
 */
function initSettingsControls() {
  const speechToggle = document.getElementById('settings-speech-toggle');
  if (speechToggle) {
    speechToggle.checked = state.preferences.speechEnabled;
    speechToggle.addEventListener('change', (e) => {
      state.preferences.speechEnabled = e.target.checked;
      const topBtn = document.getElementById('btn-toggle-speech');
      if (topBtn) topBtn.setAttribute('aria-pressed', e.target.checked.toString());
      provideFeedback({
        text: `Speech synthesis ${e.target.checked ? 'enabled' : 'disabled'}`
      });
    });
  }

  const rateSlider = document.getElementById('settings-speech-rate');
  const rateLabel = document.getElementById('speech-rate-label');
  if (rateSlider) {
    rateSlider.value = state.preferences.speechRate.toString();
    rateSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.preferences.speechRate = val;
      if (rateLabel) rateLabel.textContent = `${val.toFixed(1)}x`;
    });
    rateSlider.addEventListener('change', (e) => {
      provideFeedback({
        text: `Speech speed set to ${e.target.value} times.`
      });
    });
  }

  const vibrateToggle = document.getElementById('settings-vibrate-toggle');
  if (vibrateToggle) {
    vibrateToggle.checked = state.preferences.hapticEnabled;
    vibrateToggle.addEventListener('change', (e) => {
      state.preferences.hapticEnabled = e.target.checked;
      provideFeedback({
        text: `Tactile vibrations ${e.target.checked ? 'enabled' : 'disabled'}`,
        hapticPattern: 60
      });
    });
  }

  const themeSelect = document.getElementById('settings-theme-select');
  if (themeSelect) {
    themeSelect.value = state.preferences.theme;
    themeSelect.addEventListener('change', (e) => {
      setTheme(e.target.value);
    });
  }

  const fontSelect = document.getElementById('settings-font-select');
  if (fontSelect) {
    fontSelect.value = state.preferences.fontSize;
    fontSelect.addEventListener('change', (e) => {
      setFontSize(e.target.value);
    });
  }

  const manageContactsBtn = document.getElementById('btn-manage-contacts-from-settings');
  if (manageContactsBtn) {
    manageContactsBtn.addEventListener('click', () => {
      navigateTo('screen-contacts');
    });
  }
}

/**
 * 10. Global Keyboard Shortcuts for Accessible Power Users
 */
function initGlobalKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Only handle Alt key combos or Escape
    if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case 's': // Alt + S: Toggle Stealth Mode
          e.preventDefault();
          if (state.isStealthActive) {
            exitStealthMode();
          } else {
            navigateTo('screen-stealth');
          }
          break;
        case 'q': // Alt + Q: Open QR Scanner
          e.preventDefault();
          navigateTo('screen-scanner');
          startCamera();
          break;
        case 'h': // Alt + H: Return Home
          e.preventDefault();
          stopCamera();
          navigateTo('screen-dashboard');
          break;
        case 't': // Alt + T: Cycle Theme
          e.preventDefault();
          cycleTheme();
          break;
      }
    } else if (e.key === 'Escape') {
      // Escape closes active modal or exits stealth
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) {
        activeModal.classList.remove('active');
        activeModal.setAttribute('aria-hidden', 'true');
      } else if (state.isStealthActive) {
        exitStealthMode();
      }
    }
  });
}

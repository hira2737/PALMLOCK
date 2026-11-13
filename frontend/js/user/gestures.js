/**
 * PALMLOCK — Touch Beyond Vision
 * Directional Gesture Engine: 8-Way Swipes, Single/Double Tap Detection,
 * Numeric Mapping (0-9), Tactile & Audio Feedback, Inactivity Auto-Clear
 */

import { state } from './state.js';
import { provideFeedback, playGestureAudio } from './accessibility.js';

const MIN_SWIPE_DISTANCE = 35; // Pixels required to qualify as directional swipe
const MAX_TAP_DISTANCE = 15;   // Max pixel movement to qualify as a TAP
const DOUBLE_TAP_MAX_DELAY = 320; // Max ms between taps to trigger Double-Tap (Digit 9)
const INACTIVITY_TIMEOUT_MS = 12000; // Inactivity auto-clear after 12 seconds

/**
 * PALMLOCK Complete Numeric Gesture Mapping:
 * 1: Up-left ↖
 * 2: Up ↑
 * 3: Up-right ↗
 * 4: Left ←
 * 5: Right →
 * 6: Down-left ↙
 * 7: Down ↓
 * 8: Down-right ↘
 * 9: Double tap
 * 0: Single tap
 */
export const GESTURE_TO_DIGIT = {
  'UP_LEFT': 1,
  'UP': 2,
  'UP_RIGHT': 3,
  'LEFT': 4,
  'RIGHT': 5,
  'DOWN_LEFT': 6,
  'DOWN': 7,
  'DOWN_RIGHT': 8,
  'DOUBLE_TAP': 9,
  'TAP': 0,
  'SINGLE_TAP': 0
};

export const DIGIT_TO_GESTURE = {
  1: { gesture: 'UP_LEFT', symbol: '↖', label: 'Up-Left' },
  2: { gesture: 'UP', symbol: '↑', label: 'Up' },
  3: { gesture: 'UP_RIGHT', symbol: '↗', label: 'Up-Right' },
  4: { gesture: 'LEFT', symbol: '←', label: 'Left' },
  5: { gesture: 'RIGHT', symbol: '→', label: 'Right' },
  6: { gesture: 'DOWN_LEFT', symbol: '↙', label: 'Down-Left' },
  7: { gesture: 'DOWN', symbol: '↓', label: 'Down' },
  8: { gesture: 'DOWN_RIGHT', symbol: '↘', label: 'Down-Right' },
  9: { gesture: 'DOUBLE_TAP', symbol: '••', label: 'Double Tap' },
  0: { gesture: 'SINGLE_TAP', symbol: '•', label: 'Single Tap' }
};

let inactivityTimer = null;

export class GestureRecognizer {
  constructor(element, onGestureDetected) {
    this.element = element;
    this.onGestureDetected = onGestureDetected;
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isTracking = false;

    // Single vs Double tap disambiguation state
    this.lastTapTime = 0;
    this.pendingTapTimeout = null;

    this.initListeners();
  }

  initListeners() {
    if (!this.element) return;

    // Pointer Events API (Unified touch, stylus, and mouse support)
    this.element.addEventListener('pointerdown', (e) => this.handlePointerDown(e), { passive: false });
    this.element.addEventListener('pointermove', (e) => this.handlePointerMove(e), { passive: false });
    this.element.addEventListener('pointerup', (e) => this.handlePointerUp(e), { passive: false });
    this.element.addEventListener('pointercancel', (e) => this.handlePointerCancel(e), { passive: false });

    // Keyboard Fallback for Screen Readers & Motor-Impaired Users
    this.element.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startTime = Date.now();
    this.isTracking = true;
    this.element.classList.add('active-swiping');
    
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  handlePointerMove(e) {
    if (!this.isTracking) return;
    e.preventDefault();
  }

  handlePointerUp(e) {
    if (!this.isTracking) return;
    this.isTracking = false;
    this.element.classList.remove('active-swiping');

    const endX = e.clientX;
    const endY = e.clientY;
    const duration = Date.now() - this.startTime;

    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 1. Evaluate Tap (within displacement threshold)
    if (absX <= MAX_TAP_DISTANCE && absY <= MAX_TAP_DISTANCE && duration <= 400) {
      const now = Date.now();
      const timeSinceLastTap = now - this.lastTapTime;

      if (timeSinceLastTap < DOUBLE_TAP_MAX_DELAY) {
        // Double Tap confirmed! Cancel pending single-tap and trigger Digit 9
        if (this.pendingTapTimeout) {
          clearTimeout(this.pendingTapTimeout);
          this.pendingTapTimeout = null;
        }
        this.lastTapTime = 0;
        this.triggerGesture('DOUBLE_TAP');
      } else {
        // Potential Single Tap (Digit 0). Delay slightly to ensure second tap doesn't follow
        this.lastTapTime = now;
        this.pendingTapTimeout = setTimeout(() => {
          this.triggerGesture('SINGLE_TAP');
          this.pendingTapTimeout = null;
        }, DOUBLE_TAP_MAX_DELAY);
      }
      return;
    }

    // 2. Evaluate 8-Directional Vector Angle
    if (absX >= MIN_SWIPE_DISTANCE || absY >= MIN_SWIPE_DISTANCE) {
      const direction = classifyDirection(deltaX, deltaY, MIN_SWIPE_DISTANCE);
      if (direction !== 'NONE') {
        this.triggerGesture(direction);
      }
    }
  }

  handlePointerCancel() {
    this.isTracking = false;
    this.element.classList.remove('active-swiping');
    if (this.pendingTapTimeout) {
      clearTimeout(this.pendingTapTimeout);
      this.pendingTapTimeout = null;
    }
  }

  handleKeyDown(e) {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.triggerGesture('UP');
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.triggerGesture('DOWN');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.triggerGesture('LEFT');
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.triggerGesture('RIGHT');
        break;
      case '1':
      case 'End':
        e.preventDefault();
        this.triggerGesture('UP_LEFT');
        break;
      case '2':
        e.preventDefault();
        this.triggerGesture('UP');
        break;
      case '3':
      case 'PageDown':
        e.preventDefault();
        this.triggerGesture('UP_RIGHT');
        break;
      case '4':
        e.preventDefault();
        this.triggerGesture('LEFT');
        break;
      case '5':
        e.preventDefault();
        this.triggerGesture('RIGHT');
        break;
      case '6':
        e.preventDefault();
        this.triggerGesture('DOWN_LEFT');
        break;
      case '7':
      case 'Home':
        e.preventDefault();
        this.triggerGesture('DOWN');
        break;
      case '8':
        e.preventDefault();
        this.triggerGesture('DOWN_RIGHT');
        break;
      case '9':
      case 'PageUp':
        e.preventDefault();
        this.triggerGesture('DOUBLE_TAP');
        break;
      case '0':
      case ' ':
      case 'Enter':
        e.preventDefault();
        this.triggerGesture('SINGLE_TAP');
        break;
      case 'Backspace':
        e.preventDefault();
        undoPinGesture();
        break;
      case 'Escape':
        e.preventDefault();
        clearPinGestures();
        break;
    }
  }

  triggerGesture(gesture) {
    if (this.onGestureDetected) {
      this.onGestureDetected(gesture);
    }
  }
}

/**
 * Classify vector into one of 8 compass directions
 * Screen coordinate system: deltaX is + Right, deltaY is + Down
 */
export function classifyDirection(deltaX, deltaY, minDistance = 35) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < minDistance && absY < minDistance) {
    return 'NONE';
  }

  // Calculate angle in degrees (-180 to +180)
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  // 8 Sectors (each 45 degrees wide)
  if (angle >= -112.5 && angle < -67.5) {
    return 'UP'; // -90 deg
  } else if (angle >= -67.5 && angle < -22.5) {
    return 'UP_RIGHT'; // -45 deg
  } else if (angle >= -22.5 && angle < 22.5) {
    return 'RIGHT'; // 0 deg
  } else if (angle >= 22.5 && angle < 67.5) {
    return 'DOWN_RIGHT'; // +45 deg
  } else if (angle >= 67.5 && angle < 112.5) {
    return 'DOWN'; // +90 deg
  } else if (angle >= 112.5 && angle < 157.5) {
    return 'DOWN_LEFT'; // +135 deg
  } else if (angle >= -157.5 && angle < -112.5) {
    return 'UP_LEFT'; // -135 deg
  } else {
    return 'LEFT'; // 180 or -180 deg
  }
}

/**
 * Handle Gesture for PIN Verification Screen
 */
let onPinCompleteCallback = null;

export function setPinCompleteCallback(cb) {
  onPinCompleteCallback = cb;
}

export function handlePinGesture(gesture) {
  if (state.enteredPin.length >= 4) return;

  // Reset 12-second inactivity timer
  resetInactivityTimer();

  // Normalize TAP to SINGLE_TAP
  const normalizedGesture = gesture === 'TAP' ? 'SINGLE_TAP' : gesture;
  const digit = GESTURE_TO_DIGIT[normalizedGesture] !== undefined 
    ? GESTURE_TO_DIGIT[normalizedGesture] 
    : 0;

  state.enteredPin.push(normalizedGesture);

  // Map distinct haptic pulse pattern
  let haptic = 80;
  if (normalizedGesture === 'DOUBLE_TAP') haptic = [40, 50, 40];
  else if (normalizedGesture === 'SINGLE_TAP') haptic = 40;
  else if (normalizedGesture.includes('UP')) haptic = 70;
  else if (normalizedGesture.includes('DOWN')) haptic = 90;

  // Provide tactile and audio feedback
  provideFeedback({
    text: `Digit ${digit} registered.`,
    gesture: normalizedGesture,
    hapticPattern: haptic,
    hapticLabel: `Digit: ${digit} (${normalizedGesture})`,
    priority: true
  });

  updatePinSlotsVisual();

  // If 4 digits entered, evaluate PIN
  if (state.enteredPin.length === 4) {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    setTimeout(() => {
      if (onPinCompleteCallback) {
        onPinCompleteCallback([...state.enteredPin]);
      }
    }, 250);
  }
}

export function undoPinGesture() {
  resetInactivityTimer();
  if (state.enteredPin.length > 0) {
    const removed = state.enteredPin.pop();
    updatePinSlotsVisual();
    provideFeedback({
      text: `Removed last gesture: ${removed}`,
      gesture: 'DOWN',
      hapticPattern: 60,
      hapticLabel: 'Undo Gesture'
    });
  }
}

export function clearPinGestures() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  state.enteredPin = [];
  updatePinSlotsVisual();
  provideFeedback({
    text: 'Cleared all entered gestures',
    gesture: 'ERROR',
    hapticPattern: [50, 50, 50],
    hapticLabel: 'PIN Cleared'
  });
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (state.enteredPin.length > 0 && state.enteredPin.length < 4) {
      clearPinGestures();
      provideFeedback({
        text: 'PIN entry timed out after inactivity. Slots cleared.',
        gesture: 'ERROR'
      });
    }
  }, INACTIVITY_TIMEOUT_MS);
}

function updatePinSlotsVisual() {
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`pin-slot-${i}`);
    if (!slot) continue;

    if (i < state.enteredPin.length) {
      const g = state.enteredPin[i];
      slot.classList.add('filled');
      
      let symbol = '●';
      if (g === 'UP') symbol = '↑';
      else if (g === 'DOWN') symbol = '↓';
      else if (g === 'LEFT') symbol = '←';
      else if (g === 'RIGHT') symbol = '→';
      else if (g === 'UP_LEFT') symbol = '↖';
      else if (g === 'UP_RIGHT') symbol = '↗';
      else if (g === 'DOWN_LEFT') symbol = '↙';
      else if (g === 'DOWN_RIGHT') symbol = '↘';
      else if (g === 'DOUBLE_TAP') symbol = '••';
      else if (g === 'SINGLE_TAP' || g === 'TAP') symbol = '•';

      slot.textContent = symbol;
      slot.setAttribute('aria-label', `Slot ${i + 1}: ${g}`);
    } else {
      slot.classList.remove('filled');
      slot.textContent = '-';
      slot.setAttribute('aria-label', `Slot ${i + 1}: Empty`);
    }
  }
}

/**
 * Shake-to-Clear motion gesture listener (opt-in)
 */
export function setupShakeToClear(onShake) {
  if (typeof window === 'undefined' || !window.DeviceMotionEvent) return;

  let lastX = 0, lastY = 0, lastZ = 0;
  let lastTime = 0;
  const SHAKE_THRESHOLD = 20;

  window.addEventListener('devicemotion', (e) => {
    if (!state.preferences.motionGesturesEnabled) return;

    const current = e.accelerationIncludingGravity;
    if (!current) return;

    const now = Date.now();
    if (now - lastTime > 150) {
      const diffTime = now - lastTime;
      lastTime = now;

      const speed = Math.abs(current.x + current.y + current.z - lastX - lastY - lastZ) / diffTime * 10000;
      if (speed > SHAKE_THRESHOLD) {
        if (onShake) onShake();
      }

      lastX = current.x;
      lastY = current.y;
      lastZ = current.z;
    }
  });
}

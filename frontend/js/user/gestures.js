
/**
 * PALMLOCK — Accessible Gesture PIN Engine
 *
 * 8 directional swipes + single/double tap.
 * Four-gesture PIN entry.
 *
 * Security:
 * - PIN digits are not spoken.
 * - PIN directions are not shown in payment slots.
 * - One completion callback per PIN entry.
 * - Inactivity clears incomplete entry.
 */

import { state } from './state.js';
import {
  provideFeedback
} from './accessibility.js';

const MIN_SWIPE_DISTANCE = 35;
const MAX_TAP_DISTANCE = 15;
const MAX_TAP_DURATION_MS = 400;
const DOUBLE_TAP_MAX_DELAY = 320;
const INACTIVITY_TIMEOUT_MS = 12000;
const PIN_LENGTH = 4;

export const GESTURE_TO_DIGIT = {
  UP_LEFT: 1,
  UP: 2,
  UP_RIGHT: 3,
  LEFT: 4,
  RIGHT: 5,
  DOWN_LEFT: 6,
  DOWN: 7,
  DOWN_RIGHT: 8,
  DOUBLE_TAP: 9,
  TAP: 0,
  SINGLE_TAP: 0
};

export const DIGIT_TO_GESTURE = {
  1: {
    gesture: 'UP_LEFT',
    symbol: '↖',
    label: 'Up-Left'
  },
  2: {
    gesture: 'UP',
    symbol: '↑',
    label: 'Up'
  },
  3: {
    gesture: 'UP_RIGHT',
    symbol: '↗',
    label: 'Up-Right'
  },
  4: {
    gesture: 'LEFT',
    symbol: '←',
    label: 'Left'
  },
  5: {
    gesture: 'RIGHT',
    symbol: '→',
    label: 'Right'
  },
  6: {
    gesture: 'DOWN_LEFT',
    symbol: '↙',
    label: 'Down-Left'
  },
  7: {
    gesture: 'DOWN',
    symbol: '↓',
    label: 'Down'
  },
  8: {
    gesture: 'DOWN_RIGHT',
    symbol: '↘',
    label: 'Down-Right'
  },
  9: {
    gesture: 'DOUBLE_TAP',
    symbol: '••',
    label: 'Double Tap'
  },
  0: {
    gesture: 'SINGLE_TAP',
    symbol: '•',
    label: 'Single Tap'
  }
};

let inactivityTimer = null;
let completionTimer = null;
let onPinCompleteCallback = null;
let pinSubmissionPending = false;
let pinEntryVersion = 0;

function normalizeGesture(gesture) {
  return gesture === 'TAP'
    ? 'SINGLE_TAP'
    : gesture;
}

function isValidGesture(gesture) {
  return Object.prototype.hasOwnProperty.call(
    GESTURE_TO_DIGIT,
    gesture
  );
}

function ensurePinState() {
  if (!Array.isArray(state.enteredPin)) {
    state.enteredPin = [];
  }
}

function cancelInactivityTimer() {
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function cancelCompletionTimer() {
  if (completionTimer !== null) {
    clearTimeout(completionTimer);
    completionTimer = null;
  }
}

/* ============================================================
   GESTURE RECOGNIZER
============================================================ */

export class GestureRecognizer {
  constructor(
    element,
    onGestureDetected
  ) {
    this.element = element;
    this.onGestureDetected =
      onGestureDetected;

    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.activePointerId = null;
    this.isTracking = false;

    this.lastTapTime = 0;
    this.lastTapX = 0;
    this.lastTapY = 0;
    this.pendingTapTimeout = null;

    this.boundPointerDown =
      event => this.handlePointerDown(event);

    this.boundPointerMove =
      event => this.handlePointerMove(event);

    this.boundPointerUp =
      event => this.handlePointerUp(event);

    this.boundPointerCancel =
      event => this.handlePointerCancel(event);

    this.boundKeyDown =
      event => this.handleKeyDown(event);

    this.initListeners();
  }

  initListeners() {
    if (!this.element) return;

    this.element.style.touchAction = 'none';

    if (
      !this.element.hasAttribute('tabindex')
    ) {
      this.element.tabIndex = 0;
    }

    this.element.addEventListener(
      'pointerdown',
      this.boundPointerDown
    );

    this.element.addEventListener(
      'pointermove',
      this.boundPointerMove
    );

    this.element.addEventListener(
      'pointerup',
      this.boundPointerUp
    );

    this.element.addEventListener(
      'pointercancel',
      this.boundPointerCancel
    );

    this.element.addEventListener(
      'keydown',
      this.boundKeyDown
    );
  }

  clearPendingTap() {
    if (this.pendingTapTimeout !== null) {
      clearTimeout(this.pendingTapTimeout);
      this.pendingTapTimeout = null;
    }

    this.lastTapTime = 0;
  }

  handlePointerDown(event) {
    if (
      this.isTracking ||
      event.isPrimary === false
    ) {
      return;
    }

    event.preventDefault();

    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startTime = performance.now();

    this.activePointerId =
      event.pointerId;

    this.isTracking = true;

    this.element.classList.add(
      'active-swiping'
    );

    try {
      this.element.setPointerCapture(
        event.pointerId
      );
    } catch (_) {}
  }

  handlePointerMove(event) {
    if (
      !this.isTracking ||
      event.pointerId !==
      this.activePointerId
    ) {
      return;
    }

    event.preventDefault();
  }

  handlePointerUp(event) {
    if (
      !this.isTracking ||
      event.pointerId !==
      this.activePointerId
    ) {
      return;
    }

    event.preventDefault();

    this.isTracking = false;
    this.activePointerId = null;

    this.element.classList.remove(
      'active-swiping'
    );

    const now = performance.now();

    const duration =
      now - this.startTime;

    const deltaX =
      event.clientX - this.startX;

    const deltaY =
      event.clientY - this.startY;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    const isTap =
      absX <= MAX_TAP_DISTANCE &&
      absY <= MAX_TAP_DISTANCE &&
      duration <= MAX_TAP_DURATION_MS;

    if (isTap) {
      this.handleTap(
        now,
        event.clientX,
        event.clientY
      );
      return;
    }

    // Finish a pending single tap before
    // processing a subsequent swipe.
    this.flushPendingTap();

    const direction =
      classifyDirection(
        deltaX,
        deltaY,
        MIN_SWIPE_DISTANCE
      );

    if (direction !== 'NONE') {
      this.triggerGesture(direction);
    }
  }

  handleTap(now, x, y) {
    const withinTime =
      this.lastTapTime > 0 &&
      now - this.lastTapTime <=
      DOUBLE_TAP_MAX_DELAY;

    const withinDistance =
      Math.hypot(
        x - this.lastTapX,
        y - this.lastTapY
      ) <= 50;

    if (
      withinTime &&
      withinDistance &&
      this.pendingTapTimeout !== null
    ) {
      this.clearPendingTap();

      this.triggerGesture(
        'DOUBLE_TAP'
      );
      return;
    }

    // If the previous tap cannot form a
    // double tap, commit it as a single tap.
    this.flushPendingTap();

    this.lastTapTime = now;
    this.lastTapX = x;
    this.lastTapY = y;

    this.pendingTapTimeout =
      setTimeout(() => {
        this.pendingTapTimeout = null;
        this.lastTapTime = 0;

        this.triggerGesture(
          'SINGLE_TAP'
        );
      }, DOUBLE_TAP_MAX_DELAY);
  }

  flushPendingTap() {
    if (this.pendingTapTimeout === null) {
      return;
    }

    this.clearPendingTap();

    this.triggerGesture(
      'SINGLE_TAP'
    );
  }

  handlePointerCancel(event) {
    if (
      this.activePointerId !== null &&
      event.pointerId !==
      this.activePointerId
    ) {
      return;
    }

    this.isTracking = false;
    this.activePointerId = null;

    this.element.classList.remove(
      'active-swiping'
    );

    this.clearPendingTap();
  }

  handleKeyDown(event) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    const mapping = {
      ArrowUp: 'UP',
      ArrowDown: 'DOWN',
      ArrowLeft: 'LEFT',
      ArrowRight: 'RIGHT',
      '1': 'UP_LEFT',
      '2': 'UP',
      '3': 'UP_RIGHT',
      '4': 'LEFT',
      '5': 'RIGHT',
      '6': 'DOWN_LEFT',
      '7': 'DOWN',
      '8': 'DOWN_RIGHT',
      '9': 'DOUBLE_TAP',
      '0': 'SINGLE_TAP',
      ' ': 'SINGLE_TAP',
      Enter: 'SINGLE_TAP',
      Home: 'DOWN',
      End: 'UP_LEFT',
      PageUp: 'DOUBLE_TAP',
      PageDown: 'UP_RIGHT'
    };

    if (mapping[event.key]) {
      event.preventDefault();

      this.flushPendingTap();

      this.triggerGesture(
        mapping[event.key]
      );
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();

      this.clearPendingTap();
      undoPinGesture();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();

      this.clearPendingTap();
      clearPinGestures();
    }
  }

  triggerGesture(gesture) {
    const normalized =
      normalizeGesture(gesture);

    if (!isValidGesture(normalized)) {
      return;
    }

    if (
      typeof this.onGestureDetected ===
      'function'
    ) {
      this.onGestureDetected(
        normalized
      );
    }
  }

  destroy() {
    this.clearPendingTap();

    if (!this.element) return;

    this.element.removeEventListener(
      'pointerdown',
      this.boundPointerDown
    );

    this.element.removeEventListener(
      'pointermove',
      this.boundPointerMove
    );

    this.element.removeEventListener(
      'pointerup',
      this.boundPointerUp
    );

    this.element.removeEventListener(
      'pointercancel',
      this.boundPointerCancel
    );

    this.element.removeEventListener(
      'keydown',
      this.boundKeyDown
    );

    this.element.classList.remove(
      'active-swiping'
    );
  }
}

/* ============================================================
   EIGHT-WAY DIRECTION CLASSIFICATION
============================================================ */

export function classifyDirection(
  deltaX,
  deltaY,
  minDistance = MIN_SWIPE_DISTANCE
) {
  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY)
  ) {
    return 'NONE';
  }

  if (
    Math.hypot(deltaX, deltaY) <
    minDistance
  ) {
    return 'NONE';
  }

  const angle =
    Math.atan2(
      deltaY,
      deltaX
    ) * 180 / Math.PI;

  if (
    angle >= -112.5 &&
    angle < -67.5
  ) {
    return 'UP';
  }

  if (
    angle >= -67.5 &&
    angle < -22.5
  ) {
    return 'UP_RIGHT';
  }

  if (
    angle >= -22.5 &&
    angle < 22.5
  ) {
    return 'RIGHT';
  }

  if (
    angle >= 22.5 &&
    angle < 67.5
  ) {
    return 'DOWN_RIGHT';
  }

  if (
    angle >= 67.5 &&
    angle < 112.5
  ) {
    return 'DOWN';
  }

  if (
    angle >= 112.5 &&
    angle < 157.5
  ) {
    return 'DOWN_LEFT';
  }

  if (
    angle >= -157.5 &&
    angle < -112.5
  ) {
    return 'UP_LEFT';
  }

  return 'LEFT';
}

/* ============================================================
   PIN CALLBACK
============================================================ */

export function setPinCompleteCallback(callback) {
  onPinCompleteCallback =
    typeof callback === 'function'
      ? callback
      : null;
}

/* ============================================================
   PIN ENTRY
============================================================ */

export function handlePinGesture(gesture) {
  ensurePinState();

  if (
    pinSubmissionPending ||
    state.enteredPin.length >= PIN_LENGTH
  ) {
    return;
  }

  const normalized =
    normalizeGesture(gesture);

  if (!isValidGesture(normalized)) {
    return;
  }

  state.enteredPin.push(
    normalized
  );

  const count =
    state.enteredPin.length;

  const haptic =
    normalized === 'DOUBLE_TAP'
      ? [40, 50, 40]
      : normalized === 'SINGLE_TAP'
        ? 40
        : normalized.includes('DOWN')
          ? 90
          : 70;

  // Never announce the actual digit or
  // direction during PIN verification.
  provideFeedback({
    text:
      `Gesture ${count} of ${PIN_LENGTH} registered.`,
    hapticPattern: haptic,
    hapticLabel:
      `PIN gesture ${count} accepted`,
    priority: false
  });

  updatePinSlotsVisual();

  if (count === PIN_LENGTH) {
    cancelInactivityTimer();
    cancelCompletionTimer();

    pinSubmissionPending = true;

    const completedSequence = [
      ...state.enteredPin
    ];

    const version = ++pinEntryVersion;

    completionTimer =
      setTimeout(() => {
        completionTimer = null;

        if (
          version !== pinEntryVersion ||
          !pinSubmissionPending
        ) {
          return;
        }

        if (
          typeof onPinCompleteCallback ===
          'function'
        ) {
          try {
            const result =
              onPinCompleteCallback(
                completedSequence
              );

            if (
              result &&
              typeof result.catch ===
              'function'
            ) {
              result.catch(error => {
                console.error(
                  '[PALMLOCK GESTURES] PIN callback failed:',
                  error
                );

                clearPinGestures(true);
              });
            }
          } catch (error) {
            console.error(
              '[PALMLOCK GESTURES] PIN callback failed:',
              error
            );

            clearPinGestures(true);
          }
        } else {
          clearPinGestures(true);
        }
      }, 250);
  } else {
    resetInactivityTimer();
  }
}

/* ============================================================
   UNDO
============================================================ */

export function undoPinGesture() {
  ensurePinState();

  if (pinSubmissionPending) {
    return;
  }

  if (state.enteredPin.length === 0) {
    return;
  }

  state.enteredPin.pop();

  updatePinSlotsVisual();

  if (state.enteredPin.length > 0) {
    resetInactivityTimer();
  } else {
    cancelInactivityTimer();
  }

  provideFeedback({
    text:
      'Last PIN gesture removed.',
    hapticPattern: 60,
    priority: false
  });
}

/* ============================================================
   CLEAR PIN
============================================================ */

export function clearPinGestures(
  silent = false
) {
  cancelInactivityTimer();
  cancelCompletionTimer();

  pinEntryVersion++;
  pinSubmissionPending = false;

  state.enteredPin = [];

  updatePinSlotsVisual();

  if (!silent) {
    provideFeedback({
      text:
        'PIN entry cleared.',
      hapticPattern: [50, 50, 50],
      priority: false
    });
  }
}

/* ============================================================
   INACTIVITY TIMEOUT
============================================================ */

function resetInactivityTimer() {
  cancelInactivityTimer();

  inactivityTimer =
    setTimeout(() => {
      ensurePinState();

      if (
        state.enteredPin.length > 0 &&
        state.enteredPin.length <
        PIN_LENGTH
      ) {
        clearPinGestures(true);

        provideFeedback({
          text:
            'PIN entry timed out. Please start again.',
          gesture: 'ERROR',
          priority: true
        });
      }
    }, INACTIVITY_TIMEOUT_MS);
}

/* ============================================================
   PIN SLOT DISPLAY
============================================================ */

function updatePinSlotsVisual() {
  ensurePinState();

  for (
    let index = 0;
    index < PIN_LENGTH;
    index++
  ) {
    const slot =
      document.getElementById(
        `pin-slot-${index}`
      );

    if (!slot) continue;

    const filled =
      index < state.enteredPin.length;

    slot.classList.toggle(
      'filled',
      filled
    );

    // Mask every gesture, including direction.
    slot.textContent =
      filled ? '●' : '–';

    slot.setAttribute(
      'aria-label',
      `PIN slot ${index + 1}: ` +
      (filled ? 'Filled' : 'Empty')
    );
  }
}

/* ============================================================
   SHAKE-TO-CLEAR
============================================================ */

export function setupShakeToClear(onShake) {
  if (
    typeof window === 'undefined' ||
    !window.DeviceMotionEvent
  ) {
    return;
  }

  let lastX = null;
  let lastY = null;
  let lastZ = null;
  let lastShakeTime = 0;

  const SHAKE_THRESHOLD = 22;
  const SHAKE_COOLDOWN_MS = 1500;

  window.addEventListener(
    'devicemotion',
    event => {
      if (
        !state.preferences
          ?.motionGesturesEnabled
      ) {
        return;
      }

      const acceleration =
        event.accelerationIncludingGravity;

      if (!acceleration) return;

      const x = acceleration.x;
      const y = acceleration.y;
      const z = acceleration.z;

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
      ) {
        return;
      }

      if (lastX === null) {
        lastX = x;
        lastY = y;
        lastZ = z;
        return;
      }

      const movement =
        Math.hypot(
          x - lastX,
          y - lastY,
          z - lastZ
        );

      lastX = x;
      lastY = y;
      lastZ = z;

      const now = Date.now();

      if (
        movement >= SHAKE_THRESHOLD &&
        now - lastShakeTime >=
        SHAKE_COOLDOWN_MS
      ) {
        lastShakeTime = now;

        if (
          typeof onShake ===
          'function'
        ) {
          onShake();
        } else {
          clearPinGestures();
        }
      }
    }
  );
}

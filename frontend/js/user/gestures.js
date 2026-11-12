/**
 * PALMLOCK — Touch Beyond Vision
 * Directional Gesture Engine: 4-Way Swipes, Tap Detection, Tactile Audio Feedback
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';

const MIN_SWIPE_DISTANCE = 35; // Pixels required to qualify as directional swipe
const MAX_TAP_DISTANCE = 15;   // Max pixel movement to qualify as a TAP
const MAX_TAP_DURATION = 400;  // Milliseconds

export class GestureRecognizer {
  constructor(element, onGestureDetected) {
    this.element = element;
    this.onGestureDetected = onGestureDetected;
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isTracking = false;

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
    // Prevent default scrolling on touch surfaces
    e.preventDefault();
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startTime = Date.now();
    this.isTracking = true;
    this.element.classList.add('active-swiping');
    
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if setPointerCapture unsupported
    }
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

    // Evaluate Tap
    if (absX <= MAX_TAP_DISTANCE && absY <= MAX_TAP_DISTANCE && duration <= MAX_TAP_DURATION) {
      this.triggerGesture('TAP');
      return;
    }

    // Evaluate Directional Swipe
    if (absX >= MIN_SWIPE_DISTANCE || absY >= MIN_SWIPE_DISTANCE) {
      if (absX > absY) {
        // Horizontal dominance
        if (deltaX > 0) {
          this.triggerGesture('RIGHT');
        } else {
          this.triggerGesture('LEFT');
        }
      } else {
        // Vertical dominance
        if (deltaY > 0) {
          this.triggerGesture('DOWN');
        } else {
          this.triggerGesture('UP');
        }
      }
    }
  }

  handlePointerCancel() {
    this.isTracking = false;
    this.element.classList.remove('active-swiping');
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
      case ' ':
      case 'Enter':
        e.preventDefault();
        this.triggerGesture('TAP');
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
 * Handle Gesture for PIN Verification Screen
 */
let onPinCompleteCallback = null;

export function setPinCompleteCallback(cb) {
  onPinCompleteCallback = cb;
}

export function handlePinGesture(gesture) {
  if (state.enteredPin.length >= 4) return;

  state.enteredPin.push(gesture);

  // Provide tactile and audio feedback
  provideFeedback({
    text: gesture,
    gesture: gesture,
    hapticPattern: gesture === 'TAP' ? 40 : 80,
    hapticLabel: `PIN Input: ${gesture}`,
    priority: true
  });

  updatePinSlotsVisual();

  // If 4 digits entered, evaluate PIN
  if (state.enteredPin.length === 4) {
    setTimeout(() => {
      if (onPinCompleteCallback) {
        onPinCompleteCallback([...state.enteredPin]);
      }
    }, 250);
  }
}

export function undoPinGesture() {
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
  state.enteredPin = [];
  updatePinSlotsVisual();
  provideFeedback({
    text: 'Cleared all entered gestures',
    gesture: 'ERROR',
    hapticPattern: [50, 50, 50],
    hapticLabel: 'PIN Cleared'
  });
}

function updatePinSlotsVisual() {
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`pin-slot-${i}`);
    if (!slot) continue;

    if (i < state.enteredPin.length) {
      const g = state.enteredPin[i];
      slot.classList.add('filled');
      // Visual arrow or bullet representation
      let symbol = '●';
      if (g === 'UP') symbol = '↑';
      if (g === 'DOWN') symbol = '↓';
      if (g === 'LEFT') symbol = '←';
      if (g === 'RIGHT') symbol = '→';
      if (g === 'TAP') symbol = '•';
      slot.textContent = symbol;
      slot.setAttribute('aria-label', `Slot ${i + 1}: ${g}`);
    } else {
      slot.classList.remove('filled');
      slot.textContent = '-';
      slot.setAttribute('aria-label', `Slot ${i + 1}: Empty`);
    }
  }
}

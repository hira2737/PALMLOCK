/**
 * PALMLOCK — Touch Beyond Vision
 * Accessibility Engine: Speech Synthesis, Audio Cues, Haptic Feedback & Display Tokens
 */

import { state } from './state.js';

// Web Audio Context for low-latency tactile audio tones
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a synthesized sound tone using the Web Audio API
 */
export function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
  if (!state.preferences.soundTonesEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('Audio tone play failure:', err);
  }
}

/**
 * Play specific audio signature for directional gestures
 */
export function playGestureAudio(gesture) {
  const ctx = getAudioContext();
  if (!ctx || !state.preferences.soundTonesEnabled) return;

  const now = ctx.currentTime;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    osc.connect(gain);

    switch (gesture) {
      case 'UP':
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;

      case 'DOWN':
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;

      case 'LEFT':
        playTone(400, 'square', 0.08, 0.1);
        setTimeout(() => playTone(350, 'square', 0.08, 0.1), 70);
        break;

      case 'RIGHT':
        playTone(600, 'sine', 0.08, 0.15);
        setTimeout(() => playTone(800, 'sine', 0.08, 0.15), 70);
        break;

      case 'TAP':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
        break;

      case 'SUCCESS':
        playTone(523.25, 'sine', 0.15, 0.15); // C5
        setTimeout(() => playTone(659.25, 'sine', 0.15, 0.15), 100); // E5
        setTimeout(() => playTone(783.99, 'sine', 0.25, 0.2), 200); // G5
        break;

      case 'ERROR':
        playTone(220, 'sawtooth', 0.25, 0.2);
        setTimeout(() => playTone(180, 'sawtooth', 0.35, 0.25), 180);
        break;

      case 'RADAR_PING':
        playTone(880, 'sine', 0.05, 0.08);
        break;
    }
  } catch (err) {
    console.warn('Audio tone error:', err);
  }
}

/**
 * Text-to-Speech Output via Web Speech API
 */
export function speak(text, priority = false) {
  if (!state.preferences.speechEnabled) return;
  if (!('speechSynthesis' in window)) return;

  if (priority) {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.preferences.speechRate || 1.0;
  utterance.pitch = state.preferences.speechPitch || 1.0;
  utterance.lang = 'en-US';

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Tactile Vibration Trigger with Desktop Visual Fallback
 */
export function triggerHaptic(pattern = 80, label = 'Tactile Pulse') {
  if (!state.preferences.hapticEnabled) return;

  // Physical device vibration
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration permission or browser sandbox restrictions
    }
  }

  // Visual feedback badge for desktop and environments without vibration motors
  showVisualHapticIndicator(label);
}

let hapticTimeout = null;
function showVisualHapticIndicator(text) {
  const indicator = document.getElementById('haptic-visual-indicator');
  if (!indicator) return;

  indicator.textContent = `Vibration: ${text}`;
  indicator.style.display = 'block';

  clearTimeout(hapticTimeout);
  hapticTimeout = setTimeout(() => {
    indicator.style.display = 'none';
  }, 1200);
}

/**
 * ARIA Live Announcements for Screen Readers
 */
export function announcePolite(message) {
  const el = document.getElementById('aria-live-polite');
  if (el) {
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 50);
  }
}

export function announceAssertive(message) {
  const el = document.getElementById('aria-live-assertive');
  if (el) {
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 50);
  }
}

/**
 * Combined Accessible Feedback: Speech + Tone + Haptics + ARIA
 */
export function provideFeedback({ text, gesture, hapticPattern, hapticLabel, priority = false }) {
  if (text) {
    announcePolite(text);
    speak(text, priority);
  }
  if (gesture) {
    playGestureAudio(gesture);
  }
  if (hapticPattern) {
    triggerHaptic(hapticPattern, hapticLabel || `${gesture || 'Action'} (${hapticPattern}ms)`);
  }
}

/**
 * Theme Management
 */
const THEMES = ['default', 'yellow-black', 'white-black', 'light-blue'];

export function setTheme(themeName) {
  if (!THEMES.includes(themeName)) themeName = 'default';
  state.preferences.theme = themeName;
  document.body.setAttribute('data-theme', themeName);

  const themeSelect = document.getElementById('settings-theme-select');
  if (themeSelect) themeSelect.value = themeName;

  provideFeedback({
    text: `Color theme set to ${themeName.replace('-', ' ')}`,
    hapticPattern: 40,
    hapticLabel: 'Theme Changed'
  });
}

export function cycleTheme() {
  const currentIndex = THEMES.indexOf(state.preferences.theme);
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
  setTheme(nextTheme);
}

/**
 * Font Size Scaling
 */
const FONT_SIZES = ['standard', 'large', 'xlarge'];

export function setFontSize(sizeName) {
  if (!FONT_SIZES.includes(sizeName)) sizeName = 'standard';
  state.preferences.fontSize = sizeName;
  document.body.setAttribute('data-font-size', sizeName);

  const fontSelect = document.getElementById('settings-font-select');
  if (fontSelect) fontSelect.value = sizeName;

  provideFeedback({
    text: `Text sizing changed to ${sizeName}`,
    hapticPattern: 40,
    hapticLabel: 'Text Scaled'
  });
}

export function cycleFontSize() {
  const currentIndex = FONT_SIZES.indexOf(state.preferences.fontSize);
  const nextSize = FONT_SIZES[(currentIndex + 1) % FONT_SIZES.length];
  setFontSize(nextSize);
}

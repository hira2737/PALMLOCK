/**
 * PALMLOCK — Security Operations Center (SOC)
 * Emergency Alert Audio Synthesizer (Web Audio API)
 */

import { adminState } from './state.js';

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
 * Play Synthesized Two-Tone Emergency Siren
 */
export function playEmergencySiren() {
  if (!adminState.sirenAudioEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // Frequency modulation: urgent two-tone alarm siren
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(1050, now + 0.15);
    osc.frequency.linearRampToValueAtTime(800, now + 0.30);
    osc.frequency.linearRampToValueAtTime(1050, now + 0.45);
    osc.frequency.linearRampToValueAtTime(800, now + 0.60);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  } catch (err) {
    console.warn('Web Audio Siren unavailable:', err);
  }
}

/**
 * Play Subtle Confirmation Chime
 */
export function playAcknowledgeChime() {
  if (!adminState.sirenAudioEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.00, now + 0.1); // A5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    console.warn('Web Audio Chime error:', err);
  }
}

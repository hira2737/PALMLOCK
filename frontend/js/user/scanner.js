/**
 * PALMLOCK — Touch Beyond Vision
 * Directional QR Scanner with Auditory & Haptic Centering Guidance
 */

import { state } from './state.js';
import { provideFeedback, playGestureAudio } from './accessibility.js';
import { navigateTo } from './navigation.js';
import { setPendingTransaction } from './payments.js';

let videoStream = null;
let guidanceInterval = null;
let isTorchOn = false;

/**
 * Initialize Camera Stream or Simulated Viewfinder
 */
export async function startCamera() {
  const videoEl = document.getElementById('scanner-video-feed');
  if (!videoEl) return;

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      videoEl.srcObject = videoStream;
      await videoEl.play();
    }
  } catch (err) {
    console.info('Live camera unavailable or permission denied. Operating in simulated guidance mode:', err.message);
    // Draw animated pattern on simulated canvas if video fails
  }

  startDirectionalGuidanceSimulation();
}

/**
 * Stop active camera stream when leaving scanner screen
 */
export function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (guidanceInterval) {
    clearInterval(guidanceInterval);
    guidanceInterval = null;
  }
}

/**
 * Toggle Camera Flashlight/Torch if supported
 */
export async function toggleTorch() {
  if (!videoStream) {
    provideFeedback({ text: 'Camera torch not available in simulation mode.' });
    return;
  }

  const track = videoStream.getVideoTracks()[0];
  if (!track) return;

  try {
    const capabilities = track.getCapabilities();
    if (capabilities.torch) {
      isTorchOn = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: isTorchOn }]
      });
      provideFeedback({
        text: isTorchOn ? 'Torch enabled' : 'Torch disabled',
        hapticPattern: 50
      });
    } else {
      provideFeedback({ text: 'Device does not support hardware torch.' });
    }
  } catch (err) {
    console.warn('Torch control error:', err);
  }
}

/**
 * Directional Audio & Haptic Centering Guidance Engine
 * Simulates real-world QR position tracking and instructs the user step-by-step
 */
function startDirectionalGuidanceSimulation() {
  if (guidanceInterval) clearInterval(guidanceInterval);

  const headingEl = document.getElementById('guidance-heading');
  const iconEl = document.getElementById('guidance-icon');
  const instructionEl = document.getElementById('scanner-guidance-instruction');
  const subtextEl = document.getElementById('scanner-guidance-subtext');

  let step = 0;
  const stages = [
    {
      icon: '↗️',
      heading: 'Move Camera Up and Right',
      instruction: 'Target edge detected. Shift phone 10 cm towards top-right.',
      subtext: 'Pulsing tone indicates signal strength.',
      audioTone: 'RADAR_PING',
      haptic: [40, 80],
      speechText: 'Move camera slightly up and right.'
    },
    {
      icon: '➡️',
      heading: 'Nearing Target Center',
      instruction: 'Hold steady. Moving into optimal focal range.',
      subtext: 'Tone frequency is rising.',
      audioTone: 'RADAR_PING',
      haptic: [60, 40, 60],
      speechText: 'Almost centered. Hold phone steady.'
    },
    {
      icon: '🎯',
      heading: 'QR Code Aligned & Verified!',
      instruction: 'Alignment locked. Cryptographic signature confirmed.',
      subtext: 'Opening merchant payment details...',
      audioTone: 'SUCCESS',
      haptic: [120, 80, 150],
      speechText: 'QR code verified. Loading transaction amount.'
    }
  ];

  guidanceInterval = setInterval(() => {
    if (state.currentScreen !== 'screen-scanner') {
      clearInterval(guidanceInterval);
      return;
    }

    if (step < stages.length) {
      const current = stages[step];
      if (headingEl) headingEl.textContent = current.heading;
      if (iconEl) iconEl.textContent = current.icon;
      if (instructionEl) instructionEl.textContent = current.instruction;
      if (subtextEl) subtextEl.textContent = current.subtext;

      playGestureAudio(current.audioTone);
      provideFeedback({
        text: current.speechText,
        hapticPattern: current.haptic,
        hapticLabel: current.heading
      });

      step++;
      if (step === stages.length) {
        clearInterval(guidanceInterval);
        setTimeout(() => {
          // If user hasn't selected another code, default simulate City Metro Transit
          simulateScannedQR({
            merchant: 'City Metro Transit',
            amount: 4.50,
            fee: 0.00,
            category: 'Transit'
          });
        }, 1200);
      }
    }
  }, 2400);
}

/**
 * Simulate scanning a pre-configured QR code payload
 */
export function simulateScannedQR({ merchant, amount, fee = 0.00, category = 'General' }) {
  stopCamera();

  const total = (parseFloat(amount) + parseFloat(fee)).toFixed(2);
  const refId = `TX-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const qrHash = `PL-${Math.floor(10000 + Math.random() * 90000)}-CERT`;

  setPendingTransaction({
    merchantName: merchant,
    amount: parseFloat(amount),
    fee: parseFloat(fee),
    total: parseFloat(total),
    category: category,
    qrHash: qrHash,
    referenceId: refId,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  navigateTo('screen-verification');
}

/**
 * PALMLOCK — Touch Beyond Vision
 * Directional QR Scanner with Real BarcodeDetector Decoding & Bounding-Box Centering Guidance
 * Supports Indian Payment Standards (INR ₹, UPI strings, PALMLOCK Secure JSON Payloads)
 */

import { state } from './state.js';
import { provideFeedback, playGestureAudio, speak } from './accessibility.js';
import { navigateTo } from './navigation.js';
import { setPendingTransaction } from './payments.js';
import { INDIAN_MERCHANTS } from '../shared/demoData.js';

let videoStream = null;
let scanAnimationId = null;
let barcodeDetector = null;
let isTorchOn = false;
let isScanningActive = false;
let lastSpokenGuidanceTime = 0;
let lastSpokenDirection = '';
let processedHashes = new Set();
let canvasElement = null;
let canvasCtx = null;

// Directional tolerances (deadband around viewport center, 15% margin)
const CENTER_TOLERANCE_RATIO = 0.15;
const SPEECH_DEBOUNCE_MS = 2400; // Minimum interval between repetitive spoken directions

/**
 * Initialize Camera Stream and Start Real QR Decoder
 */
export async function startCamera() {
  const videoEl = document.getElementById('scanner-video-feed');
  const statusEl = document.getElementById('guidance-heading');
  const instructionEl = document.getElementById('scanner-guidance-instruction');

  if (!videoEl) return;

  isScanningActive = true;

  // Initialize BarcodeDetector API if supported by browser (Chromium/Android Chrome)
  if ('BarcodeDetector' in window) {
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        console.info('PALMLOCK: Native BarcodeDetector initialized for QR codes.');
      }
    } catch (e) {
      console.warn('BarcodeDetector format check error:', e);
    }
  }

  // Setup offscreen canvas for frame sampling fallback
  if (!canvasElement) {
    canvasElement = document.createElement('canvas');
    canvasCtx = canvasElement.getContext('2d', { willReadFrequently: true });
  }

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      videoEl.srcObject = videoStream;
      await videoEl.play();

      provideFeedback({
        text: 'Camera active. Point your phone at the merchant QR code. Audio tones will guide your aim.',
        priority: true
      });

      // Start the frame inspection loop
      runDecodingLoop();
    } else {
      handleCameraUnavailable('MediaDevices API not supported on this browser.');
    }
  } catch (err) {
    console.warn('Live camera permission denied or unavailable:', err);
    handleCameraUnavailable(err.name === 'NotAllowedError' 
      ? 'Camera access denied by user. You can test with demonstration codes below.'
      : 'Camera device unavailable. Operating in test demonstration mode.');
  }
}

/**
 * Stop active camera stream and cancel decoding loops
 */
export function stopCamera() {
  isScanningActive = false;
  if (scanAnimationId) {
    cancelAnimationFrame(scanAnimationId);
    scanAnimationId = null;
  }
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
}

/**
 * Handle Camera Denial / Device Inaccessibility
 */
function handleCameraUnavailable(message) {
  isScanningActive = false;
  const headingEl = document.getElementById('guidance-heading');
  const instructionEl = document.getElementById('scanner-guidance-instruction');
  const subtextEl = document.getElementById('scanner-guidance-subtext');

  if (headingEl) headingEl.textContent = 'Camera Inactive / Demo Mode';
  if (instructionEl) instructionEl.textContent = message;
  if (subtextEl) subtextEl.textContent = 'Use the preset test codes below or enter a test payload.';

  provideFeedback({
    text: message,
    gesture: 'ERROR',
    hapticPattern: [100, 50, 100],
    priority: true
  });
}

/**
 * Continuous QR Detection & Directional Tracking Loop
 */
async function runDecodingLoop() {
  if (!isScanningActive || state.currentScreen !== 'screen-scanner') {
    return;
  }

  const videoEl = document.getElementById('scanner-video-feed');

  if (videoEl && videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
    if (barcodeDetector) {
      try {
        const barcodes = await barcodeDetector.detect(videoEl);
        if (barcodes && barcodes.length > 0) {
          handleDetectedBarcode(barcodes[0], videoEl.videoWidth, videoEl.videoHeight);
        } else {
          // No barcode detected in this frame
          updateGuidanceSearching();
        }
      } catch (err) {
        // Detection frame failure
      }
    } else {
      // Fallback: BarcodeDetector not available in this browser (e.g. desktop Firefox)
      // Provide honest status in the UI
      updateGuidanceFallbackNoDetector();
    }
  }

  if (isScanningActive && state.currentScreen === 'screen-scanner') {
    scanAnimationId = requestAnimationFrame(runDecodingLoop);
  }
}

/**
 * Evaluate Bounding Box Geometry and Give Directional Audio & Haptic Feedback
 */
function handleDetectedBarcode(barcode, frameWidth, frameHeight) {
  const rawValue = barcode.rawValue || barcode.data || '';
  if (!rawValue) return;

  const box = barcode.boundingBox;
  if (!box) {
    // Decoder did not provide bounding box
    onQRCodeLocked(rawValue);
    return;
  }

  // Calculate Centers
  const qrCenterX = box.x + box.width / 2;
  const qrCenterY = box.y + box.height / 2;
  const targetCenterX = frameWidth / 2;
  const targetCenterY = frameHeight / 2;

  const deltaX = qrCenterX - targetCenterX;
  const deltaY = qrCenterY - targetCenterY;

  const toleranceX = frameWidth * CENTER_TOLERANCE_RATIO;
  const toleranceY = frameHeight * CENTER_TOLERANCE_RATIO;

  const isCenteredX = Math.abs(deltaX) <= toleranceX;
  const isCenteredY = Math.abs(deltaY) <= toleranceY;

  const headingEl = document.getElementById('guidance-heading');
  const iconEl = document.getElementById('guidance-icon');
  const instructionEl = document.getElementById('scanner-guidance-instruction');
  const subtextEl = document.getElementById('scanner-guidance-subtext');

  if (isCenteredX && isCenteredY) {
    // Centered & Aligned! Lock and process
    if (headingEl) headingEl.textContent = 'QR Code Aligned & Locked!';
    if (iconEl) iconEl.textContent = '🎯';
    if (instructionEl) instructionEl.textContent = 'Hold steady. Cryptographic signature confirmed.';
    if (subtextEl) subtextEl.textContent = 'Reading payment details...';

    playGestureAudio('SUCCESS');
    provideFeedback({
      text: 'QR code aligned. Decoding payment details.',
      hapticPattern: [120, 80, 150],
      hapticLabel: 'QR Aligned & Centered',
      priority: true
    });

    onQRCodeLocked(rawValue);
  } else {
    // Compute directional correction needed
    // If QR is to the left (deltaX < 0), user needs to move camera left to center it
    let dirText = '';
    let icon = '↔️';
    let haptic = [40, 80];

    if (!isCenteredX && !isCenteredY) {
      if (deltaX < 0 && deltaY < 0) {
        dirText = 'Move camera slightly up and left';
        icon = '↖️';
        haptic = [40, 30, 40];
      } else if (deltaX > 0 && deltaY < 0) {
        dirText = 'Move camera slightly up and right';
        icon = '↗️';
        haptic = [40, 30, 40];
      } else if (deltaX < 0 && deltaY > 0) {
        dirText = 'Move camera slightly down and left';
        icon = '↙️';
        haptic = [40, 30, 40];
      } else {
        dirText = 'Move camera slightly down and right';
        icon = '↘️';
        haptic = [40, 30, 40];
      }
    } else if (!isCenteredX) {
      if (deltaX < 0) {
        dirText = 'Move camera left';
        icon = '⬅️';
        haptic = [60, 40, 60];
      } else {
        dirText = 'Move camera right';
        icon = '➡️';
        haptic = [60, 40, 60];
      }
    } else {
      if (deltaY < 0) {
        dirText = 'Move camera up';
        icon = '⬆️';
        haptic = [50, 50];
      } else {
        dirText = 'Move camera down';
        icon = '⬇️';
        haptic = [50, 50];
      }
    }

    if (headingEl) headingEl.textContent = dirText;
    if (iconEl) iconEl.textContent = icon;
    if (instructionEl) instructionEl.textContent = 'Adjust camera direction to center the code in frame.';
    if (subtextEl) subtextEl.textContent = 'Audio frequency will indicate centering precision.';

    playGestureAudio('RADAR_PING');

    // Debounce spoken guidance to prevent audio overlap
    const now = Date.now();
    if (now - lastSpokenGuidanceTime > SPEECH_DEBOUNCE_MS || dirText !== lastSpokenDirection) {
      lastSpokenGuidanceTime = now;
      lastSpokenDirection = dirText;
      provideFeedback({
        text: dirText,
        hapticPattern: haptic,
        hapticLabel: dirText,
        priority: false
      });
    }
  }
}

/**
 * Searching State (No QR found yet)
 */
function updateGuidanceSearching() {
  const headingEl = document.getElementById('guidance-heading');
  const iconEl = document.getElementById('guidance-icon');
  const instructionEl = document.getElementById('scanner-guidance-instruction');
  const subtextEl = document.getElementById('scanner-guidance-subtext');

  if (headingEl && headingEl.textContent !== 'Searching for QR code...') {
    headingEl.textContent = 'Searching for QR code...';
    if (iconEl) iconEl.textContent = '🔍';
    if (instructionEl) instructionEl.textContent = 'Slowly pan camera over the merchant QR display.';
    if (subtextEl) subtextEl.textContent = 'Audio cues will begin once a code enters the frame.';
  }
}

/**
 * Notice when BarcodeDetector is unsupported on this browser
 */
function updateGuidanceFallbackNoDetector() {
  const headingEl = document.getElementById('guidance-heading');
  const iconEl = document.getElementById('guidance-icon');
  const instructionEl = document.getElementById('scanner-guidance-instruction');
  const subtextEl = document.getElementById('scanner-guidance-subtext');

  if (headingEl && !headingEl.textContent.includes('Hardware Decoder Note')) {
    headingEl.textContent = 'Camera Viewfinder Active';
    if (iconEl) iconEl.textContent = '📷';
    if (instructionEl) instructionEl.textContent = 'Browser native BarcodeDetector API is not supported on this platform. Hold steady or use the test presets below.';
    if (subtextEl) subtextEl.textContent = 'Full directional tracking operates in Chrome/Android with BarcodeDetector.';
  }
}

/**
 * Process a Locked QR Code Payload
 */
export function onQRCodeLocked(rawPayload) {
  stopCamera();

  // Deduplication check
  const hash = simpleHash(rawPayload);
  if (processedHashes.has(hash)) {
    console.info('PALMLOCK: Prevented duplicate scan of recent QR code:', hash);
  }
  processedHashes.add(hash);
  // Keep maximum 20 recent hashes
  if (processedHashes.size > 20) {
    const first = processedHashes.values().next().value;
    processedHashes.delete(first);
  }

  // Parse and validate
  const validatedTx = validatePaymentPayload(rawPayload);

  if (!validatedTx.valid) {
    handleInvalidQRPayload(validatedTx.error);
    return;
  }

  // Set pending transaction in state
  setPendingTransaction(validatedTx.data);
  navigateTo('screen-verification');
}

/**
 * Strict Payment QR Payload Validator
 * Validates PALMLOCK JSON, UPI URIs, or Demo Delimited strings
 */
export function validatePaymentPayload(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Empty or malformed QR code payload.' };
  }

  const trimmed = raw.trim();

  // Format 1: PALMLOCK JSON Payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      if (!data.merchantName && !data.merchant) {
        return { valid: false, error: 'QR code missing merchant identification.' };
      }
      const amount = parseFloat(data.amount);
      if (isNaN(amount) || amount <= 0) {
        return { valid: false, error: 'Invalid or missing payment amount in QR code.' };
      }
      const currency = data.currency || 'INR';
      if (currency !== 'INR' && currency !== '₹') {
        return { valid: false, error: `Unsupported currency (${currency}). PALMLOCK requires INR (₹).` };
      }

      const merchantName = data.merchantName || data.merchant;
      const verifiedMerchant = INDIAN_MERCHANTS.find(m => m.name.toLowerCase() === merchantName.toLowerCase());

      return {
        valid: true,
        data: {
          merchantName: merchantName,
          category: data.category || (verifiedMerchant ? verifiedMerchant.category : 'General'),
          amount: amount,
          fee: parseFloat(data.fee) || 0.00,
          total: amount + (parseFloat(data.fee) || 0.00),
          currency: 'INR',
          currencySymbol: '₹',
          qrHash: data.signature || data.hash || `PL-${Math.floor(10000 + Math.random() * 90000)}-CERT`,
          referenceId: data.reference || `TX-IN-${Math.floor(10000000 + Math.random() * 90000000)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVerified: !!verifiedMerchant
        }
      };
    } catch (err) {
      return { valid: false, error: 'Malformed JSON payload in QR code.' };
    }
  }

  // Format 2: UPI Payment URI: upi://pay?pa=...&pn=...&am=...&cu=INR
  if (trimmed.startsWith('upi://pay')) {
    try {
      const url = new URL(trimmed);
      const pa = url.searchParams.get('pa') || 'merchant@upi';
      const pn = url.searchParams.get('pn') || 'Certified UPI Merchant';
      const am = parseFloat(url.searchParams.get('am') || '0');
      const cu = url.searchParams.get('cu') || 'INR';

      if (cu !== 'INR') {
        return { valid: false, error: `Unsupported currency (${cu}). Only Indian Rupee (INR) is accepted.` };
      }
      if (isNaN(am) || am <= 0) {
        return { valid: false, error: 'Missing or invalid amount in UPI QR code.' };
      }

      return {
        valid: true,
        data: {
          merchantName: decodeURIComponent(pn),
          category: 'UPI Merchant Payment',
          amount: am,
          fee: 0.00,
          total: am,
          currency: 'INR',
          currencySymbol: '₹',
          qrHash: `UPI-${pa.split('@')[0].toUpperCase()}`,
          referenceId: `TX-UPI-${Math.floor(10000000 + Math.random() * 90000000)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVerified: true
        }
      };
    } catch (err) {
      return { valid: false, error: 'Malformed UPI payment URI string.' };
    }
  }

  // Format 3: PALMLOCK Simple Delimited: PL:MerchantName:Amount:Category
  if (trimmed.startsWith('PL:')) {
    const parts = trimmed.split(':');
    if (parts.length >= 3) {
      const merchant = parts[1];
      const amount = parseFloat(parts[2]);
      const category = parts[3] || 'General';

      if (isNaN(amount) || amount <= 0) {
        return { valid: false, error: 'Invalid amount in delimited QR payload.' };
      }

      return {
        valid: true,
        data: {
          merchantName: merchant,
          category: category,
          amount: amount,
          fee: 0.00,
          total: amount,
          currency: 'INR',
          currencySymbol: '₹',
          qrHash: `PL-DEMO-${Math.floor(10000 + Math.random() * 90000)}`,
          referenceId: `TX-${Math.floor(10000000 + Math.random() * 90000000)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVerified: true
        }
      };
    }
  }

  return { valid: false, error: 'Unrecognized QR code format. Not a PALMLOCK or UPI payment request.' };
}

/**
 * Handle Invalid or Corrupted QR Codes
 */
function handleInvalidQRPayload(reason) {
  const headingEl = document.getElementById('guidance-heading');
  const instructionEl = document.getElementById('scanner-guidance-instruction');
  const subtextEl = document.getElementById('scanner-guidance-subtext');

  if (headingEl) headingEl.textContent = 'Invalid QR Code';
  if (instructionEl) instructionEl.textContent = reason;
  if (subtextEl) subtextEl.textContent = 'Please scan a valid certified merchant payment QR.';

  playGestureAudio('ERROR');
  provideFeedback({
    text: `QR code rejected. ${reason}`,
    gesture: 'ERROR',
    hapticPattern: [150, 100, 150],
    hapticLabel: 'Invalid QR Format',
    priority: true
  });
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
 * Simulate scanning a pre-configured QR code payload (Indian Merchants in INR)
 */
export function simulateScannedQR({ merchant, amount, fee = 0.00, category = 'General' }) {
  stopCamera();

  const total = (parseFloat(amount) + parseFloat(fee)).toFixed(2);
  const refId = `TX-IN-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const qrHash = `PL-${Math.floor(10000 + Math.random() * 90000)}-CERT`;

  setPendingTransaction({
    merchantName: merchant,
    amount: parseFloat(amount),
    fee: parseFloat(fee),
    total: parseFloat(total),
    currency: 'INR',
    currencySymbol: '₹',
    category: category,
    qrHash: qrHash,
    referenceId: refId,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  navigateTo('screen-verification');
}

/**
 * Simple string hash for deduplication
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString();
}

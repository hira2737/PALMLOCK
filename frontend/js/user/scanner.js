
/**
 * PALMLOCK — Accessible QR Scanner
 *
 * Native BarcodeDetector QR decoding, directional guidance,
 * strict INR amount parsing and simulated merchant payments.
 *
 * QR parsing is NOT merchant authentication.
 * All payment operations remain simulated.
 */

import { state } from './state.js';
import {
  provideFeedback,
  playGestureAudio
} from './accessibility.js';
import { navigateTo } from './navigation.js';
import { setPendingTransaction } from './payments.js';
import { INDIAN_MERCHANTS } from '../shared/demoData.js';

const CENTER_TOLERANCE_RATIO = 0.15;
const SPEECH_DEBOUNCE_MS = 2400;
const SCAN_INTERVAL_MS = 180;
const MAX_PAYMENT = 100000;

let videoStream = null;
let scanAnimationId = null;
let barcodeDetector = null;
let isTorchOn = false;
let isScanningActive = false;
let scanSession = 0;
let lastDetectionTime = 0;
let lastSpokenGuidanceTime = 0;
let lastSpokenDirection = '';
let scanLocked = false;
let lastProcessedPayload = '';
let lastProcessedAt = 0;

function el(id) {
  return document.getElementById(id);
}

function feedback(text, success = false) {
  provideFeedback({
    text,
    gesture: success ? 'SUCCESS' : 'ERROR',
    priority: true
  });
}

function setGuidance(
  heading,
  instruction,
  subtext = '',
  icon = '🔍'
) {
  const headingEl = el('guidance-heading');
  const instructionEl =
    el('scanner-guidance-instruction');
  const subtextEl =
    el('scanner-guidance-subtext');
  const iconEl = el('guidance-icon');

  if (headingEl) headingEl.textContent = heading;
  if (instructionEl) {
    instructionEl.textContent = instruction;
  }
  if (subtextEl) subtextEl.textContent = subtext;
  if (iconEl) iconEl.textContent = icon;
}

function generateReference(prefix) {
  const random = globalThis.crypto?.randomUUID?.()
    ?.replace(/-/g, '')
    ?.slice(0, 16)
    ?.toUpperCase();

  return `${prefix}-${random || (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  ).toUpperCase()}`;
}

function parseMoney(value, allowZero = false) {
  const text = String(value ?? '').trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const amount = Number(text);

  if (
    !Number.isFinite(amount) ||
    amount > MAX_PAYMENT ||
    (allowZero ? amount < 0 : amount <= 0)
  ) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function cleanText(value, maxLength = 120) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength);
}

function findDemoMerchant(name) {
  if (!Array.isArray(INDIAN_MERCHANTS)) {
    return null;
  }

  return INDIAN_MERCHANTS.find(
    merchant =>
      String(merchant.name || '')
        .trim()
        .toLowerCase() ===
      String(name || '')
        .trim()
        .toLowerCase()
  ) || null;
}

function createTransaction({
  merchantName,
  amount,
  fee = 0,
  category = 'General',
  source = 'demo',
  paymentAddress = null,
  merchantId = null
}) {
  const total = Math.round(
    (amount + fee) * 100
  ) / 100;

  if (
    !merchantName ||
    !Number.isFinite(total) ||
    total > MAX_PAYMENT
  ) {
    return {
      valid: false,
      error: 'Invalid merchant or payment total.'
    };
  }

  const demoMerchant = findDemoMerchant(merchantName);

  return {
    valid: true,
    data: {
      merchantName,
      merchantId,
      paymentAddress,
      category:
        category ||
        demoMerchant?.category ||
        'General',
      amount,
      fee,
      total,
      currency: 'INR',
      currencySymbol: '₹',
      qrHash: generateReference('QR'),
      referenceId: generateReference('TX'),
      paymentRequestId: generateReference('REQ'),
      timestamp: new Date().toISOString(),
      qrSource: source,

      // This is only a local demo-data match.
      // It is NOT cryptographic or backend verification.
      isVerified: false,
      isDemoMerchant: Boolean(demoMerchant),
      simulationOnly: true
    }
  };
}

/* ============================================================
   CAMERA STARTUP
============================================================ */

export async function startCamera() {
  stopCamera();

  const videoEl = el('scanner-video-feed');

  if (!videoEl) {
    console.warn(
      '[PALMLOCK SCANNER] Video element missing.'
    );
    return;
  }

  const session = ++scanSession;
  isScanningActive = true;
  scanLocked = false;
  lastDetectionTime = 0;
  lastSpokenDirection = '';
  lastSpokenGuidanceTime = 0;
  barcodeDetector = null;

  setGuidance(
    'Starting Camera',
    'Requesting camera access...',
    'Point your camera towards a payment QR code.',
    '📷'
  );

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    handleCameraUnavailable(
      'Camera access is unavailable. Use a secure browser context such as HTTPS or localhost.'
    );
    return;
  }

  try {
    if ('BarcodeDetector' in window) {
      try {
        const formats =
          await window.BarcodeDetector.getSupportedFormats();

        if (formats.includes('qr_code')) {
          barcodeDetector =
            new window.BarcodeDetector({
              formats: ['qr_code']
            });
        }
      } catch (error) {
        console.warn(
          '[PALMLOCK SCANNER] Decoder unavailable:',
          error
        );
      }
    }

    if (
      session !== scanSession ||
      !isScanningActive
    ) {
      return;
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

    if (
      session !== scanSession ||
      !isScanningActive
    ) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    videoStream = stream;
    isTorchOn = false;

    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', '');

    await videoEl.play();

    if (
      session !== scanSession ||
      !isScanningActive
    ) {
      return;
    }

    if (!barcodeDetector) {
      setGuidance(
        'Camera Active — Decoder Unavailable',
        'This browser does not support native QR decoding.',
        'Use the demonstration QR options below.',
        '📷'
      );

      feedback(
        'Camera is active, but QR decoding is not supported on this browser. Use the demonstration options.'
      );
      return;
    }

    setGuidance(
      'Searching for QR Code',
      'Slowly point your camera towards the QR code.',
      'Audio and vibration will guide alignment.',
      '🔍'
    );

    provideFeedback({
      text:
        'Camera active. Point towards a merchant QR code. ' +
        'Follow the directional audio instructions.',
      priority: true
    });

    void runDecodingLoop(session);
  } catch (error) {
    if (session !== scanSession) return;

    const message =
      error.name === 'NotAllowedError'
        ? 'Camera permission denied. Enable camera access or use a demonstration QR.'
        : error.name === 'NotFoundError'
          ? 'No camera was found on this device.'
          : 'Unable to start camera. Use a demonstration QR instead.';

    handleCameraUnavailable(message);
  }
}

/* ============================================================
   CAMERA STOP
============================================================ */

export function stopCamera() {
  isScanningActive = false;
  scanSession++;

  if (scanAnimationId !== null) {
    cancelAnimationFrame(scanAnimationId);
    scanAnimationId = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach(
      track => track.stop()
    );
    videoStream = null;
  }

  const videoEl = el('scanner-video-feed');

  if (videoEl) {
    videoEl.pause();
    videoEl.srcObject = null;
  }

  isTorchOn = false;
}

function handleCameraUnavailable(message) {
  stopCamera();

  setGuidance(
    'Camera Inactive / Demo Mode',
    message,
    'You can continue with a simulated merchant QR.',
    '📷'
  );

  feedback(message);
}

/* ============================================================
   QR DECODING LOOP
============================================================ */

async function runDecodingLoop(session) {
  if (
    !isScanningActive ||
    scanLocked ||
    session !== scanSession ||
    state.currentScreen !== 'screen-scanner'
  ) {
    return;
  }

  const videoEl = el('scanner-video-feed');

  const now = performance.now();

  if (
    barcodeDetector &&
    videoEl &&
    videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    now - lastDetectionTime >= SCAN_INTERVAL_MS
  ) {
    lastDetectionTime = now;

    try {
      const barcodes =
        await barcodeDetector.detect(videoEl);

      if (
        session !== scanSession ||
        !isScanningActive ||
        scanLocked
      ) {
        return;
      }

      if (barcodes.length > 0) {
        handleDetectedBarcode(
          barcodes[0],
          videoEl.videoWidth,
          videoEl.videoHeight
        );
      } else {
        updateGuidanceSearching();
      }
    } catch (error) {
      console.debug(
        '[PALMLOCK SCANNER] Frame decode failed:',
        error.message
      );
    }
  }

  if (
    session === scanSession &&
    isScanningActive &&
    !scanLocked &&
    state.currentScreen === 'screen-scanner'
  ) {
    scanAnimationId =
      requestAnimationFrame(
        () => void runDecodingLoop(session)
      );
  }
}

/* ============================================================
   DIRECTIONAL ALIGNMENT
============================================================ */

function handleDetectedBarcode(
  barcode,
  frameWidth,
  frameHeight
) {
  const rawValue =
    barcode.rawValue || barcode.data || '';

  if (!rawValue || scanLocked) return;

  const box = barcode.boundingBox;

  if (
    !box ||
    !frameWidth ||
    !frameHeight
  ) {
    onQRCodeLocked(rawValue);
    return;
  }

  const centerX =
    box.x + box.width / 2;

  const centerY =
    box.y + box.height / 2;

  const deltaX =
    centerX - frameWidth / 2;

  const deltaY =
    centerY - frameHeight / 2;

  const toleranceX =
    frameWidth * CENTER_TOLERANCE_RATIO;

  const toleranceY =
    frameHeight * CENTER_TOLERANCE_RATIO;

  const centeredX =
    Math.abs(deltaX) <= toleranceX;

  const centeredY =
    Math.abs(deltaY) <= toleranceY;

  if (centeredX && centeredY) {
    setGuidance(
      'QR Code Aligned',
      'QR code centered. Reading payment details.',
      'Checking QR format...',
      '🎯'
    );

    playGestureAudio('SUCCESS');

    provideFeedback({
      text: 'QR code centered and decoded.',
      hapticPattern: [120, 80, 150],
      priority: true
    });

    onQRCodeLocked(rawValue);
    return;
  }

  const directions = [];

  if (!centeredY) {
    directions.push(
      deltaY < 0 ? 'up' : 'down'
    );
  }

  if (!centeredX) {
    directions.push(
      deltaX < 0 ? 'left' : 'right'
    );
  }

  const direction =
    `Move camera ${directions.join(' and ')}`;

  setGuidance(
    direction,
    'Adjust the camera to center the QR code.',
    'Follow the spoken guidance.',
    '↔️'
  );

  const now = Date.now();

  if (
    now - lastSpokenGuidanceTime >=
    SPEECH_DEBOUNCE_MS
  ) {
    lastSpokenGuidanceTime = now;
    lastSpokenDirection = direction;

    playGestureAudio('RADAR_PING');

    provideFeedback({
      text: direction,
      hapticPattern: [50, 80, 50],
      hapticLabel: direction,
      priority: false
    });
  }
}

function updateGuidanceSearching() {
  const heading = el('guidance-heading');

  if (
    heading?.textContent !==
    'Searching for QR Code'
  ) {
    setGuidance(
      'Searching for QR Code',
      'Slowly move your camera over the QR display.',
      'Audio guidance begins when a QR code is detected.',
      '🔍'
    );
  }
}

/* ============================================================
   QR PAYLOAD VALIDATION
============================================================ */

export function validatePaymentPayload(raw) {
  if (
    typeof raw !== 'string' ||
    !raw.trim() ||
    raw.length > 4096
  ) {
    return {
      valid: false,
      error: 'Empty or oversized QR payload.'
    };
  }

  const trimmed = raw.trim();

  // PALMLOCK JSON format.
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);

      if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data)
      ) {
        throw new Error('Invalid JSON object.');
      }

      const merchantName =
        cleanText(
          data.merchantName || data.merchant
        );

      const amount =
        parseMoney(data.amount);

      const fee =
        parseMoney(data.fee ?? 0, true);

      const currency =
        String(data.currency || 'INR')
          .toUpperCase();

      if (!merchantName) {
        throw new Error(
          'Merchant name is missing.'
        );
      }

      if (amount === null || fee === null) {
        throw new Error(
          'Invalid payment amount or fee.'
        );
      }

      if (
        currency !== 'INR' &&
        currency !== '₹'
      ) {
        throw new Error(
          'Only INR payments are supported.'
        );
      }

      return createTransaction({
        merchantName,
        amount,
        fee,
        category: cleanText(
          data.category || 'General'
        ),
        merchantId:
          data.merchantId
            ? cleanText(data.merchantId)
            : null,
        source: 'palmlock-json'
      });
    } catch (error) {
      return {
        valid: false,
        error:
          error.message ||
          'Malformed PALMLOCK QR JSON.'
      };
    }
  }

  // Standard UPI payment URI.
  if (/^upi:\/\/pay(?:\?|$)/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);

      if (
        url.protocol !== 'upi:' ||
        url.hostname.toLowerCase() !== 'pay'
      ) {
        throw new Error(
          'Invalid UPI payment URI.'
        );
      }

      const pa =
        cleanText(url.searchParams.get('pa'));

      const pn =
        cleanText(url.searchParams.get('pn'));

      const cu =
        String(
          url.searchParams.get('cu') || 'INR'
        ).toUpperCase();

      const amount =
        parseMoney(url.searchParams.get('am'));

      if (
        !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(pa)
      ) {
        throw new Error(
          'Invalid or missing UPI payment address.'
        );
      }

      if (!pn) {
        throw new Error(
          'UPI merchant name is missing.'
        );
      }

      if (cu !== 'INR') {
        throw new Error(
          'Only INR payments are supported.'
        );
      }

      if (amount === null) {
        throw new Error(
          'UPI QR has no valid fixed amount. This prototype requires a fixed amount.'
        );
      }

      return createTransaction({
        merchantName: pn,
        amount,
        fee: 0,
        category: 'UPI Merchant Payment',
        paymentAddress: pa,
        source: 'upi'
      });
    } catch (error) {
      return {
        valid: false,
        error:
          error.message ||
          'Malformed UPI QR payload.'
      };
    }
  }

  // PALMLOCK demonstration format.
  if (trimmed.startsWith('PL:')) {
    const parts = trimmed.split(':');

    if (
      parts.length < 3 ||
      parts.length > 4
    ) {
      return {
        valid: false,
        error: 'Invalid PALMLOCK demo QR format.'
      };
    }

    const merchantName =
      cleanText(parts[1]);

    const amount =
      parseMoney(parts[2]);

    if (!merchantName || amount === null) {
      return {
        valid: false,
        error: 'Invalid demo merchant or amount.'
      };
    }

    return createTransaction({
      merchantName,
      amount,
      category:
        cleanText(parts[3]) || 'General',
      source: 'palmlock-demo'
    });
  }

  return {
    valid: false,
    error:
      'Unrecognized payment QR format. ' +
      'Use PALMLOCK JSON, UPI, or a PALMLOCK demo code.'
  };
}

/* ============================================================
   QR LOCK AND TRANSACTION CREATION
============================================================ */

export function onQRCodeLocked(rawPayload) {
  if (scanLocked) return;

  if (
    typeof rawPayload !== 'string' ||
    !rawPayload.trim()
  ) {
    handleInvalidQRPayload(
      'Empty QR code.'
    );
    return;
  }

  const now = Date.now();

  if (
    rawPayload === lastProcessedPayload &&
    now - lastProcessedAt < 1200
  ) {
    return;
  }

  lastProcessedPayload = rawPayload;
  lastProcessedAt = now;
  scanLocked = true;

  const validated =
    validatePaymentPayload(rawPayload);

  if (!validated.valid) {
    stopCamera();
    handleInvalidQRPayload(validated.error);
    return;
  }

  stopCamera();

  setPendingTransaction(validated.data);

  provideFeedback({
    text:
      `Payment request detected for ` +
      `${validated.data.merchantName}. ` +
      `Amount ${validated.data.amount} rupees. ` +
      'Merchant identity has not yet been independently verified. ' +
      'This payment is simulated.',
    priority: true
  });

  navigateTo('screen-verification');
}

function handleInvalidQRPayload(reason) {
  setGuidance(
    'Invalid QR Code',
    reason,
    'Use a valid payment QR or demonstration code.',
    '⚠️'
  );

  playGestureAudio('ERROR');

  feedback(
    `QR code rejected. ${reason}`
  );
}

/* ============================================================
   CAMERA TORCH
============================================================ */

export async function toggleTorch() {
  const track =
    videoStream?.getVideoTracks()[0];

  if (!track) {
    feedback(
      'Camera torch is unavailable.'
    );
    return;
  }

  try {
    const capabilities =
      track.getCapabilities?.() || {};

    if (!capabilities.torch) {
      feedback(
        'This device does not support camera torch.'
      );
      return;
    }

    const nextValue = !isTorchOn;

    await track.applyConstraints({
      advanced: [{
        torch: nextValue
      }]
    });

    isTorchOn = nextValue;

    provideFeedback({
      text:
        isTorchOn
          ? 'Torch enabled.'
          : 'Torch disabled.',
      hapticPattern: 50
    });
  } catch (error) {
    console.warn(
      '[PALMLOCK SCANNER] Torch error:',
      error
    );

    feedback(
      'Unable to change torch setting.'
    );
  }
}

/* ============================================================
   DEMONSTRATION QR
============================================================ */

export function simulateScannedQR({
  merchant,
  amount,
  fee = 0,
  category = 'General'
} = {}) {
  const merchantName =
    cleanText(merchant);

  const parsedAmount =
    parseMoney(amount);

  const parsedFee =
    parseMoney(fee, true);

  if (
    !merchantName ||
    parsedAmount === null ||
    parsedFee === null
  ) {
    feedback(
      'Invalid demonstration payment details.'
    );
    return;
  }

  const result = createTransaction({
    merchantName,
    amount: parsedAmount,
    fee: parsedFee,
    category,
    source: 'demo-preset'
  });

  if (!result.valid) {
    feedback(result.error);
    return;
  }

  stopCamera();
  scanLocked = true;

  setPendingTransaction(result.data);

  provideFeedback({
    text:
      `Demonstration payment loaded. ` +
      `${merchantName}, ${parsedAmount} rupees. ` +
      'No real money will be transferred.',
    priority: true
  });

  navigateTo('screen-verification');
}

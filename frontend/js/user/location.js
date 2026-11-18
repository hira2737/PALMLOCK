
/**
 * PALMLOCK — Touch Beyond Vision
 * GPS and Emergency Location Engine
 *
 * Only real browser geolocation is treated as GPS.
 * No simulated coordinates are used for emergencies.
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';

const NORMAL_TIMEOUT_MS = 10000;
const EMERGENCY_TIMEOUT_MS = 4000;
const MAX_CACHED_AGE_MS = 60000;
const MAX_ACCEPTABLE_ACCURACY_METERS = 10000;

let activeRequest = null;
let lastRealFix = null;

function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function formatLocation(lat, lng, accuracy) {
  const latitudeDirection = lat >= 0 ? 'N' : 'S';
  const longitudeDirection = lng >= 0 ? 'E' : 'W';

  const accuracyText =
    Number.isFinite(accuracy)
      ? ` (accuracy ±${Math.round(accuracy)}m)`
      : '';

  return (
    `${Math.abs(lat).toFixed(5)}° ${latitudeDirection}, ` +
    `${Math.abs(lng).toFixed(5)}° ${longitudeDirection}` +
    accuracyText
  );
}

function updateLocationDisplayInUI() {
  const element = document.getElementById(
    'user-location-status'
  );

  if (element) {
    element.textContent =
      state.location.formatted ||
      'Location unavailable';
  }
}

function clearCurrentLocation(status, message) {
  state.location.permissionState = status;
  state.location.latitude = null;
  state.location.longitude = null;
  state.location.accuracy = null;
  state.location.timestamp = null;
  state.location.formatted = message;
  state.location.isRealGPS = false;

  lastRealFix = null;

  updateLocationDisplayInUI();
}

function normalizePosition(position) {
  if (!position || !position.coords) {
    return null;
  }

  const lat = Number(position.coords.latitude);
  const lng = Number(position.coords.longitude);
  const accuracy = Number(position.coords.accuracy);
  const timestamp = Number(position.timestamp);

  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  if (
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > MAX_ACCEPTABLE_ACCURACY_METERS
  ) {
    return null;
  }

  if (
    !Number.isFinite(timestamp) ||
    timestamp > Date.now() + 5000 ||
    Date.now() - timestamp > MAX_CACHED_AGE_MS
  ) {
    return null;
  }

  return {
    lat,
    lng,
    accuracyMeters: Math.round(accuracy),
    capturedAt: new Date(timestamp).toISOString(),
    timestamp,
    coords: formatLocation(lat, lng, accuracy),
    isRealGPS: true,
    source: 'device',
    simulated: false
  };
}

function saveRealFix(fix) {
  lastRealFix = fix;

  state.location.permissionState = 'granted';
  state.location.latitude = fix.lat;
  state.location.longitude = fix.lng;
  state.location.accuracy = fix.accuracyMeters;
  state.location.timestamp = fix.capturedAt;
  state.location.formatted = fix.coords;
  state.location.isRealGPS = true;

  updateLocationDisplayInUI();
}

function getRecentRealFix() {
  if (
    !lastRealFix ||
    !lastRealFix.isRealGPS ||
    Date.now() - lastRealFix.timestamp >
      MAX_CACHED_AGE_MS
  ) {
    return null;
  }

  return { ...lastRealFix };
}

function getGeolocationErrorMessage(error) {
  if (error?.code === 1) {
    return 'Location permission denied';
  }

  if (error?.code === 2) {
    return 'Location signal unavailable';
  }

  if (error?.code === 3) {
    return 'Location request timed out';
  }

  return 'Unable to determine device location';
}

function getPermissionState(error) {
  if (error?.code === 1) {
    return 'denied';
  }

  return 'unavailable';
}

function capturePosition(timeoutMs) {
  if (!navigator.geolocation) {
    return Promise.reject({
      code: 2,
      message: 'Geolocation unsupported'
    });
  }

  // Share a pending request rather than launching
  // overlapping browser permission prompts.
  if (activeRequest) {
    return activeRequest;
  }

  activeRequest = new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const fix = normalizePosition(position);

        if (!fix) {
          reject({
            code: 2,
            message: 'Invalid or stale GPS reading'
          });
          return;
        }

        saveRealFix(fix);
        resolve(fix);
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: MAX_CACHED_AGE_MS
      }
    );
  });

  activeRequest.finally(() => {
    activeRequest = null;
  }).catch(() => {});

  return activeRequest;
}

/**
 * Request device location access.
 *
 * Returns true when a valid GPS fix was obtained.
 * Returns false when location is unavailable.
 */
export async function requestLocationAccess(
  silent = false
) {
  try {
    const fix = await capturePosition(
      NORMAL_TIMEOUT_MS
    );

    if (!silent) {
      provideFeedback({
        text:
          'Location captured successfully. ' +
          `Accuracy approximately ${fix.accuracyMeters} meters.`,
        gesture: 'SUCCESS',
        hapticPattern: [50, 50]
      });
    }

    return true;
  } catch (error) {
    const message =
      getGeolocationErrorMessage(error);

    clearCurrentLocation(
      getPermissionState(error),
      message
    );

    if (!silent) {
      provideFeedback({
        text:
          `${message}. Emergency incidents will ` +
          'report location as unavailable.',
        gesture: 'ERROR'
      });
    }

    console.warn(
      '[PALMLOCK GPS]',
      message
    );

    return false;
  }
}

/**
 * Capture a real location for an emergency.
 *
 * Returns:
 * - Real GPS coordinates when available
 * - Null coordinates when GPS is unavailable
 *
 * Never substitutes a demo landmark.
 */
export async function captureEmergencyLocation() {
  const cached = getRecentRealFix();

  if (cached) {
    return cached;
  }

  try {
    return await capturePosition(
      EMERGENCY_TIMEOUT_MS
    );
  } catch (error) {
    const message =
      getGeolocationErrorMessage(error);

    clearCurrentLocation(
      getPermissionState(error),
      message
    );

    console.warn(
      '[PALMLOCK EMERGENCY GPS]',
      `${message}. No coordinates will be attached.`
    );

    return {
      lat: null,
      lng: null,
      accuracyMeters: null,
      coords: null,
      capturedAt: null,
      isRealGPS: false,
      source: 'unavailable',
      simulated: false,
      note: message
    };
  }
}

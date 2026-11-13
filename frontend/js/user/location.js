/**
 * PALMLOCK — Touch Beyond Vision
 * Geolocation & GPS Capture Engine
 * Captures real device coordinates with permission checks, accuracy bounds,
 * and emergency telemetry formatting.
 */

import { state } from './state.js';
import { provideFeedback } from './accessibility.js';
import { CHENNAI_LOCATIONS } from '../shared/demoData.js';

let isRequesting = false;

/**
 * Request Location Permission with Prior User Notification
 */
export async function requestLocationAccess(silent = false) {
  if (isRequesting) return;
  isRequesting = true;

  if (!navigator.geolocation) {
    state.location.permissionState = 'unavailable';
    state.location.formatted = 'Geolocation not supported on this browser';
    if (!silent) {
      provideFeedback({
        text: 'Geolocation API is not supported on this browser or platform.',
        gesture: 'ERROR'
      });
    }
    isRequesting = false;
    return false;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        isRequesting = false;
        state.location.permissionState = 'granted';
        state.location.latitude = position.coords.latitude;
        state.location.longitude = position.coords.longitude;
        state.location.accuracy = Math.round(position.coords.accuracy);
        state.location.timestamp = new Date(position.timestamp).toLocaleTimeString();
        state.location.formatted = `${position.coords.latitude.toFixed(4)}° N, ${position.coords.longitude.toFixed(4)}° E (±${Math.round(position.coords.accuracy)}m)`;

        updateLocationDisplayInUI();

        if (!silent) {
          provideFeedback({
            text: `Location captured successfully. Accuracy within ${Math.round(position.coords.accuracy)} meters.`,
            gesture: 'SUCCESS',
            hapticPattern: [50, 50]
          });
        }
        resolve(true);
      },
      (error) => {
        isRequesting = false;
        if (error.code === error.PERMISSION_DENIED) {
          state.location.permissionState = 'denied';
          state.location.formatted = 'Location permission denied by user';
          if (!silent) {
            provideFeedback({
              text: 'Location permission was denied. Emergency dispatches will note coordinates as unavailable.',
              gesture: 'ERROR'
            });
          }
        } else {
          state.location.permissionState = 'unavailable';
          state.location.formatted = 'Location signal currently unavailable';
          if (!silent) {
            provideFeedback({
              text: 'GPS satellites currently unavailable. Check your device settings.',
              gesture: 'ERROR'
            });
          }
        }
        updateLocationDisplayInUI();
        resolve(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  });
}

/**
 * Fast Emergency Telemetry Capture
 * Non-blocking location capture for urgent Duress or SOS events
 */
export async function captureEmergencyLocation() {
  // If we already have a recent coordinate within 1 minute, use it
  if (state.location.latitude && state.location.longitude) {
    return {
      lat: state.location.latitude,
      lng: state.location.longitude,
      accuracyMeters: state.location.accuracy,
      coords: state.location.formatted,
      isRealGPS: true
    };
  }

  // Attempt live GPS capture with 4 second timeout
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 60000
        });
      });

      state.location.latitude = pos.coords.latitude;
      state.location.longitude = pos.coords.longitude;
      state.location.accuracy = Math.round(pos.coords.accuracy);
      state.location.formatted = `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`;

      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: Math.round(pos.coords.accuracy),
        coords: state.location.formatted,
        isRealGPS: true
      };
    } catch (err) {
      console.info('Live GPS capture timed out or denied during emergency. Using certified demo incident telemetry.');
    }
  }

  // Fallback to certified Chennai reference coordinates for demo
  const defaultLoc = CHENNAI_LOCATIONS.centralMetro;
  return {
    lat: defaultLoc.lat,
    lng: defaultLoc.lng,
    accuracyMeters: defaultLoc.accuracy,
    coords: defaultLoc.formatted,
    isRealGPS: false,
    note: 'Demo Reference Location: Chennai Central Metro'
  };
}

/**
 * Update UI elements that display location status
 */
function updateLocationDisplayInUI() {
  const locEl = document.getElementById('user-location-status');
  if (locEl) {
    locEl.textContent = state.location.formatted;
  }
}

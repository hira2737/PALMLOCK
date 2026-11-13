/**
 * PALMLOCK — Touch Beyond Vision
 * Reactive Client State Management (Demonstration Store)
 * Standardized for Indian Rupee (INR ₹), Chennai context, and 10-gesture PIN mapping
 */

import { DEMO_USER, DEMO_CONTACTS, DEMO_TRANSACTIONS, INDIAN_MERCHANTS } from '../shared/demoData.js';

export const state = {
  // User Profile
  user: {
    ...DEMO_USER
  },

  // Accessibility Preferences
  preferences: {
    speechEnabled: true,
    speechRate: 1.0,
    speechPitch: 1.0,
    hapticEnabled: true,
    theme: "default", // "default" | "yellow-black" | "white-black" | "light-blue"
    fontSize: "standard", // "standard" | "large" | "xlarge"
    soundTonesEnabled: true,
    motionGesturesEnabled: false
  },

  // Gesture PIN Configurations (Numeric gesture digits)
  // Mapping: 1=Up-Left, 2=Up, 3=Up-Right, 4=Left, 5=Right, 6=Down-Left, 7=Down, 8=Down-Right, 9=DoubleTap, 0=SingleTap
  pins: {
    // Default PIN: 2-5-2-0 (Up, Right, Up, Single Tap)
    standardPin: ["UP", "RIGHT", "UP", "TAP"],
    standardPinDigits: [2, 5, 2, 0],
    
    // Duress PIN: 7-7-4-4 (Down, Down, Left, Left)
    duressPin: ["DOWN", "DOWN", "LEFT", "LEFT"],
    duressPinDigits: [7, 7, 4, 4]
  },

  // Current Transaction in Progress
  currentTransaction: {
    merchantName: INDIAN_MERCHANTS[0].name,
    category: INDIAN_MERCHANTS[0].category,
    amount: 40.00,
    fee: 0.00,
    total: 40.00,
    currency: "INR",
    currencySymbol: "₹",
    qrHash: "PL-88392-CERT",
    referenceId: "TX-CMRL-99482103",
    timestamp: null
  },

  // Active Screen ID
  currentScreen: "screen-dashboard",
  screenHistory: ["screen-dashboard"],

  // Trusted Emergency Guardians
  contacts: [...DEMO_CONTACTS],

  // Transaction Ledger (Demonstration History)
  transactions: [...DEMO_TRANSACTIONS],

  // In-flight PIN Entry buffer (holds objects with { gesture, digit })
  enteredPin: [],

  // Stealth Mode State
  isStealthActive: false,

  // Geolocation state
  location: {
    permissionState: "prompt", // "prompt" | "granted" | "denied" | "unavailable"
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    formatted: "Not captured"
  },

  // Offline sync queue count
  offlineQueueCount: 0,
  isOnline: navigator.onLine !== undefined ? navigator.onLine : true
};

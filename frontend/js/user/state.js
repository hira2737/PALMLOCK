/**
 * PALMLOCK — Touch Beyond Vision
 * Reactive Client State Management (Demonstration Store)
 */

export const state = {
  // User Profile
  user: {
    id: "usr_8829104",
    name: "Maya Lin",
    email: "maya.lin@palmlock.app",
    phone: "+1 (555) 019-2834",
    visionLevel: "low-vision", // "total" | "low-vision" | "legally-blind" | "sighted-tester"
    balance: 1420.50,
    accountNumber: "••4902",
    isLoggedIn: true
  },

  // Accessibility Preferences
  preferences: {
    speechEnabled: true,
    speechRate: 1.0,
    speechPitch: 1.0,
    hapticEnabled: true,
    theme: "default", // "default" | "yellow-black" | "white-black" | "light-blue"
    fontSize: "standard", // "standard" | "large" | "xlarge"
    soundTonesEnabled: true
  },

  // Gesture PIN Configurations (Stored as directional input strings)
  pins: {
    standardPin: ["UP", "RIGHT", "UP", "TAP"],
    duressPin: ["DOWN", "DOWN", "LEFT", "LEFT"]
  },

  // Current Transaction in Progress
  currentTransaction: {
    merchantName: "City Metro Transit",
    category: "Transit & Travel",
    amount: 4.50,
    fee: 0.00,
    total: 4.50,
    qrHash: "PL-88392-CERT",
    referenceId: "TX-99482103",
    timestamp: null
  },

  // Active Screen ID
  currentScreen: "screen-dashboard",
  screenHistory: ["screen-dashboard"],

  // Trusted Emergency Guardians
  contacts: [
    {
      id: "cnt_1",
      name: "Sarah Lin",
      relationship: "Sister & Primary Guardian",
      phone: "+1 (555) 234-8901",
      notifyOnDuress: true
    },
    {
      id: "cnt_2",
      name: "Marcus Vance",
      relationship: "Personal Advocate",
      phone: "+1 (555) 981-4320",
      notifyOnDuress: true
    }
  ],

  // Transaction Ledger (Demonstration History)
  transactions: [
    {
      id: "tx_101",
      merchant: "City Metro Transit",
      category: "Transit",
      amount: 4.50,
      status: "completed",
      isDuress: false,
      date: "Today, 10:14 AM",
      reference: "TX-99482103"
    },
    {
      id: "tx_102",
      merchant: "Green Valley Organic Foods",
      category: "Groceries",
      amount: 34.80,
      status: "completed",
      isDuress: false,
      date: "Yesterday, 3:45 PM",
      reference: "TX-99411982"
    },
    {
      id: "tx_103",
      merchant: "Downtown Pharmacy Rx",
      category: "Medical",
      amount: 12.00,
      status: "completed",
      isDuress: false,
      date: "Nov 08, 1:20 PM",
      reference: "TX-99380129"
    },
    {
      id: "tx_104",
      merchant: "ATM Cash Point #44",
      category: "Cash Out",
      amount: 100.00,
      status: "duress_intercepted",
      isDuress: true,
      date: "Nov 02, 11:32 PM",
      reference: "TX-DUR-87102"
    }
  ],

  // In-flight PIN Entry buffer
  enteredPin: [],

  // Stealth Mode State
  isStealthActive: false
};

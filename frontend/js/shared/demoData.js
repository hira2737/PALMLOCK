/**
 * PALMLOCK — Touch Beyond Vision
 * Shared Demonstration Data & Constants
 * Standardized for Indian Context (INR ₹, Chennai Geolocation, +91 Phones)
 */

export const INDIAN_MERCHANTS = [
  {
    id: "MERCH_CMRL_01",
    name: "Chennai Metro Rail (CMRL)",
    category: "Transit & Travel",
    upiId: "cmrl.chennai@sbi",
    location: "Puratchi Thalaivar Dr. M.G. Ramachandran Central Metro, Chennai",
    verified: true,
    suggestedAmount: 40.00
  },
  {
    id: "MERCH_NILGIRIS_02",
    name: "Nilgiris 1905 Supermarket",
    category: "Groceries & Essentials",
    upiId: "nilgiris.tngr@hdfcbank",
    location: "Usman Road, T. Nagar, Chennai",
    verified: true,
    suggestedAmount: 485.50
  },
  {
    id: "MERCH_APOLLO_03",
    name: "Apollo Pharmacy 24x7",
    category: "Healthcare & Medical",
    upiId: "apollopharm.greams@icici",
    location: "Greams Road, Thousand Lights, Chennai",
    verified: true,
    suggestedAmount: 257.00
  },
  {
    id: "MERCH_SARAVANA_04",
    name: "Saravana Stores",
    category: "Retail & Apparel",
    upiId: "saravanastores.padi@axis",
    location: "Padi Ring Road, Chennai",
    verified: true,
    suggestedAmount: 1250.00
  },
  {
    id: "MERCH_A2B_05",
    name: "A2B - Adyar Ananda Bhavan",
    category: "Food & Dining",
    upiId: "a2b.adyar@sbi",
    location: "Sardar Patel Road, Adyar, Chennai",
    verified: true,
    suggestedAmount: 320.00
  }
];

export const DEMO_USER = {
  id: "usr_in_8829104",
  name: "Maya Krishnan",
  email: "maya.krishnan@palmlock.org.in",
  phone: "+91 98401 28340",
  visionLevel: "low-vision",
  balance: 1420.50, // INR (preserving compatibility with unit_logic)
  accountNumber: "••7824",
  bankName: "State Bank of India (Premier DigiAccount)",
  isLoggedIn: true
};

export const DEMO_CONTACTS = [
  {
    id: "cnt_1",
    name: "Sarah Krishnan",
    relationship: "Sister & Primary Guardian",
    phone: "+91 94440 23891",
    isPrimary: true,
    notifyOnDuress: true,
    verificationStatus: "verified", // "verified" | "pending" | "failed"
    notificationStatus: "acknowledged", // "acknowledged" | "delivered" | "pending" | "failed"
    lastNotification: "Today, 10:15 AM",
    otpCode: "4829"
  },
  {
    id: "cnt_2",
    name: "Marcus Sundaram",
    relationship: "Personal Advocate & Legal Guardian",
    phone: "+91 98841 98143",
    isPrimary: false,
    notifyOnDuress: true,
    verificationStatus: "verified",
    notificationStatus: "delivered",
    lastNotification: "Nov 10, 4:30 PM",
    otpCode: "7193"
  }
];

export const CHENNAI_LOCATIONS = {
  centralMetro: {
    name: "Chennai Central Metro Station, Anna Salai",
    lat: 13.0827,
    lng: 80.2707,
    accuracy: 12,
    formatted: "13.0827° N, 80.2707° E"
  },
  tNagarMarket: {
    name: "Usman Road, T. Nagar Commercial Hub, Chennai",
    lat: 13.0418,
    lng: 80.2341,
    accuracy: 18,
    formatted: "13.0418° N, 80.2341° E"
  },
  thousandLights: {
    name: "Greams Road, Thousand Lights, Chennai",
    lat: 13.0569,
    lng: 80.2525,
    accuracy: 15,
    formatted: "13.0569° N, 80.2525° E"
  },
  guindyTechPark: {
    name: "Guindy Industrial Estate, Chennai",
    lat: 13.0067,
    lng: 80.2021,
    accuracy: 25,
    formatted: "13.0067° N, 80.2021° E"
  },
  marinaPromenade: {
    name: "Kamarajar Promenade, Marina Beach, Chennai",
    lat: 13.0500,
    lng: 80.2824,
    accuracy: 20,
    formatted: "13.0500° N, 80.2824° E"
  }
};

export const DEMO_INCIDENTS = [
  {
    id: "ALT-2026-8921",
    user: "Maya Krishnan",
    userId: "usr_in_8829104",
    userPhone: "+91 98401 28340",
    type: "DURESS",
    typeLabel: "Discreet Duress PIN Activated",
    severity: "CRITICAL",
    status: "acknowledged",
    timestamp: "10:14:22 IST",
    date: "Today, 10:14 AM",
    location: CHENNAI_LOCATIONS.centralMetro.name,
    coords: CHENNAI_LOCATIONS.centralMetro.formatted,
    lat: CHENNAI_LOCATIONS.centralMetro.lat,
    lng: CHENNAI_LOCATIONS.centralMetro.lng,
    accuracyMeters: 12,
    networkStatus: "4G LTE (Jio Telecom) — Signal Strong (-72 dBm)",
    primaryContact: "Sarah Krishnan (+91 94440 23891)",
    primaryStatus: "ACKNOWLEDGED",
    secondaryContact: "Marcus Sundaram (+91 98841 98143)",
    secondaryStatus: "DELIVERED",
    escalationStage: "STAGE_1_GUARDIAN",
    responseNotes: [
      {
        author: "Officer K. Ramanathan (SOC Supervisor)",
        time: "10:16 IST",
        note: "Incident telemetry verified. Primary contact Sarah Krishnan confirmed acknowledgement. Monitoring live GPS stream."
      }
    ],
    timeline: [
      { time: "10:14:22", text: "Duress PIN (7-7-4-4) entered during CMRL transit payment." },
      { time: "10:14:23", text: "Silent incident record created. GPS telemetry locked with 12m precision." },
      { time: "10:14:25", text: "Automated emergency dispatch to Primary Guardian Sarah Krishnan." },
      { time: "10:15:02", text: "Sarah Krishnan opened secure incident link and acknowledged alert." },
      { time: "10:16:10", text: "SOC Officer acknowledged incident ALT-2026-8921." }
    ]
  },
  {
    id: "ALT-2026-8894",
    user: "David Thorne",
    userId: "usr_in_9018231",
    userPhone: "+91 98405 11223",
    type: "SOS",
    typeLabel: "Manual Emergency SOS Triggered",
    severity: "HIGH",
    status: "escalated",
    timestamp: "09:42:10 IST",
    date: "Today, 09:42 AM",
    location: CHENNAI_LOCATIONS.tNagarMarket.name,
    coords: CHENNAI_LOCATIONS.tNagarMarket.formatted,
    lat: CHENNAI_LOCATIONS.tNagarMarket.lat,
    lng: CHENNAI_LOCATIONS.tNagarMarket.lng,
    accuracyMeters: 18,
    networkStatus: "5G (Airtel) — Good Signal",
    primaryContact: "Anita Thorne (+91 98402 33445)",
    primaryStatus: "NO_RESPONSE",
    secondaryContact: "Rajesh Varma (+91 98408 55667)",
    secondaryStatus: "ACKNOWLEDGED",
    escalationStage: "STAGE_2_SECONDARY",
    responseNotes: [
      {
        author: "Officer P. Lakshmi",
        time: "09:48 IST",
        note: "Primary contact failed to acknowledge in 5 minutes. Escalated automatically to secondary contact Rajesh Varma."
      }
    ],
    timeline: [
      { time: "09:42:10", text: "User activated top-bar SOS emergency assistance button." },
      { time: "09:42:15", text: "Primary contact alert dispatched via SMS gateway." },
      { time: "09:47:15", text: "5-minute timer elapsed with no primary acknowledgement." },
      { time: "09:47:16", text: "Auto-escalated to Secondary Guardian Rajesh Varma." },
      { time: "09:48:30", text: "Rajesh Varma acknowledged alert via guardian portal." }
    ]
  },
  {
    id: "ALT-2026-8802",
    user: "Elena Sundaram",
    userId: "usr_in_7718290",
    userPhone: "+91 94441 66778",
    type: "ANOMALY",
    typeLabel: "Repeated PIN Authentication Failure",
    severity: "MEDIUM",
    status: "resolved",
    timestamp: "Yesterday, 18:20 IST",
    date: "Nov 11, 06:20 PM",
    location: CHENNAI_LOCATIONS.thousandLights.name,
    coords: CHENNAI_LOCATIONS.thousandLights.formatted,
    lat: CHENNAI_LOCATIONS.thousandLights.lat,
    lng: CHENNAI_LOCATIONS.thousandLights.lng,
    accuracyMeters: 15,
    networkStatus: "Wi-Fi Connected (Apollo Pharmacy Public)",
    primaryContact: "Gopal Sundaram (+91 94442 88990)",
    primaryStatus: "ACKNOWLEDGED",
    secondaryContact: "Kavitha Sundaram (+91 94443 11224)",
    secondaryStatus: "STANDBY",
    escalationStage: "STAGE_1_GUARDIAN",
    responseNotes: [
      {
        author: "Officer K. Ramanathan",
        time: "18:35 IST",
        note: "User contacted helpline: accidental repeated swipe failures due to rain on screen. False alarm confirmed and resolved."
      }
    ],
    timeline: [
      { time: "18:20:00", text: "3 consecutive invalid gesture PIN attempts at Apollo Pharmacy." },
      { time: "18:20:05", text: "Protective security alert generated. Primary contact informed." },
      { time: "18:35:00", text: "User reported accidental wet touch screen. Marked False Alarm Resolved." }
    ]
  }
];

export const DEMO_FALSE_ALARMS = [
  {
    incidentId: "ALT-2026-8802",
    user: "Elena Sundaram",
    alertType: "ANOMALY",
    cancelledAt: "Nov 11, 06:35 PM",
    reason: "Raindrops on mobile touch surface caused incorrect diagonal swipes.",
    reviewStatus: "VERIFIED_ACCIDENTAL",
    reviewingOfficer: "Officer K. Ramanathan",
    notes: "No coercion present. User safely completed purchase using manual numeric keypad."
  },
  {
    incidentId: "ALT-2026-8711",
    user: "Vikram Adityan",
    alertType: "SOS",
    cancelledAt: "Nov 09, 02:14 PM",
    reason: "Accidental long-press of physical power button triggered SOS shortcut in pocket.",
    reviewStatus: "VERIFIED_ACCIDENTAL",
    reviewingOfficer: "Officer P. Lakshmi",
    notes: "Pocket-dial detected. Guardian confirmed user was safe at office."
  }
];

export const DEMO_TRANSACTIONS = [
  {
    id: "tx_cmrl_101",
    merchant: "Chennai Metro Rail (CMRL)",
    category: "Transit",
    amount: 40.00,
    status: "completed",
    isDuress: false,
    date: "Today, 10:14 AM",
    reference: "TX-CMRL-99482103",
    location: "Puratchi Thalaivar Dr. M.G. Ramachandran Central Metro"
  },
  {
    id: "tx_nilgiris_102",
    merchant: "Nilgiris 1905 Supermarket",
    category: "Groceries",
    amount: 485.50,
    status: "completed",
    isDuress: false,
    date: "Yesterday, 3:45 PM",
    reference: "TX-NIL-99411982",
    location: "Usman Road, T. Nagar"
  },
  {
    id: "tx_apollo_103",
    merchant: "Apollo Pharmacy 24x7",
    category: "Medical",
    amount: 257.00,
    status: "completed",
    isDuress: false,
    date: "Nov 10, 1:20 PM",
    reference: "TX-APO-99380129",
    location: "Greams Road, Thousand Lights"
  },
  {
    id: "tx_dur_104",
    merchant: "State Bank ATM Cash Point #44",
    category: "Cash Out",
    amount: 2000.00,
    status: "duress_intercepted",
    isDuress: true,
    date: "Nov 08, 11:32 PM",
    reference: "TX-DUR-87102",
    location: "Kamarajar Salai, Marina"
  }
];

export const DEMO_USERS_ADMIN = [
  {
    id: "usr_in_8829104",
    name: "Maya Krishnan",
    email: "maya.krishnan@palmlock.org.in",
    phone: "+91 98401 28340",
    city: "Chennai, Tamil Nadu",
    visionLevel: "Low Vision (High Contrast)",
    status: "active",
    duressProtection: "Armed & Active",
    registeredDate: "12 Oct 2026",
    primaryContact: "Sarah Krishnan (+91 94440 23891)",
    totalTransactions: 42,
    lifetimeVolume: 18450.00
  },
  {
    id: "usr_in_9018231",
    name: "David Thorne",
    email: "david.thorne@palmlock.org.in",
    phone: "+91 98405 11223",
    city: "Chennai, Tamil Nadu",
    visionLevel: "Totally Blind (Screen Reader)",
    status: "active",
    duressProtection: "Armed & Active",
    registeredDate: "18 Oct 2026",
    primaryContact: "Anita Thorne (+91 98402 33445)",
    totalTransactions: 28,
    lifetimeVolume: 9240.00
  },
  {
    id: "usr_in_7718290",
    name: "Elena Sundaram",
    email: "elena.sundaram@palmlock.org.in",
    phone: "+91 94441 66778",
    city: "Chennai, Tamil Nadu",
    visionLevel: "Legally Blind (Audio Assist)",
    status: "active",
    duressProtection: "Armed & Active",
    registeredDate: "25 Oct 2026",
    primaryContact: "Gopal Sundaram (+91 94442 88990)",
    totalTransactions: 19,
    lifetimeVolume: 5670.00
  },
  {
    id: "usr_in_6629101",
    name: "Vikram Adityan",
    email: "vikram.adityan@palmlock.org.in",
    phone: "+91 94449 88120",
    city: "Chennai, Tamil Nadu",
    visionLevel: "Low Vision (Large Text)",
    status: "active",
    duressProtection: "Armed & Active",
    registeredDate: "02 Nov 2026",
    primaryContact: "Radha Adityan (+91 94448 77210)",
    totalTransactions: 15,
    lifetimeVolume: 4320.00
  }
];

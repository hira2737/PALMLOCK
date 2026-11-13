/**
 * PALMLOCK — Security Operations Center (SOC)
 * Central Demonstration State Store
 */

export const adminState = {
  // Current Active Admin View: 'section-overview' | 'section-alerts' | 'section-incident-details' | 'section-users' | 'section-transactions'
  currentView: 'section-overview',

  // Audio Siren Alerts Enabled
  sirenAudioEnabled: true,

  // Selected Incident for Details View
  selectedIncidentId: 'ALT-2026-8921',

  // Emergency Incidents List (Demonstration Data)
  incidents: [
    {
      id: 'ALT-2026-8921',
      severity: 'critical', // 'critical' | 'high' | 'medium'
      type: 'Duress PIN Activated',
      userId: 'usr_8829104',
      userName: 'Maya Lin',
      userImpairment: 'Low Vision (WCAG AAA Preset)',
      userPhone: '+1 (555) 019-2834',
      timestamp: 'Nov 11, 2026, 15:42:10',
      timeElapsed: 'Just now',
      status: 'active', // 'active' | 'acknowledged' | 'escalated' | 'resolved'
      merchant: 'City Metro Transit',
      amount: '$4.50',
      posId: 'POS-104 (Platform 2)',
      gps: '37.7749° N, 122.4194° W',
      address: '4th & Market St Metro Station, Platform 2, San Francisco, CA',
      networkStatus: 'Cellular 5G (Encrypted)',
      guardians: [
        { name: 'Sarah Lin', relationship: 'Sister & Primary Guardian', phone: '+1 (555) 234-8901', status: 'SMS Delivered (Ack Received)' },
        { name: 'Marcus Vance', relationship: 'Personal Advocate', phone: '+1 (555) 981-4320', status: 'SMS Delivered (Pending Ack)' }
      ],
      timeline: [
        { time: '15:41:02', title: 'QR Code Scanned', desc: 'User aimed camera at City Metro Transit QR payload.', type: 'info' },
        { time: '15:41:45', title: 'Duress PIN Entered', desc: 'Gesture sequence (DOWN, DOWN, LEFT, LEFT) recognized. Silent alarm dispatched.', type: 'critical' },
        { time: '15:41:46', title: 'Telemetry Telecast', desc: 'Geolocated GPS coordinates dispatched to SOC and emergency contacts.', type: 'warning' },
        { time: '15:42:01', title: 'Guardian Alert Delivered', desc: 'High-priority SMS & push dispatch sent to Sarah Lin and Marcus Vance.', type: 'info' }
      ],
      notes: [
        { author: 'System Sentinel', time: '15:41:46', text: 'Automated duress trigger logged. High-contrast covert rejection displayed to user.' },
        { author: 'Officer S. Chen', time: '15:42:30', text: 'Alert acknowledged. Checking Market St transit security camera feeds.' }
      ]
    },
    {
      id: 'ALT-2026-8914',
      severity: 'high',
      type: 'Manual SOS Trigger',
      userId: 'usr_7719202',
      userName: 'David Thorne',
      userImpairment: 'Totally Blind (Screen Reader)',
      userPhone: '+1 (555) 441-9920',
      timestamp: 'Nov 11, 2026, 14:15:32',
      timeElapsed: '1h 27m ago',
      status: 'acknowledged',
      merchant: 'Corner Grocery Mart',
      amount: '$18.20',
      posId: 'POS-02 (Counter 1)',
      gps: '37.7833° N, 122.4167° W',
      address: '680 Mission St, San Francisco, CA',
      networkStatus: 'Wi-Fi Protected Access 3',
      guardians: [
        { name: 'Arthur Thorne', relationship: 'Father', phone: '+1 (555) 332-1100', status: 'Voice Call Answered' }
      ],
      timeline: [
        { time: '14:15:32', title: 'SOS Hardware Button Triggered', desc: 'User pressed top emergency SOS button on mobile app.', type: 'warning' },
        { time: '14:16:00', title: 'Operator Acknowledged', desc: 'Assigned to Dispatcher J. Miller.', type: 'info' }
      ],
      notes: [
        { author: 'Dispatcher J. Miller', time: '14:18:10', text: 'Contacted user by phone. User reported accidental triple-tap while crossing street. Safe.' }
      ]
    },
    {
      id: 'ALT-2026-8890',
      severity: 'medium',
      type: 'POS QR Tamper Anomaly',
      userId: 'usr_6628194',
      userName: 'Elena Rostova',
      userImpairment: 'Legally Blind (Audio Assistance)',
      userPhone: '+1 (555) 781-3349',
      timestamp: 'Nov 10, 2026, 18:22:04',
      timeElapsed: 'Yesterday',
      status: 'resolved',
      merchant: 'Unverified Pop-Up Vendor',
      amount: '$75.00',
      posId: 'POS-STATIC-STICKER',
      gps: '37.7699° N, 122.4469° W',
      address: 'Haight & Ashbury, San Francisco, CA',
      networkStatus: 'Cellular 4G LTE',
      guardians: [
        { name: 'Oleg Rostov', relationship: 'Brother', phone: '+1 (555) 902-8844', status: 'Notice Received' }
      ],
      timeline: [
        { time: '18:22:04', title: 'Cryptographic Signature Mismatch', desc: 'Scanned QR code lacked PALMLOCK certified merchant signature.', type: 'warning' },
        { time: '18:22:05', title: 'Transaction Auto-Halted', desc: 'Audio warning spoken to user: Uncertified merchant flagged.', type: 'critical' },
        { time: '18:25:12', title: 'Incident Resolved', desc: 'User safely navigated away from fraudulent sticker POS.', type: 'success' }
      ],
      notes: [
        { author: 'System Sentinel', time: '18:22:05', text: 'Fraud risk score 88/100. Sticker overlay detected.' },
        { author: 'Officer S. Chen', time: '18:30:00', text: 'Reported counterfeit sticker location to SF Municipal authorities. Incident closed.' }
      ]
    }
  ],

  // Registered Users Directory (Demonstration Data)
  users: [
    {
      id: 'usr_8829104',
      name: 'Maya Lin',
      email: 'maya.lin@palmlock.app',
      phone: '+1 (555) 019-2834',
      visionLevel: 'low-vision',
      visionDisplay: 'Low Vision (High Contrast)',
      status: 'flagged',
      balance: '$1,420.50',
      accountNumber: '••4902',
      guardiansCount: 2,
      lastActive: 'Just now',
      duressCount: 1,
      guardians: [
        { name: 'Sarah Lin', rel: 'Sister & Primary Guardian', phone: '+1 (555) 234-8901' },
        { name: 'Marcus Vance', rel: 'Personal Advocate', phone: '+1 (555) 981-4320' }
      ]
    },
    {
      id: 'usr_7719202',
      name: 'David Thorne',
      email: 'david.t@palmlock.app',
      phone: '+1 (555) 441-9920',
      visionLevel: 'total',
      visionDisplay: 'Totally Blind (Screen Reader)',
      status: 'active',
      balance: '$620.00',
      accountNumber: '••1184',
      guardiansCount: 1,
      lastActive: '1 hour ago',
      duressCount: 0,
      guardians: [
        { name: 'Arthur Thorne', rel: 'Father', phone: '+1 (555) 332-1100' }
      ]
    },
    {
      id: 'usr_6628194',
      name: 'Elena Rostova',
      email: 'elena.rostova@palmlock.app',
      phone: '+1 (555) 781-3349',
      visionLevel: 'legally-blind',
      visionDisplay: 'Legally Blind (Audio Assist)',
      status: 'active',
      balance: '$2,890.75',
      accountNumber: '••9023',
      guardiansCount: 2,
      lastActive: 'Yesterday',
      duressCount: 0,
      guardians: [
        { name: 'Oleg Rostov', rel: 'Brother', phone: '+1 (555) 902-8844' },
        { name: 'Mira Rostova', rel: 'Mother', phone: '+1 (555) 902-8845' }
      ]
    },
    {
      id: 'usr_5510293',
      name: 'Samuel Kalu',
      email: 'sam.kalu@palmlock.app',
      phone: '+1 (555) 670-2219',
      visionLevel: 'low-vision',
      visionDisplay: 'Low Vision (Yellow on Black)',
      status: 'active',
      balance: '$980.20',
      accountNumber: '••3311',
      guardiansCount: 1,
      lastActive: '3 days ago',
      duressCount: 0,
      guardians: [
        { name: 'Chidi Kalu', rel: 'Brother', phone: '+1 (555) 670-9900' }
      ]
    },
    {
      id: 'usr_4401827',
      name: 'Rachel Chen',
      email: 'rachel.c@palmlock.app',
      phone: '+1 (555) 890-4412',
      visionLevel: 'sighted-tester',
      visionDisplay: 'Sighted Accessibility Auditor',
      status: 'active',
      balance: '$3,150.00',
      accountNumber: '••7702',
      guardiansCount: 1,
      lastActive: '5 days ago',
      duressCount: 0,
      guardians: [
        { name: 'Kevin Chen', rel: 'Spouse', phone: '+1 (555) 890-7711' }
      ]
    }
  ],

  // Transaction Ledger (Demonstration Data)
  transactions: [
    {
      reference: 'TX-99482103',
      date: 'Nov 11, 2026, 15:41:45',
      user: 'Maya Lin',
      merchant: 'City Metro Transit',
      category: 'Transit & Travel',
      amount: '$4.50',
      status: 'duress_intercepted',
      statusLabel: 'Duress Intercepted',
      authMethod: 'Gesture PIN (Duress Pattern)',
      qrSignature: 'PL-88392-CERT (Valid)'
    },
    {
      reference: 'TX-99411982',
      date: 'Nov 10, 2026, 15:45:10',
      user: 'Maya Lin',
      merchant: 'Green Valley Organic Foods',
      category: 'Groceries',
      amount: '$34.80',
      status: 'completed',
      statusLabel: 'Completed Safe',
      authMethod: 'Gesture PIN (Verified)',
      qrSignature: 'PL-19402-CERT (Valid)'
    },
    {
      reference: 'TX-99380129',
      date: 'Nov 08, 2026, 13:20:00',
      user: 'Maya Lin',
      merchant: 'Downtown Pharmacy Rx',
      category: 'Medical',
      amount: '$12.00',
      status: 'completed',
      statusLabel: 'Completed Safe',
      authMethod: 'Gesture PIN (Verified)',
      qrSignature: 'PL-99210-CERT (Valid)'
    },
    {
      reference: 'TX-99201944',
      date: 'Nov 11, 2026, 11:10:22',
      user: 'David Thorne',
      merchant: 'City Metro Transit',
      category: 'Transit & Travel',
      amount: '$4.50',
      status: 'completed',
      statusLabel: 'Completed Safe',
      authMethod: 'Gesture PIN (Verified)',
      qrSignature: 'PL-88392-CERT (Valid)'
    },
    {
      reference: 'TX-99182049',
      date: 'Nov 10, 2026, 18:22:04',
      user: 'Elena Rostova',
      merchant: 'Unverified Pop-Up Vendor',
      category: 'Retail',
      amount: '$75.00',
      status: 'duress_intercepted',
      statusLabel: 'Halted: Signature Mismatch',
      authMethod: 'Pre-Scan Validation Halted',
      qrSignature: 'UNVERIFIED-SIGNATURE-REVOKED'
    },
    {
      reference: 'TX-99014299',
      date: 'Nov 09, 2026, 09:14:30',
      user: 'Samuel Kalu',
      merchant: 'Central Library Bookstore',
      category: 'Education',
      amount: '$22.50',
      status: 'completed',
      statusLabel: 'Completed Safe',
      authMethod: 'Gesture PIN (Verified)',
      qrSignature: 'PL-33910-CERT (Valid)'
    }
  ],

  // Recent Global Activities (for Overview Feed)
  activities: [
    { time: '15:42:10', text: 'Emergency Duress Alert ALT-2026-8921 opened for user Maya Lin (Market St Metro).', type: 'critical' },
    { time: '15:41:46', text: 'Telemetry coordinates dispatched to guardians Sarah Lin and Marcus Vance.', type: 'warning' },
    { time: '14:18:10', text: 'Incident ALT-2026-8914 for David Thorne marked resolved by J. Miller.', type: 'success' },
    { time: '11:10:22', text: 'Transaction TX-99201944 verified safe ($4.50 at City Metro Transit).', type: 'info' },
    { time: 'Yesterday', text: 'Unverified QR code signature blocked at Haight & Ashbury for user Elena Rostova.', type: 'warning' }
  ],

  // Dedicated Trusted Contacts Directory
  trustedContacts: [
    {
      id: 'cnt_adm_1',
      name: 'Sarah Krishnan',
      user: 'Maya Krishnan',
      phone: '+91 94440 23891',
      relationship: 'Sister & Primary Guardian',
      isPrimary: true,
      verificationStatus: 'verified',
      notificationStatus: 'acknowledged',
      lastActive: 'Just now'
    },
    {
      id: 'cnt_adm_2',
      name: 'Marcus Sundaram',
      user: 'Maya Krishnan',
      phone: '+91 98841 98143',
      relationship: 'Personal Advocate',
      isPrimary: false,
      verificationStatus: 'verified',
      notificationStatus: 'delivered',
      lastActive: '10m ago'
    },
    {
      id: 'cnt_adm_3',
      name: 'Anita Thorne',
      user: 'David Thorne',
      phone: '+91 98402 33445',
      relationship: 'Sister',
      isPrimary: true,
      verificationStatus: 'verified',
      notificationStatus: 'no_response',
      lastActive: '1h ago'
    },
    {
      id: 'cnt_adm_4',
      name: 'Rajesh Varma',
      user: 'David Thorne',
      phone: '+91 98408 55667',
      relationship: 'Colleague & Guardian',
      isPrimary: false,
      verificationStatus: 'verified',
      notificationStatus: 'acknowledged',
      lastActive: '45m ago'
    },
    {
      id: 'cnt_adm_5',
      name: 'Gopal Sundaram',
      user: 'Elena Sundaram',
      phone: '+91 94442 88990',
      relationship: 'Father',
      isPrimary: true,
      verificationStatus: 'pending',
      notificationStatus: 'pending',
      lastActive: 'Yesterday'
    }
  ],

  // Escalation Audit Stream
  escalations: [
    {
      id: 'ESC-2026-01',
      incidentId: 'ALT-2026-8921',
      user: 'Maya Krishnan',
      tier: 'Tier 1 — Guardian Alert Dispatch',
      primaryAck: 'Acknowledged (01m 20s)',
      secondaryAck: 'Standby / Delivered',
      elapsedTime: '02m 14s',
      status: 'Active Monitoring',
      action: 'Patrol Alerted'
    },
    {
      id: 'ESC-2026-02',
      incidentId: 'ALT-2026-8894',
      user: 'David Thorne',
      tier: 'Tier 2 — Secondary Contact Auto-Escalated',
      primaryAck: 'Timed Out (>5 mins)',
      secondaryAck: 'Acknowledged by Rajesh Varma',
      elapsedTime: '06m 40s',
      status: 'Escalated',
      action: 'Voice Call Placed'
    },
    {
      id: 'ESC-2026-03',
      incidentId: 'ALT-2026-8802',
      user: 'Elena Sundaram',
      tier: 'Tier 1 — Guardian Alert Dispatch',
      primaryAck: 'Acknowledged by Gopal Sundaram',
      secondaryAck: 'Standby',
      elapsedTime: '15m 00s',
      status: 'Resolved',
      action: 'False Alarm Closed'
    }
  ],

  // False Alarm & Accidental Trigger Records
  falseAlarms: [
    {
      id: 'FA-2026-01',
      incidentId: 'ALT-2026-8802',
      user: 'Elena Sundaram',
      alertType: 'Repeated PIN Mismatch',
      cancelledAt: 'Nov 11, 18:35 IST',
      reason: 'Raindrops on mobile touch surface caused incorrect diagonal swipes.',
      reviewStatus: 'Verified Accidental',
      reviewingOfficer: 'Officer K. Ramanathan',
      notes: 'No coercion present. User completed transaction safely on keypad.'
    },
    {
      id: 'FA-2026-02',
      incidentId: 'ALT-2026-8711',
      user: 'Vikram Adityan',
      alertType: 'SOS Hardware Long-Press',
      cancelledAt: 'Nov 09, 14:14 IST',
      reason: 'Accidental long-press of power button inside pocket triggered SOS shortcut.',
      reviewStatus: 'Verified Accidental',
      reviewingOfficer: 'Officer P. Lakshmi',
      notes: 'Pocket activation confirmed. Guardian confirmed user was safe at workplace.'
    }
  ]
};

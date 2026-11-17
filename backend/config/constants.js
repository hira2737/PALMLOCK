/**
 * PALMLOCK Backend — System Constants & Configuration Defaults
 */

module.exports = {
  ROLES: {
    USER: 'user',
    ADMIN: 'admin'
  },
  
  ALERT_SEVERITY: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  },

  ALERT_STATUS: {
    ACTIVE: 'active',
    ACKNOWLEDGED: 'acknowledged',
    ESCALATED: 'escalated',
    RESOLVED: 'resolved'
  },

  ALERT_TYPES: {
    DURESS: 'DURESS',
    SOS: 'SOS',
    MANUAL: 'MANUAL'
  },

  // Gesture PIN Standard Demo Configuration
  // Mapping: 1=Up-Left, 2=Up, 3=Up-Right, 4=Left, 5=Right, 6=Down-Left, 7=Down, 8=Down-Right, 9=DoubleTap, 0=SingleTap
  PIN_MAPPINGS: {
    STANDARD_DEMO_PIN: '2520', // Up, Right, Up, Single Tap
    DURESS_DEMO_PIN: '7744',   // Down, Down, Left, Left
    GESTURE_TO_DIGIT: {
      'UP_LEFT': '1',
      'UP': '2',
      'UP_RIGHT': '3',
      'LEFT': '4',
      'RIGHT': '5',
      'DOWN_LEFT': '6',
      'DOWN': '7',
      'DOWN_RIGHT': '8',
      'DOUBLE_TAP': '9',
      'SINGLE_TAP': '0',
      'TAP': '0'
    }
  },

  // Indian Demo Merchants (matching frontend/js/shared/demoData.js)
  DEMO_MERCHANTS: [
    {
      merchantId: 'MERCH_CMRL_01',
      name: 'Chennai Metro Rail (CMRL)',
      category: 'Transit & Travel',
      upiId: 'cmrl.chennai@sbi',
      location: 'Puratchi Thalaivar Dr. M.G. Ramachandran Central Metro, Chennai',
      verified: true,
      suggestedAmount: 40.00
    },
    {
      merchantId: 'MERCH_NILGIRIS_02',
      name: 'Nilgiris 1905 Supermarket',
      category: 'Groceries & Essentials',
      upiId: 'nilgiris.tngr@hdfcbank',
      location: 'Usman Road, T. Nagar, Chennai',
      verified: true,
      suggestedAmount: 485.50
    },
    {
      merchantId: 'MERCH_APOLLO_03',
      name: 'Apollo Pharmacy 24x7',
      category: 'Healthcare & Medical',
      upiId: 'apollopharm.greams@icici',
      location: 'Greams Road, Thousand Lights, Chennai',
      verified: true,
      suggestedAmount: 257.00
    },
    {
      merchantId: 'MERCH_SARAVANA_04',
      name: 'Saravana Stores',
      category: 'Retail & Apparel',
      upiId: 'saravanastores.padi@axis',
      location: 'Padi Ring Road, Chennai',
      verified: true,
      suggestedAmount: 1250.00
    },
    {
      merchantId: 'MERCH_A2B_05',
      name: 'A2B - Adyar Ananda Bhavan',
      category: 'Food & Dining',
      upiId: 'a2b.adyar@sbi',
      location: 'Sardar Patel Road, Adyar, Chennai',
      verified: true,
      suggestedAmount: 320.00
    }
  ]
};

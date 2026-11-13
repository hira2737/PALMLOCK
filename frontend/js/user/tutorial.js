/**
 * PALMLOCK — Touch Beyond Vision
 * Complete 19-Lesson Accessibility Curriculum
 * Interactive audio walkthrough, progress tracking, replay controls & practice hooks
 */

import { provideFeedback } from './accessibility.js';
import { navigateTo } from './navigation.js';

export const TUTORIAL_LESSONS = [
  {
    id: 1,
    title: '1. Getting Started & App Navigation',
    category: 'Fundamentals',
    body: 'PALMLOCK is designed for independent, vision-free payments. Navigate using the bottom 5-tab bar (Home, Practice, Scan, History, Settings) or accessible keyboard shortcuts (Alt+H for Home, Alt+Q for QR Scanner, Alt+S for Stealth Mode).',
    speech: 'Lesson 1. Getting Started and Navigation. PALMLOCK is designed for independent touch and audio payments. You can use the bottom tabs or press Alt+H for Home, Alt+Q for Scanner, and Alt+S for Stealth Mode.',
    actionLabel: 'Explore Dashboard',
    actionScreen: 'screen-dashboard'
  },
  {
    id: 2,
    title: '2. Accessibility Settings',
    category: 'Accessibility',
    body: 'Customize your sensory environment at any time. Adjust speech synthesis rate, toggle tactile vibrations, choose between 4 high-contrast themes (including WCAG AAA Yellow-on-Black), and adjust text sizing.',
    speech: 'Lesson 2. Accessibility Settings. You can adjust speech speed, vibration strength, switch to Yellow-on-Black high contrast, or scale fonts up to extra-large.',
    actionLabel: 'Open Settings',
    actionScreen: 'screen-settings'
  },
  {
    id: 3,
    title: '3. Spoken Audio Guidance',
    category: 'Audio',
    body: 'The top accessibility bar includes an instant audio toggle button. All screen transitions, button presses, and payment statuses are announced automatically through screen-reader live regions.',
    speech: 'Lesson 3. Spoken Audio Guidance. Clear spoken announcements accompany all screen changes and actions. You can tap the top speaker button to mute or unmute speech.',
    actionLabel: null
  },
  {
    id: 4,
    title: '4. Camera Permission',
    category: 'Camera & QR',
    body: 'PALMLOCK never requests camera access until you explicitly open the QR scanner. When prompted by your phone or browser, allow camera permission to enable live merchant QR recognition.',
    speech: 'Lesson 4. Camera Permission. PALMLOCK only asks for camera permission when you open the scanner. Tap Allow when prompted so your phone can detect merchant payment codes.',
    actionLabel: null
  },
  {
    id: 5,
    title: '5. QR Scanning Basics',
    category: 'Camera & QR',
    body: 'Hold your smartphone approximately 15 to 25 centimeters above the checkout counter facing forward. The viewfinder actively scans for merchant codes using native high-speed barcode detection.',
    speech: 'Lesson 5. QR Scanning Basics. Hold your phone about twenty centimeters above the counter. The scanner automatically detects QR codes across the counter surface.',
    actionLabel: 'Open Scanner',
    actionScreen: 'screen-scanner'
  },
  {
    id: 6,
    title: '6. Directional QR Guidance',
    category: 'Camera & QR',
    body: 'Our core innovation: as the camera moves, PALMLOCK calculates the QR position relative to center. Directional audio tones and vibration pulses guide your hand Left, Right, Up, or Down until center lock is achieved.',
    speech: 'Lesson 6. Directional QR Guidance. Audio tones guide your hand towards the QR code. Rising pitch signals centering, with distinct vibration pulses guiding Up, Down, Left, or Right.',
    actionLabel: null
  },
  {
    id: 7,
    title: '7. Merchant Verification',
    category: 'Payment Verification',
    body: 'Never trust an unverified QR. After scanning, PALMLOCK cross-references the code against certified merchant registries. A verified green checkmark and spoken merchant name confirm legitimacy before PIN entry.',
    speech: 'Lesson 7. Merchant Verification. Once scanned, the certified merchant name is verified and spoken aloud so you never pay an unintended party.',
    actionLabel: null
  },
  {
    id: 8,
    title: '8. Payment Amount Confirmation',
    category: 'Payment Verification',
    body: 'The exact transaction amount in Indian Rupees (₹) is displayed in high contrast and announced clearly. Always listen carefully to the amount before continuing.',
    speech: 'Lesson 8. Payment Amount Confirmation. The exact transaction amount in Rupees and Paise is announced aloud and displayed in high-contrast text.',
    actionLabel: null
  },
  {
    id: 9,
    title: '9. Tactile Currency Verification',
    category: 'Payment Verification',
    body: 'Verify amounts through touch! Feel digit-by-digit vibrations: Hundreds are long pulses, Tens are medium pulses, and Ones are short pulses. Group pauses separate digit positions.',
    speech: 'Lesson 9. Tactile Currency Verification. You can feel payment amounts through vibration: long pulses for hundreds, medium pulses for tens, and short pulses for ones.',
    actionLabel: 'Try Currency Pulses',
    actionScreen: 'screen-verification'
  },
  {
    id: 10,
    title: '10. Numeric Gesture PIN Mapping',
    category: 'Gesture PIN',
    body: 'Replaces visible keypads with 10 touch gestures: 1=Up-Left, 2=Up, 3=Up-Right, 4=Left, 5=Right, 6=Down-Left, 7=Down, 8=Down-Right, 9=Double Tap, 0=Single Tap.',
    speech: 'Lesson 10. Numeric Gesture PIN Mapping. PALMLOCK maps each digit zero through nine to eight swipe directions plus single and double tap. No visible numbers are exposed.',
    actionLabel: 'View Gesture Table',
    actionScreen: 'screen-practice'
  },
  {
    id: 11,
    title: '11. Gesture PIN Practice Lab',
    category: 'Gesture PIN',
    body: 'Visit the Practice Lab anytime to practice directional swipes. Immediate haptic pulses and spoken confirmation verify each stroke so your fingers build muscle memory.',
    speech: 'Lesson 11. Gesture PIN Practice Lab. You can practice all swipe angles in the practice lab anytime with instant auditory and tactile feedback.',
    actionLabel: 'Open Practice Lab',
    actionScreen: 'screen-practice'
  },
  {
    id: 12,
    title: '12. Black Stealth Mode',
    category: 'Security & Duress',
    body: 'When in crowded areas, activate Black Stealth Mode (Alt+S). The display turns completely black (#000000) as if powered down, while the full surface remains an active gesture touch canvas.',
    speech: 'Lesson 12. Black Stealth Mode. Turn your screen pitch black for complete visual privacy while continuing to enter your gesture PIN on the darkened surface.',
    actionLabel: 'Test Stealth Mode',
    actionScreen: 'screen-stealth'
  },
  {
    id: 13,
    title: '13. Normal PIN vs. Duress PIN',
    category: 'Security & Duress',
    body: 'Your normal PIN authorizes transactions. The Duress PIN (Down, Down, Left, Left = 7744) looks like a banking gateway timeout to an observer, but covertly dispatches emergency alerts.',
    speech: 'Lesson 13. Normal PIN and Duress PIN. Your normal PIN completes payments. The secret Duress sequence Down Down Left Left displays a bank timeout while silently summoning help.',
    actionLabel: null
  },
  {
    id: 14,
    title: '14. Emergency SOS Activation',
    category: 'Security & Duress',
    body: 'In an urgent situation outside of payments, tap the top-bar SOS button. This immediately captures your GPS coordinates and dispatches alerts to your guardians.',
    speech: 'Lesson 14. Emergency SOS Activation. Outside of payments, tap the top SOS button to immediately transmit your coordinates to guardians and security monitors.',
    actionLabel: null
  },
  {
    id: 15,
    title: '15. Trusted Contacts Management',
    category: 'Emergency Assistance',
    body: 'Configure a primary and secondary trusted guardian. Each guardian receives SMS incident links and verification OTPs during emergency events.',
    speech: 'Lesson 15. Trusted Contacts. Add primary and secondary emergency contacts who will be notified with your coordinates when duress or SOS is activated.',
    actionLabel: 'Manage Contacts',
    actionScreen: 'screen-contacts'
  },
  {
    id: 16,
    title: '16. Location Permissions',
    category: 'Emergency Assistance',
    body: 'Location access is only requested for emergency safety and guardian dispatches. We never track your day-to-day movements or share coordinates without an emergency trigger.',
    speech: 'Lesson 16. Location Permissions. PALMLOCK only captures your location during emergency activations, never for continuous background tracking.',
    actionLabel: null
  },
  {
    id: 17,
    title: '17. Emergency Location Capture',
    category: 'Emergency Assistance',
    body: 'When an alert is triggered, PALMLOCK locks high-precision GPS coordinates, capture timestamp, and estimated accuracy in meters to pinpoint your position for guardians.',
    speech: 'Lesson 17. Emergency Location Capture. When triggered, high-accuracy GPS coordinates are locked and transmitted with incident telemetry.',
    actionLabel: null
  },
  {
    id: 18,
    title: '18. Offline Emergency Queue',
    category: 'Offline Resilience',
    body: 'If cellular connectivity drops, emergency events are never lost. IndexedDB locally buffers the incident and automatically synchronizes with security monitors the moment a connection returns.',
    speech: 'Lesson 18. Offline Emergency Queue. If you lose internet, emergency records are buffered locally in IndexedDB and automatically sent as soon as you reconnect.',
    actionLabel: null
  },
  {
    id: 19,
    title: '19. Understanding Vibration Patterns',
    category: 'Accessibility',
    body: 'Summary of tactile cues: Tap is a 40ms tick; Directional swipes are 80ms pulses; QR centered is a triple confirmation pulse; Duress confirmation is a long pulse plus 3 micro-ticks.',
    speech: 'Lesson 19. Understanding Vibration Patterns. Taps are short ticks, swipes are medium pulses, alignment is a triple pulse, and duress is a long covert pulse followed by micro ticks.',
    actionLabel: 'Return to Dashboard',
    actionScreen: 'screen-dashboard'
  }
];

let currentLessonIndex = 0;

export function initTutorial() {
  const nextBtn = document.getElementById('btn-tutorial-next');
  const prevBtn = document.getElementById('btn-tutorial-prev');
  const listenBtn = document.getElementById('btn-tutorial-listen');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentLessonIndex < TUTORIAL_LESSONS.length - 1) {
        currentLessonIndex++;
        renderLesson(true);
      } else {
        provideFeedback({
          text: 'Congratulations! You have completed all 19 PALMLOCK accessibility lessons. Opening Gesture Practice Lab.',
          gesture: 'SUCCESS'
        });
        navigateTo('screen-practice');
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentLessonIndex > 0) {
        currentLessonIndex--;
        renderLesson(true);
      }
    });
  }

  if (listenBtn) {
    listenBtn.addEventListener('click', () => {
      const lesson = TUTORIAL_LESSONS[currentLessonIndex];
      provideFeedback({
        text: lesson.speech,
        priority: true
      });
    });
  }

  renderLesson(false);
}

function renderLesson(autoSpeak = true) {
  const lesson = TUTORIAL_LESSONS[currentLessonIndex];
  const titleEl = document.getElementById('tutorial-step-title');
  const bodyEl = document.getElementById('tutorial-step-body');
  const prevBtn = document.getElementById('btn-tutorial-prev');
  const nextBtn = document.getElementById('btn-tutorial-next');
  const progressContainer = document.getElementById('tutorial-dots-bar');

  if (titleEl) titleEl.textContent = lesson.title;
  if (bodyEl) bodyEl.textContent = lesson.body;

  if (prevBtn) {
    prevBtn.disabled = currentLessonIndex === 0;
  }
  if (nextBtn) {
    nextBtn.textContent = currentLessonIndex === TUTORIAL_LESSONS.length - 1 ? 'Finish & Practice ›' : 'Next Lesson ›';
  }

  // Update progress bar / counter
  if (progressContainer) {
    progressContainer.innerHTML = '';
    // Display interactive stepper or compact indicators
    const counterPill = document.createElement('div');
    counterPill.className = 'tutorial-counter-pill';
    counterPill.style.fontWeight = '600';
    counterPill.style.color = 'var(--accent-primary)';
    counterPill.textContent = `Lesson ${lesson.id} of ${TUTORIAL_LESSONS.length} • ${lesson.category}`;
    progressContainer.appendChild(counterPill);
  }

  // Action hook button if lesson links to an active feature
  let actionBtn = document.getElementById('btn-tutorial-practice-action');
  if (!actionBtn && lesson.actionLabel && lesson.actionScreen) {
    actionBtn = document.createElement('button');
    actionBtn.id = 'btn-tutorial-practice-action';
    actionBtn.className = 'btn btn-secondary btn-full';
    actionBtn.style.marginTop = 'var(--space-2)';
    const card = document.querySelector('.tutorial-step-card');
    if (card) card.appendChild(actionBtn);
  }

  if (actionBtn) {
    if (lesson.actionLabel && lesson.actionScreen) {
      actionBtn.style.display = 'block';
      actionBtn.textContent = lesson.actionLabel;
      actionBtn.onclick = () => navigateTo(lesson.actionScreen);
    } else {
      actionBtn.style.display = 'none';
    }
  }

  // Automatically announce current lesson if interactive step
  if (autoSpeak) {
    provideFeedback({
      text: lesson.speech,
      priority: true,
      hapticPattern: 40,
      hapticLabel: `Tutorial: ${lesson.title}`
    });
  }
}

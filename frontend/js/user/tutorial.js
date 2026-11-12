/**
 * PALMLOCK — Touch Beyond Vision
 * Step-by-Step Interactive Accessibility Walkthrough
 */

import { provideFeedback } from './accessibility.js';
import { navigateTo } from './navigation.js';

const TUTORIAL_STEPS = [
  {
    title: '1. Directional Gestures',
    body: 'PALMLOCK replaces numeric touch keys with 4 natural directional swipes: Up, Down, Left, and Right, plus Tap. Each gesture triggers a distinctive haptic frequency and auditory pitch so you always know what was registered.',
    speech: 'Step 1. Directional Gestures. PALMLOCK replaces numeric on-screen touch keys with four natural directional swipes: Up, Down, Left, and Right, plus Tap. Each gesture triggers a distinctive haptic frequency and auditory pitch.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>`
  },
  {
    title: '2. Black Stealth Mode',
    body: 'When in public or crowded areas, toggle Black Stealth Mode. Your screen becomes completely dark as if turned off, while the entire screen remains a sensitive touch canvas for your gesture PIN. Bystanders cannot observe your PIN.',
    speech: 'Step 2. Black Stealth Mode. When in public or crowded areas, activate Black Stealth Mode. Your phone display becomes completely dark as if powered off, while remaining a full touch canvas for your gestures.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
  },
  {
    title: '3. Directional QR Scanning',
    body: 'Hold your camera facing the merchant checkout area. Directional audio and vibration pulses guide your aim. A rising pitch signals when you are approaching center. When aligned, the merchant identity and exact amount are spoken aloud.',
    speech: 'Step 3. Directional QR Scanning. Point your camera towards the checkout area. Directional audio and haptics guide your hand. A rising pitch signals approaching center, followed by spoken merchant confirmation.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
  },
  {
    title: '4. Silent Duress Safety',
    body: 'If you are ever coerced or intimidated during a transaction, enter your Duress PIN (Down, Down, Left, Left). The application appears to fail with a banking timeout error to the aggressor, but immediately dispatches geolocated alerts to your guardians.',
    speech: 'Step 4. Silent Duress Safety. If coerced during a transaction, enter your Duress PIN. The app displays an apparent bank error to protect you, while silently dispatching your emergency coordinates to your trusted contacts.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
  }
];

let currentStepIndex = 0;

export function initTutorial() {
  const nextBtn = document.getElementById('btn-tutorial-next');
  const prevBtn = document.getElementById('btn-tutorial-prev');
  const listenBtn = document.getElementById('btn-tutorial-listen');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
        currentStepIndex++;
        renderTutorialStep();
      } else {
        // Complete tutorial and go to practice
        provideFeedback({
          text: 'Tutorial complete! Starting Gesture Practice Lab.',
          gesture: 'SUCCESS'
        });
        navigateTo('screen-practice');
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        renderTutorialStep();
      }
    });
  }

  if (listenBtn) {
    listenBtn.addEventListener('click', () => {
      const step = TUTORIAL_STEPS[currentStepIndex];
      provideFeedback({
        text: step.speech,
        priority: true
      });
    });
  }

  renderTutorialStep();
}

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[currentStepIndex];
  const titleEl = document.getElementById('tutorial-step-title');
  const bodyEl = document.getElementById('tutorial-step-body');
  const iconBox = document.getElementById('tutorial-icon-box');
  const prevBtn = document.getElementById('btn-tutorial-prev');
  const nextBtn = document.getElementById('btn-tutorial-next');

  if (titleEl) titleEl.textContent = step.title;
  if (bodyEl) bodyEl.textContent = step.body;
  if (iconBox) iconBox.innerHTML = step.icon;

  if (prevBtn) {
    prevBtn.disabled = currentStepIndex === 0;
  }
  if (nextBtn) {
    nextBtn.textContent = currentStepIndex === TUTORIAL_STEPS.length - 1 ? 'Finish & Practice ›' : 'Next Step ›';
  }

  // Update progress dots
  const dots = document.querySelectorAll('#tutorial-dots-bar .progress-dot');
  dots.forEach((dot, idx) => {
    if (idx <= currentStepIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });

  // Auto-speak on step change
  provideFeedback({
    text: step.speech,
    priority: true,
    hapticPattern: 40,
    hapticLabel: `Tutorial: ${step.title}`
  });
}

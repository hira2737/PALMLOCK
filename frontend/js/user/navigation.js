/**
 * PALMLOCK — Touch Beyond Vision
 * Screen Routing, History Stack & Accessible Focus Trapping
 */

import { state } from './state.js';
import { provideFeedback, announceAssertive } from './accessibility.js';

/**
 * Navigate to a target screen by ID
 */
export function navigateTo(screenId, addToHistory = true) {
  const targetScreen = document.getElementById(screenId);
  if (!targetScreen) {
    console.error(`Screen not found: ${screenId}`);
    return;
  }

  // Deactivate all screens
  const allScreens = document.querySelectorAll('.app-screen');
  allScreens.forEach(screen => {
    screen.classList.remove('active');
  });

  // Handle Stealth Screen Overlay specifically
  const stealthOverlay = document.getElementById('screen-stealth');
  if (screenId === 'screen-stealth') {
    if (stealthOverlay) {
      stealthOverlay.classList.add('active');
      state.isStealthActive = true;
    }
  } else {
    if (stealthOverlay) {
      stealthOverlay.classList.remove('active');
      state.isStealthActive = false;
    }
    targetScreen.classList.add('active');
  }

  // Update history stack
  if (addToHistory && state.currentScreen !== screenId) {
    state.screenHistory.push(screenId);
  }
  state.currentScreen = screenId;

  // Sync bottom navigation active indicators
  updateBottomNav(screenId);

  // Sync desktop fast navigator selector
  const fastNav = document.getElementById('screen-fast-nav');
  if (fastNav && fastNav.value !== screenId) {
    fastNav.value = screenId;
  }

  // Accessible Focus Management: Focus the heading or main screen container
  setTimeout(() => {
    if (screenId === 'screen-stealth') {
      const exitBtn = document.getElementById('btn-exit-stealth');
      if (exitBtn) exitBtn.focus();
    } else {
      const heading = targetScreen.querySelector('h1, h2, [tabindex="-1"]');
      if (heading) {
        if (!heading.hasAttribute('tabindex')) {
          heading.setAttribute('tabindex', '-1');
        }
        heading.focus();
      }
    }
  }, 100);

  // Announce screen change for accessibility
  const screenTitle = targetScreen.querySelector('h1')?.textContent || screenId.replace('screen-', '');
  provideFeedback({
    text: `Opened ${screenTitle}`,
    hapticPattern: 50,
    hapticLabel: `Navigated to ${screenTitle}`
  });
}

/**
 * Navigate to previous screen in history
 */
export function navigateBack() {
  if (state.screenHistory.length > 1) {
    state.screenHistory.pop(); // remove current
    const prevScreen = state.screenHistory[state.screenHistory.length - 1];
    navigateTo(prevScreen, false);
  } else {
    navigateTo('screen-dashboard', false);
  }
}

/**
 * Update active state in bottom navigation bar
 */
function updateBottomNav(screenId) {
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(item => {
    const target = item.getAttribute('data-nav');
    if (target === screenId) {
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
    } else {
      item.classList.remove('active');
      item.removeAttribute('aria-current');
    }
  });
}

/**
 * Open and close accessible modal dialogs
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');

  const focusable = modal.querySelector('button, input, [tabindex="0"]');
  if (focusable) focusable.focus();

  announceAssertive('Modal dialog opened.');
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  announceAssertive('Modal closed.');
}

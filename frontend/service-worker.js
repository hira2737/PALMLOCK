/**
 * PALMLOCK — Touch Beyond Vision
 * Offline Service Worker
 */

const CACHE_NAME = 'palmlock-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/user.css',
  './js/user/app.js',
  './js/user/state.js',
  './js/user/accessibility.js',
  './js/user/navigation.js',
  './js/user/gestures.js',
  './js/user/scanner.js',
  './js/user/payments.js',
  './js/user/contacts.js',
  './js/user/tutorial.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Simple cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

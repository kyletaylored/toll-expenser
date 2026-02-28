/**
 * Service Worker for Toll Expense Tracker
 *
 * API requests (/api/*) are NOT intercepted here — they go directly to the
 * Cloudflare Worker, which adds the Origin/Referer headers requires.
 *
 * This service worker only handles static asset caching for offline support.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `ntta-toll-tracker-${CACHE_VERSION}`;

// Assets to cache for offline support
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/tollway-logo.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - only cache static assets; let API requests pass through
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API requests — let them reach the Cloudflare Worker proxy
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(handleStaticRequest(event.request));
});

async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Only cache http/https responses — chrome-extension:// etc. are unsupported
    if (networkResponse.ok && request.url.startsWith('http')) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return new Response('Offline - Unable to load resource', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      })
    );
  }
});

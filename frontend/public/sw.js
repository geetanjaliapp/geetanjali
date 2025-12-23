/**
 * Service Worker for Geetanjali PWA
 *
 * Provides:
 * - Offline support for static assets
 * - Cache-first strategy for verses (rarely change)
 * - Network-first for API calls (fresh data preferred)
 * - App shell caching for instant loads
 *
 * Note: CACHE_VERSION is auto-replaced at build time by vite.config.ts versionPlugin
 * to ensure unique cache names per deployment.
 */

// This value is replaced at build time - see vite.config.ts versionPlugin
const CACHE_VERSION = 'dev';
const STATIC_CACHE = `geetanjali-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `geetanjali-dynamic-${CACHE_VERSION}`;
const VERSE_CACHE = `geetanjali-verses-${CACHE_VERSION}`;

// Static assets to cache on install (app shell only - JS bundles cached on demand)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/logo.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete, skipping waiting');
        return self.skipWaiting();  // Only skip AFTER caching completes
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
        throw error;  // Re-throw to fail the install
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        const oldCaches = keys.filter((key) => {
          return key.startsWith('geetanjali-') &&
                 key !== STATIC_CACHE &&
                 key !== DYNAMIC_CACHE &&
                 key !== VERSE_CACHE;
        });
        console.log('[SW] Found', oldCaches.length, 'old caches to delete');
        return Promise.all(
          oldCaches.map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete, claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Verse endpoints - cache for offline access
    if (url.pathname.includes('/verses/')) {
      event.respondWith(networkFirstWithCache(request, VERSE_CACHE, 86400)); // 24h
    }
    // Taxonomy endpoints - cache for offline access (rarely changes)
    else if (url.pathname.includes('/taxonomy/')) {
      event.respondWith(networkFirstWithCache(request, STATIC_CACHE, 86400)); // 24h
    } else {
      // Other API - network only (don't cache user data)
      event.respondWith(fetch(request));
    }
    return;
  }

  // Static assets (JS, CSS, images) - cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages - network first for fresh content
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, 3600)); // 1h
    return;
  }

  // Default - network with cache fallback
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, 3600));
});

/**
 * Cache-first strategy
 * Returns cached response if available, otherwise fetches and caches
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Only return offline page for HTML requests, not JS/CSS/images
    const url = new URL(request.url);
    if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/') {
      return caches.match('/') || new Response('Offline', { status: 503 });
    }
    // For other assets, let the error propagate (browser will show network error)
    throw error;
  }
}

/**
 * Network-first strategy with cache fallback
 * Tries network first, falls back to cache, updates cache on success
 */
async function networkFirstWithCache(request, cacheName, maxAge = 3600) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return offline fallback for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/') || new Response('Offline', { status: 503 });
    }
    throw error;
  }
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname);
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_VERSE') {
    // Pre-cache a specific verse - use waitUntil to ensure completion
    const verseUrl = event.data.url;
    event.waitUntil(
      caches.open(VERSE_CACHE).then((cache) => cache.add(verseUrl))
    );
  }

  if (event.data?.type === 'CLEAR_CACHES') {
    // Clear all geetanjali caches (used on version update)
    // Use waitUntil to prevent SW termination during async operation
    event.waitUntil(
      (async () => {
        console.log('[SW] Clearing all caches on request');
        try {
          const keys = await caches.keys();
          const geetanjaliCaches = keys.filter((key) => key.startsWith('geetanjali-'));

          await Promise.all(
            geetanjaliCaches.map((key) => {
              console.log('[SW] Deleting cache:', key);
              return caches.delete(key);
            })
          );

          // Notify the app that caches are cleared
          if (event.source) {
            event.source.postMessage({ type: 'CACHES_CLEARED' });
          }
        } catch (error) {
          console.error('[SW] Failed to clear caches:', error);
          // Still notify the app, but with error status
          if (event.source) {
            event.source.postMessage({ type: 'CACHES_CLEAR_FAILED', error: error.message });
          }
        }
      })()
    );
  }
});

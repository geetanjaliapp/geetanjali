/**
 * Service Worker for Geetanjali PWA
 *
 * Provides:
 * - Offline support for static assets
 * - Cache-first strategy for verses (rarely change)
 * - Network-first for API calls (fresh data preferred)
 * - App shell caching for instant loads
 * - Audio caching with Range request support (v1.19.0)
 *
 * Note: CACHE_VERSION is auto-replaced at build time by vite.config.ts versionPlugin
 * to ensure unique cache names per deployment.
 */

// This value is replaced at build time - see vite.config.ts versionPlugin
const CACHE_VERSION = 'dev';
const STATIC_CACHE = `geetanjali-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `geetanjali-dynamic-${CACHE_VERSION}`;
const VERSE_CACHE = `geetanjali-verses-${CACHE_VERSION}`;

// Audio cache is version-independent (persists across updates)
const AUDIO_CACHE = 'geetanjali-audio-v1';
const MAX_AUDIO_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

// Static assets to cache on install (app shell only - JS bundles cached on demand)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/logo.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Install failed:', error);
        throw error;
      })
  );
});

// Activate event - clean old caches (except audio cache which persists)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        const oldCaches = keys.filter((key) => {
          // Keep audio cache across versions
          if (key === AUDIO_CACHE) return false;
          return key.startsWith('geetanjali-') &&
                 key !== STATIC_CACHE &&
                 key !== DYNAMIC_CACHE &&
                 key !== VERSE_CACHE;
        });
        return Promise.all(oldCaches.map((key) => caches.delete(key)));
      })
      .then(() => self.clients.claim())
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

  // Audio files - special handling with Range request support
  if (isAudioFile(url.pathname)) {
    event.respondWith(handleAudioRequest(request, url));
    return;
  }

  // Skip video files (not cached)
  if (isVideoFile(url.pathname)) return;

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

// ============================================================================
// Audio Caching with Range Request Support
// ============================================================================

/**
 * Handle audio requests with caching and Range support
 *
 * Strategy:
 * 1. Check if full audio is in cache
 * 2. If cached, serve with Range support (for seeking)
 * 3. If not cached, fetch full file, cache it, serve response
 */
async function handleAudioRequest(request, url) {
  const cache = await caches.open(AUDIO_CACHE);
  const cacheKey = url.origin + url.pathname; // Normalize URL (ignore query params)

  // Check cache for full audio file
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    // Update access time for LRU
    updateAudioAccessTime(cacheKey);

    // Handle Range request from cached blob
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      return createRangeResponse(cachedResponse, rangeHeader);
    }
    return cachedResponse.clone();
  }

  // Not cached - fetch full file (without Range header to get complete file)
  try {
    const fetchRequest = new Request(cacheKey, {
      method: 'GET',
      headers: {}, // No Range header - we want the full file
      mode: 'cors',
      credentials: 'omit',
    });

    const networkResponse = await fetch(fetchRequest);

    if (networkResponse.ok && networkResponse.status === 200) {
      // Clone before caching
      const responseToCache = networkResponse.clone();

      // Cache in background (don't block response)
      cacheAudioFile(cache, cacheKey, responseToCache).catch((err) => {
        console.warn('[SW] Failed to cache audio:', err);
      });
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Audio fetch failed:', error);
    // Return network error
    return new Response('Audio unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Create a 206 Partial Content response from cached audio
 */
async function createRangeResponse(cachedResponse, rangeHeader) {
  const blob = await cachedResponse.blob();
  const totalSize = blob.size;

  // Parse Range header: "bytes=0-" or "bytes=0-1023"
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return cachedResponse.clone();
  }

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

  // Validate range
  if (start >= totalSize || end >= totalSize || start > end) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${totalSize}` },
    });
  }

  // Slice blob for the requested range
  const slicedBlob = blob.slice(start, end + 1, blob.type);

  return new Response(slicedBlob, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': blob.type || 'audio/mpeg',
      'Content-Length': String(slicedBlob.size),
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

/**
 * Cache audio file with quota management
 */
async function cacheAudioFile(cache, url, response) {
  const blob = await response.blob();
  const size = blob.size;

  // Enforce quota before adding
  await enforceAudioCacheQuota(cache, size);

  // Store the response
  const responseToStore = new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': blob.type || 'audio/mpeg',
      'Content-Length': String(size),
    },
  });

  await cache.put(url, responseToStore);

  // Track metadata
  addAudioCacheMetadata(url, size);

  console.log(`[SW] Cached audio: ${url} (${(size / 1024).toFixed(1)}KB)`);
}

/**
 * Enforce audio cache quota using LRU eviction
 */
async function enforceAudioCacheQuota(cache, incomingSize) {
  const metadata = getAudioCacheMetadata();

  // Calculate current size
  let totalSize = metadata.reduce((sum, m) => sum + m.size, 0);

  // If adding new file would exceed quota, evict oldest
  while (totalSize + incomingSize > MAX_AUDIO_CACHE_SIZE && metadata.length > 0) {
    // Sort by lastAccessed (oldest first)
    metadata.sort((a, b) => a.lastAccessed - b.lastAccessed);

    const oldest = metadata.shift();
    if (oldest) {
      await cache.delete(oldest.url);
      totalSize -= oldest.size;
      console.log(`[SW] Evicted audio: ${oldest.url} (LRU)`);
    }
  }

  // Save updated metadata
  saveAudioCacheMetadata(metadata);
}

// ============================================================================
// Audio Cache Metadata (stored in memory, rebuilt on demand)
// ============================================================================

// In-memory metadata store
let audioMetadataCache = null;

function getAudioCacheMetadata() {
  if (audioMetadataCache) return audioMetadataCache;

  try {
    // Note: Service Workers don't have localStorage, but we can use a global
    // The metadata will be rebuilt from cache on SW restart
    audioMetadataCache = [];
  } catch {
    audioMetadataCache = [];
  }

  return audioMetadataCache;
}

function saveAudioCacheMetadata(metadata) {
  audioMetadataCache = metadata;
}

function addAudioCacheMetadata(url, size) {
  const metadata = getAudioCacheMetadata();

  // Remove existing entry if present
  const existing = metadata.findIndex((m) => m.url === url);
  if (existing !== -1) {
    metadata.splice(existing, 1);
  }

  metadata.push({
    url,
    size,
    cachedAt: Date.now(),
    lastAccessed: Date.now(),
  });

  saveAudioCacheMetadata(metadata);
}

function updateAudioAccessTime(url) {
  const metadata = getAudioCacheMetadata();
  const entry = metadata.find((m) => m.url === url);
  if (entry) {
    entry.lastAccessed = Date.now();
    saveAudioCacheMetadata(metadata);
  }
}

/**
 * Rebuild metadata from cache (called on message or SW restart)
 *
 * Note: Since metadata is stored in-memory only, access times are lost when
 * the SW terminates. On rebuild, all files get current timestamp which
 * effectively resets LRU ordering. This is acceptable as the cache is
 * bounded by size quota and eviction remains fair (oldest-by-rebuild order).
 */
async function rebuildAudioMetadata() {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const keys = await cache.keys();
    const metadata = [];

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        metadata.push({
          url: request.url,
          size: blob.size,
          cachedAt: Date.now(),
          lastAccessed: Date.now(),
        });
      }
    }

    audioMetadataCache = metadata;
    return metadata;
  } catch (error) {
    console.error('[SW] Failed to rebuild audio metadata:', error);
    return [];
  }
}

// ============================================================================
// Standard Caching Strategies
// ============================================================================

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
    // Only cache full responses (200), not partial (206) which can't be cached
    if (response.ok && response.status === 200) {
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
    // Only cache full responses (200), not partial (206) which can't be cached
    if (response.ok && response.status === 200) {
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

// ============================================================================
// URL Type Checks
// ============================================================================

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname);
}

/**
 * Check if URL is an audio file
 */
function isAudioFile(pathname) {
  return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(pathname);
}

/**
 * Check if URL is a video file (not cached)
 */
function isVideoFile(pathname) {
  return /\.(mp4|webm|mkv|avi)$/i.test(pathname);
}

// ============================================================================
// Message Handlers
// ============================================================================

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
    event.waitUntil(
      (async () => {
        try {
          const keys = await caches.keys();
          const geetanjaliCaches = keys.filter((key) => key.startsWith('geetanjali-'));
          await Promise.all(geetanjaliCaches.map((key) => caches.delete(key)));
          audioMetadataCache = null;

          if (event.source) {
            event.source.postMessage({ type: 'CACHES_CLEARED' });
          }
        } catch (error) {
          console.error('[SW] Failed to clear caches:', error);
          if (event.source) {
            event.source.postMessage({ type: 'CACHES_CLEAR_FAILED', error: error.message });
          }
        }
      })()
    );
  }

  // Audio cache specific messages
  if (event.data?.type === 'GET_AUDIO_CACHE_STATUS') {
    event.waitUntil(
      (async () => {
        try {
          const metadata = await rebuildAudioMetadata();
          const totalSize = metadata.reduce((sum, m) => sum + m.size, 0);
          const count = metadata.length;

          if (event.source) {
            event.source.postMessage({
              type: 'AUDIO_CACHE_STATUS',
              data: {
                count,
                totalSize,
                maxSize: MAX_AUDIO_CACHE_SIZE,
                files: metadata.map((m) => ({
                  url: m.url,
                  size: m.size,
                })),
              },
            });
          }
        } catch (error) {
          console.error('[SW] Failed to get audio cache status:', error);
        }
      })()
    );
  }

  if (event.data?.type === 'CHECK_AUDIO_CACHED') {
    const audioUrl = event.data.url;
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(AUDIO_CACHE);
          const url = new URL(audioUrl);
          const cacheKey = url.origin + url.pathname;
          const cached = await cache.match(cacheKey);

          if (event.source) {
            event.source.postMessage({
              type: 'AUDIO_CACHED_RESULT',
              url: audioUrl,
              cached: !!cached,
            });
          }
        } catch (error) {
          console.error('[SW] Failed to check audio cache:', error);
        }
      })()
    );
  }

  if (event.data?.type === 'CLEAR_AUDIO_CACHE') {
    event.waitUntil(
      (async () => {
        try {
          await caches.delete(AUDIO_CACHE);
          audioMetadataCache = null;

          if (event.source) {
            event.source.postMessage({ type: 'AUDIO_CACHE_CLEARED' });
          }
        } catch (error) {
          console.error('[SW] Failed to clear audio cache:', error);
          if (event.source) {
            event.source.postMessage({ type: 'AUDIO_CACHE_CLEAR_FAILED', error: error.message });
          }
        }
      })()
    );
  }
});

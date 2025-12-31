/**
 * Audio Preloading Utility
 *
 * Uses fetch() to preload audio files into the browser's HTTP cache.
 * When AudioPlayerContext later creates an Audio element with the same URL,
 * it hits the cache instead of making a new network request.
 *
 * Features:
 * - Browser-native HTTP caching
 * - Deduplication (won't preload same URL twice)
 * - Connection-aware (skips on slow connections)
 * - Concurrent request limiting
 */

// Track URLs that have been preloaded or are in progress
const preloadedUrls = new Set<string>();
const preloadingUrls = new Set<string>();

// Maximum concurrent preloads
const MAX_CONCURRENT_PRELOADS = 3;

/**
 * Check if we should skip preloading on slow connections
 */
function shouldSkipPreload(): boolean {
  if (typeof navigator === "undefined") return false;

  // Check Network Information API (Chrome/Edge only, graceful fallback)
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;

  if (connection) {
    // Skip on slow connections
    if (
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g"
    ) {
      return true;
    }
    // Respect data saver mode
    if (connection.saveData) {
      return true;
    }
  }

  return false;
}

/**
 * Preload a single audio file using fetch
 *
 * Fetches the audio file to populate the browser's HTTP cache.
 * The response body is discarded but the cache entry remains.
 *
 * @param url - Audio URL to preload
 */
export function preloadAudio(url: string): void {
  // Already preloaded or in progress
  if (preloadedUrls.has(url) || preloadingUrls.has(url)) {
    return;
  }

  // Skip on slow connections
  if (shouldSkipPreload()) {
    return;
  }

  // Limit concurrent preloads
  if (preloadingUrls.size >= MAX_CONCURRENT_PRELOADS) {
    return;
  }

  preloadingUrls.add(url);

  fetch(url, {
    method: "GET",
    // Use cache to ensure response is cached
    cache: "default",
    // Don't need credentials for audio files
    credentials: "omit",
  })
    .then((response) => {
      if (response.ok) {
        preloadedUrls.add(url);
      }
      // Consume and discard the body to complete the request
      // This ensures the response is fully cached
      return response.blob();
    })
    .then(() => {
      preloadingUrls.delete(url);
    })
    .catch(() => {
      preloadingUrls.delete(url);
      // Track errors for debugging
      if (window.umami) {
        window.umami.track("audio_preload_error", { url });
      }
    });
}

/**
 * Preload multiple audio files
 *
 * @param urls - Array of audio URLs to preload
 */
export function preloadAudioBatch(urls: (string | null | undefined)[]): void {
  const validUrls = urls.filter((url): url is string => !!url);
  validUrls.forEach(preloadAudio);
}

/**
 * Check if an audio URL has been preloaded
 */
export function isPreloaded(url: string): boolean {
  return preloadedUrls.has(url);
}

/**
 * Clear preload tracking (browser cache is not affected)
 */
export function clearPreloadCache(): void {
  preloadedUrls.clear();
}

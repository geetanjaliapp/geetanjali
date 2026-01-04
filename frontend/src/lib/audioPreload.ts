/**
 * Audio Preloading Utility
 *
 * Preloads audio files directly into the Service Worker's audio cache.
 * This ensures Audio element requests (intercepted by SW) hit the cache.
 *
 * Features:
 * - Direct SW cache population (not browser HTTP cache)
 * - Deduplication (won't preload same URL twice)
 * - Connection-aware (skips on slow connections)
 * - Concurrent request limiting
 * - Graceful fallback if SW unavailable
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
 * Preload a single audio file into Service Worker cache
 *
 * Messages the SW to fetch and cache the audio file, ensuring
 * subsequent Audio element requests hit the cache.
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

  // Try to use Service Worker cache for consistency with audio playback
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    // Message SW to preload audio into its cache
    navigator.serviceWorker.controller.postMessage({
      type: "PRELOAD_AUDIO",
      url,
    });

    // Handler for SW response
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "AUDIO_PRELOADED" && event.data.url === url) {
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener("message", handleMessage);
        preloadingUrls.delete(url);
        if (event.data.success) {
          preloadedUrls.add(url);
        }
      }
    };

    // Timeout to prevent memory leak if SW never responds
    const timeoutId = setTimeout(() => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      preloadingUrls.delete(url);
    }, 30000); // 30s timeout for large files

    navigator.serviceWorker.addEventListener("message", handleMessage);
  } else {
    // Fallback: use fetch to at least warm browser cache
    fetch(url, {
      method: "GET",
      cache: "default",
      credentials: "omit",
    })
      .then((response) => {
        if (response.ok) {
          preloadedUrls.add(url);
        }
        return response.blob();
      })
      .then(() => {
        preloadingUrls.delete(url);
      })
      .catch(() => {
        preloadingUrls.delete(url);
        if (window.umami) {
          window.umami.track("audio_preload_error", { url });
        }
      });
  }
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

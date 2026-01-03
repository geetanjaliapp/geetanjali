/**
 * useAudioCache - Hook for audio cache status and management
 *
 * Communicates with the Service Worker to:
 * - Check if specific audio files are cached
 * - Get overall cache statistics
 * - Clear the audio cache
 *
 * @since v1.19.0
 */

import { useState, useEffect, useCallback } from "react";

// Audio cache name (must match sw.js)
const AUDIO_CACHE_NAME = "geetanjali-audio-v1";

export interface AudioCacheStatus {
  /** Number of cached audio files */
  count: number;
  /** Total size in bytes */
  totalSize: number;
  /** Maximum cache size in bytes */
  maxSize: number;
  /** List of cached files */
  files: Array<{ url: string; size: number }>;
}

/**
 * Check if Service Worker is available and controlling the page
 * Guards against SSR where navigator is undefined
 */
function isServiceWorkerReady(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker.controller !== null
  );
}

/**
 * Send a message to the Service Worker and wait for response
 */
function sendMessageToSW<T>(
  message: { type: string; [key: string]: unknown },
  responseType: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isServiceWorkerReady()) {
      reject(new Error("Service Worker not ready"));
      return;
    }

    // Listen for response on message channel
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === responseType) {
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener("message", handleMessage);
        resolve(event.data as T);
      }
    };

    const timeoutId = setTimeout(() => {
      // Clean up listener on timeout to prevent memory leak
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      reject(new Error("Service Worker response timeout"));
    }, timeout);

    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Send message to SW
    navigator.serviceWorker.controller!.postMessage(message);
  });
}

/**
 * Hook to check if a specific audio URL is cached
 */
export function useAudioCached(audioUrl: string | null | undefined): {
  isCached: boolean;
  isChecking: boolean;
} {
  const [isCached, setIsCached] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!audioUrl || typeof caches === "undefined") {
      setIsCached(false);
      return;
    }

    // Check cache using the Cache API directly (faster than SW message)
    async function checkCache() {
      setIsChecking(true);
      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        // audioUrl is guaranteed to be defined here due to the early return above
        const url = new URL(audioUrl as string);
        const cacheKey = url.origin + url.pathname;
        const cached = await cache.match(cacheKey);
        setIsCached(!!cached);
      } catch {
        setIsCached(false);
      } finally {
        setIsChecking(false);
      }
    }

    checkCache();
  }, [audioUrl]);

  return { isCached, isChecking };
}

/**
 * Hook for audio cache management
 */
export function useAudioCacheStatus(): {
  status: AudioCacheStatus | null;
  isLoading: boolean;
  refresh: () => void;
  clearCache: () => Promise<void>;
} {
  const [status, setStatus] = useState<AudioCacheStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!isServiceWorkerReady()) {
      setStatus(null);
      return;
    }

    setIsLoading(true);

    // Request cache status from SW
    sendMessageToSW<{ type: string; data: AudioCacheStatus }>(
      { type: "GET_AUDIO_CACHE_STATUS" },
      "AUDIO_CACHE_STATUS"
    )
      .then((response) => {
        setStatus(response.data);
      })
      .catch((error) => {
        console.error("Failed to get audio cache status:", error);
        setStatus(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const clearCache = useCallback(async () => {
    if (!isServiceWorkerReady()) {
      throw new Error("Service Worker not ready");
    }

    await sendMessageToSW(
      { type: "CLEAR_AUDIO_CACHE" },
      "AUDIO_CACHE_CLEARED"
    );

    // Refresh status after clearing
    refresh();
  }, [refresh]);

  // Load status on mount
  useEffect(() => {
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: load initial data on mount
  }, [refresh]);

  return { status, isLoading, refresh, clearCache };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

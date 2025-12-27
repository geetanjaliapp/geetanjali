/**
 * Version Check Utility (Proactive Cache Invalidation)
 *
 * Detects when a new app version is deployed and triggers cache invalidation.
 * This is a **supplementary optimization** for long-running sessions.
 *
 * ## Defense in Depth
 * - **Primary defense**: `lazyWithRetry.ts` handles chunk 404s with automatic reload
 * - **This utility**: Proactively clears caches to reduce unnecessary reload attempts
 *
 * ## How it works:
 * 1. On each build, Vite generates /version.json with build timestamp
 * 2. On app init + periodic checks, we fetch /version.json
 * 3. If version changed (new deploy), we clear SW caches preemptively
 * 4. This reduces (but doesn't eliminate) chunk 404s on next navigation
 *
 * ## Important Notes:
 * - Version check is async and doesn't block first navigation
 * - Users who navigate immediately after load may still hit chunk 404s
 * - This is handled gracefully by lazyWithRetry's reload mechanism
 */

import { INFRA_KEYS, setStorageItemRaw } from "./storage";
import { CHUNK_RELOAD_KEY } from "./lazyWithRetry";

const VERSION_STORAGE_KEY = INFRA_KEYS.appVersion;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface VersionInfo {
  version: string;
  buildTime: string;
}

/**
 * Get stored version from localStorage
 */
function getStoredVersion(): string | null {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Store version in localStorage
 */
function storeVersion(version: string): void {
  setStorageItemRaw(VERSION_STORAGE_KEY, version);
}

/**
 * Clear all service worker caches
 */
async function clearServiceWorkerCaches(): Promise<void> {
  if ("caches" in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("geetanjali-"))
          .map((name) => caches.delete(name))
      );
    } catch (error) {
      console.warn("[VersionCheck] Failed to clear caches:", error);
    }
  }
}

/**
 * Signal the service worker to update
 */
async function signalServiceWorkerUpdate(): Promise<void> {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      console.warn("[VersionCheck] Failed to signal SW:", error);
    }
  }
}

/**
 * Fetch current version from server
 */
async function fetchCurrentVersion(): Promise<VersionInfo | null> {
  try {
    // Add cache-busting query param to bypass any caching
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      // version.json might not exist in dev mode
      return null;
    }

    return await response.json();
  } catch {
    // Network error or JSON parse error
    return null;
  }
}

/**
 * Check if app version has changed and handle cache invalidation.
 *
 * Call this on app initialization (in main.tsx or similar).
 * Returns true if version changed (caches were cleared).
 */
export async function checkAppVersion(): Promise<boolean> {
  // Only run in production
  if (import.meta.env.DEV) {
    return false;
  }

  const currentVersionInfo = await fetchCurrentVersion();
  if (!currentVersionInfo) {
    return false;
  }

  const storedVersion = getStoredVersion();
  const currentVersion = currentVersionInfo.version;

  // First time visiting - just store the version
  if (!storedVersion) {
    storeVersion(currentVersion);
    return false;
  }

  // Version unchanged - no action needed
  if (storedVersion === currentVersion) {
    return false;
  }

  // Version changed - clear caches and update stored version
  // Clear service worker caches
  await clearServiceWorkerCaches();

  // Signal SW to update if there's a waiting worker
  await signalServiceWorkerUpdate();

  // Store new version
  storeVersion(currentVersion);

  // Clear the chunk reload marker so fresh reload works if needed
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Ignore
  }

  return true;
}

/**
 * Start periodic version checks (for long-running sessions).
 *
 * This is useful for users who keep the app open for a long time.
 * If a new version is detected during a check, caches are cleared
 * so the next navigation will get fresh chunks.
 *
 * Uses visibility API to:
 * - Pause checks when tab is hidden (saves network requests)
 * - Check immediately when tab becomes visible (catches deploys while away)
 */
export function startPeriodicVersionCheck(): () => void {
  // Only run in production
  if (import.meta.env.DEV) {
    return () => {};
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const runCheck = async () => {
    await checkAppVersion();
  };

  const startInterval = () => {
    if (intervalId === null) {
      intervalId = setInterval(runCheck, VERSION_CHECK_INTERVAL);
    }
  };

  const stopInterval = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab hidden - pause checks to save resources
      stopInterval();
    } else {
      // Tab visible - check immediately and resume periodic checks
      runCheck();
      startInterval();
    }
  };

  // Start checking if tab is visible
  if (!document.hidden) {
    startInterval();
  }

  // Listen for visibility changes
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Return cleanup function
  return () => {
    stopInterval();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

export default checkAppVersion;

/**
 * Version Check Utility
 *
 * Detects when a new app version is deployed and triggers cache invalidation.
 * This ensures users always get fresh chunks after deployments.
 *
 * ## How it works:
 * 1. On each build, Vite generates /version.json with build timestamp
 * 2. On app init, we fetch /version.json and compare with stored version
 * 3. If version changed (new deploy), we clear SW caches and stored version
 * 4. This ensures next navigation fetches fresh chunks
 */

const VERSION_STORAGE_KEY = "app_version";
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
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    // localStorage might be unavailable
  }
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
          .map((name) => {
            console.log("[VersionCheck] Clearing cache:", name);
            return caches.delete(name);
          })
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
    console.log("[VersionCheck] First visit, storing version:", currentVersion);
    storeVersion(currentVersion);
    return false;
  }

  // Version unchanged - no action needed
  if (storedVersion === currentVersion) {
    return false;
  }

  // Version changed - clear caches and update stored version
  console.log(
    `[VersionCheck] New version detected: ${storedVersion} → ${currentVersion}`
  );

  // Clear service worker caches
  await clearServiceWorkerCaches();

  // Signal SW to update if there's a waiting worker
  await signalServiceWorkerUpdate();

  // Store new version
  storeVersion(currentVersion);

  // Clear the chunk reload marker so fresh reload works if needed
  try {
    sessionStorage.removeItem("chunk_reload_attempt");
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
 */
export function startPeriodicVersionCheck(): () => void {
  // Only run in production
  if (import.meta.env.DEV) {
    return () => {};
  }

  const intervalId = setInterval(async () => {
    const versionChanged = await checkAppVersion();
    if (versionChanged) {
      console.log(
        "[VersionCheck] New version available - caches cleared for next navigation"
      );
    }
  }, VERSION_CHECK_INTERVAL);

  // Return cleanup function
  return () => clearInterval(intervalId);
}

export default checkAppVersion;

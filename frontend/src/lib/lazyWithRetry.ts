import { lazy } from "react";
import type { ComponentType } from "react";
import { SESSION_KEYS } from "./storage";

/**
 * Configuration for chunk load retry behavior
 */
const CONFIG = {
  /** Maximum number of import retry attempts before page reload */
  MAX_RETRIES: 3,
  /** Base delay in ms for exponential backoff (doubles each retry) */
  RETRY_BASE_DELAY: 1000,
  /** Time window in ms before allowing another reload (prevents infinite loops) */
  RELOAD_EXPIRY: 30000, // 30 seconds
};

/** Storage key for tracking reload attempts (exported for use in versionCheck.ts) */
export const CHUNK_RELOAD_KEY = SESSION_KEYS.chunkReloadAttempt;

/**
 * Known chunk loading error patterns across different browsers.
 * These patterns indicate the chunk file couldn't be loaded (404, network error, etc.)
 */
const CHUNK_ERROR_PATTERNS = [
  // Vite/ESM errors
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  // Webpack errors
  "loading chunk",
  "loading css chunk",
  // Generic patterns
  "failed to load",
  "unable to preload",
  // Network errors that might affect chunks
  "networkerror when attempting to fetch resource",
  "load failed",
  // Safari-specific
  "undefined is not an object",
  // Firefox-specific
  "error when evaluating a module script",
];

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is a chunk loading failure (404, network error, etc.)
 * Matches against known error patterns from different browsers.
 */
function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Atomically check if we should reload AND mark the attempt.
 * This prevents race conditions where multiple failed lazy imports
 * could all pass the check before any marks the attempt.
 *
 * Returns true if reload is allowed (and marks the attempt).
 * Returns false if a recent reload was detected (cooldown active).
 */
function tryMarkReloadAttempt(): boolean {
  try {
    const now = Date.now();
    const lastAttempt = sessionStorage.getItem(CHUNK_RELOAD_KEY);

    if (lastAttempt) {
      const timestamp = parseInt(lastAttempt, 10);
      if (!isNaN(timestamp) && now - timestamp < CONFIG.RELOAD_EXPIRY) {
        // Recent reload detected - don't allow another
        return false;
      }
    }

    // Atomically mark the attempt immediately after check passes
    sessionStorage.setItem(CHUNK_RELOAD_KEY, now.toString());
    return true;
  } catch {
    // sessionStorage unavailable - allow reload but can't prevent loops
    // This is acceptable as private browsing sessions are ephemeral anyway
    return true;
  }
}

/**
 * Log chunk loading events for debugging
 */
function logChunkEvent(
  event: "retry" | "reload" | "error",
  details: { attempt?: number; error?: unknown }
): void {
  const prefix = "[lazyWithRetry]";

  switch (event) {
    case "retry":
      console.warn(
        `${prefix} Chunk load failed, retrying (attempt ${details.attempt}/${CONFIG.MAX_RETRIES})...`,
        details.error
      );
      break;
    case "reload":
      console.warn(
        `${prefix} All retries exhausted, reloading page to fetch new chunks...`,
        details.error
      );
      break;
    case "error":
      console.error(
        `${prefix} Chunk load failed and reload not possible (recent reload detected)`,
        details.error
      );
      break;
  }
}

/**
 * Wrapper around React.lazy that handles chunk loading failures gracefully.
 *
 * ## Problem
 * When a new deployment changes chunk hashes (e.g., `About-abc123.js` → `About-def456.js`),
 * users with the old app version in their browser get 404 errors when navigating
 * to lazy-loaded routes because the old chunk files no longer exist.
 *
 * ## Solution
 * This wrapper:
 * 1. Retries the import up to 3 times with exponential backoff (handles transient network errors)
 * 2. If all retries fail, reloads the page to fetch the new app version
 * 3. Includes protection against infinite reload loops (30 second cooldown)
 *
 * ## Usage
 * ```tsx
 * // Instead of:
 * const MyPage = lazy(() => import("./pages/MyPage"));
 *
 * // Use:
 * const MyPage = lazyWithRetry(() => import("./pages/MyPage"));
 * ```
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error;

        // Only retry on chunk load errors (not on module syntax errors, etc.)
        if (!isChunkLoadError(error)) {
          throw error;
        }

        // Log retry attempt
        if (attempt < CONFIG.MAX_RETRIES) {
          logChunkEvent("retry", { attempt, error });
          // Exponential backoff: 1s, 2s, 4s...
          await sleep(CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries exhausted - atomically check and mark reload attempt
    if (tryMarkReloadAttempt()) {
      logChunkEvent("reload", { error: lastError });

      // Force page reload to get new chunks
      window.location.reload();

      // Return a never-resolving promise while reload happens
      // This prevents React from showing an error boundary
      return new Promise(() => {});
    }

    // We've already reloaded recently - don't get stuck in a loop
    // Let the error boundary handle this
    logChunkEvent("error", { error: lastError });
    throw lastError;
  });
}

export default lazyWithRetry;

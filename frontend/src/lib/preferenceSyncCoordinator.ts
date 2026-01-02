/**
 * Preference Sync Coordinator
 *
 * Consolidates preference API calls to avoid rate limiting.
 *
 * Problem: 4 independent sync hooks (favorites, goals, reading, theme) each
 * make their own API calls, potentially hitting the 10/minute rate limit.
 *
 * Solution: Centralized coordination for both merge (login) and update operations.
 *
 * Merge Flow (login):
 * 1. Each hook calls requestMerge() when login is detected
 * 2. Coordinator batches all into a single API call (100ms window)
 * 3. Results distributed via registered callbacks
 *
 * Update Flow (ongoing changes):
 * 1. Each hook calls requestUpdate() when preferences change
 * 2. Coordinator debounces updates (30s window, same as before)
 * 3. Batches multiple preference types if they change within window
 *
 * Flush Flow (page leave):
 * 1. Call initFlushHandlers() once at app startup
 * 2. Coordinator auto-flushes on visibility change / page unload
 */

import type {
  LocalPreferences,
  UserPreferences,
  PreferencesUpdate,
} from "../types";
import { preferencesApi } from "./api";

// ============================================================================
// DEBUG LOGGING
// ============================================================================

const DEBUG = import.meta.env.DEV;

function log(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.log(`[PreferenceSync] ${message}`, data);
    } else {
      console.log(`[PreferenceSync] ${message}`);
    }
  }
}

// ============================================================================
// MERGE COORDINATION (login)
// ============================================================================

// Debounce window to batch simultaneous merge requests (ms)
// Short window since we just need to batch hooks firing in same tick
const MERGE_BATCH_WINDOW_MS = 100;

// Throttle to prevent 429 on rapid login/logout cycles
const MERGE_THROTTLE_MS = 10000;

// Module-level state
let lastMergeTimestamp = 0;
let batchTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isMerging = false;

// Pending preference data from each source
interface PendingMergeData {
  favorites?: LocalPreferences["favorites"];
  learning_goals?: LocalPreferences["learning_goals"];
  reading?: LocalPreferences["reading"];
  theme?: LocalPreferences["theme"];
}

let pendingData: PendingMergeData = {};

// Callbacks to distribute results
type MergeResultCallback = (merged: UserPreferences) => void;
const pendingCallbacks: Set<MergeResultCallback> = new Set();

// Promise resolvers for all callers (fixes race condition)
type MergeResolver = (result: UserPreferences | null) => void;
const pendingResolvers: Set<MergeResolver> = new Set();

/**
 * Request a merge with the server.
 *
 * Multiple calls within MERGE_BATCH_WINDOW_MS are batched into one API call.
 * All callers receive the same result when the batch completes.
 *
 * @param data - The local preference data to merge (partial - only include what you have)
 * @param onResult - Callback to receive the merged result
 * @returns Promise that resolves when merge completes (null if throttled/skipped)
 */
export async function requestMerge(
  data: Partial<PendingMergeData>,
  onResult?: MergeResultCallback,
): Promise<UserPreferences | null> {
  log("requestMerge called", { types: Object.keys(data) });

  // Always accumulate data first (so it's queued even if this call is throttled)
  if (data.favorites) pendingData.favorites = data.favorites;
  if (data.learning_goals) pendingData.learning_goals = data.learning_goals;
  if (data.reading) pendingData.reading = data.reading;
  if (data.theme) pendingData.theme = data.theme;

  // Throttle check - prevent rapid merge calls
  const now = Date.now();
  if (now - lastMergeTimestamp < MERGE_THROTTLE_MS) {
    return null;
  }

  // Skip if already merging (data accumulated above will be used in next batch)
  if (isMerging) {
    return null;
  }

  // Register callback
  if (onResult) {
    pendingCallbacks.add(onResult);
  }

  // Debounce - wait for all hooks to register their data
  if (batchTimeoutId) {
    clearTimeout(batchTimeoutId);
  }

  return new Promise((resolve) => {
    // Track this resolver so ALL callers get the result
    pendingResolvers.add(resolve);

    batchTimeoutId = setTimeout(async () => {
      batchTimeoutId = null;

      // Skip if no data accumulated
      if (Object.keys(pendingData).length === 0) {
        // Resolve all pending promises with null
        pendingResolvers.forEach((r) => r(null));
        pendingResolvers.clear();
        return;
      }

      // Mark as merging and update timestamp
      isMerging = true;
      lastMergeTimestamp = Date.now();

      // Capture current state and clear for next batch
      const dataToMerge = { ...pendingData };
      const callbacks = new Set(pendingCallbacks);
      const resolvers = new Set(pendingResolvers);
      pendingData = {};
      pendingCallbacks.clear();
      pendingResolvers.clear();

      try {
        // Single API call with all preference types
        log("Merge executing", { types: Object.keys(dataToMerge) });
        const merged = await preferencesApi.merge(dataToMerge);
        log("Merge completed successfully");

        // Notify all registered callbacks
        callbacks.forEach((cb) => cb(merged));

        // Resolve ALL pending promises (not just the last caller)
        resolvers.forEach((r) => r(merged));
      } catch (error) {
        log("Merge failed", error);
        console.error("[PreferenceSyncCoordinator] Merge failed:", error);
        // Resolve all with null on error
        resolvers.forEach((r) => r(null));
      } finally {
        isMerging = false;
      }
    }, MERGE_BATCH_WINDOW_MS);
  });
}

/**
 * Check if a merge is currently in progress.
 */
export function isMergeInProgress(): boolean {
  return isMerging;
}

/**
 * Check if merge is currently throttled.
 */
export function isMergeThrottled(): boolean {
  return Date.now() - lastMergeTimestamp < MERGE_THROTTLE_MS;
}

/**
 * Reset coordinator state (for testing).
 *
 * Resolves all pending promises before clearing to prevent hanging awaits.
 */
export function resetCoordinator(): void {
  if (batchTimeoutId) {
    clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }
  if (updateTimeoutId) {
    clearTimeout(updateTimeoutId);
    updateTimeoutId = null;
  }

  // Resolve pending promises before clearing to prevent test hangs
  pendingResolvers.forEach((r) => r(null));
  pendingUpdateResolvers.forEach((r) => r());

  lastMergeTimestamp = 0;
  lastUpdateTimestamp = 0;
  isMerging = false;
  isUpdating = false;
  pendingData = {};
  pendingCallbacks.clear();
  pendingResolvers.clear();
  pendingUpdateData = {};
  pendingUpdateResolvers.clear();
}

// ============================================================================
// UPDATE COORDINATION (ongoing changes)
// ============================================================================

// Debounce window for batching updates (5s - responsive to user actions)
const UPDATE_DEBOUNCE_MS = 5000;

// Minimum interval between update calls (prevents rapid-fire during batch window)
const UPDATE_THROTTLE_MS = 5000;

// Module-level state for updates
let lastUpdateTimestamp = 0;
let updateTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isUpdating = false;

// Pending update data
let pendingUpdateData: PreferencesUpdate = {};

// Promise resolvers for update callers
type UpdateResolver = () => void;
const pendingUpdateResolvers: Set<UpdateResolver> = new Set();

/**
 * Request a preference update (debounced and batched).
 *
 * Multiple calls within UPDATE_DEBOUNCE_MS are batched into one API call.
 * This consolidates updates from all preference types.
 *
 * @param data - The preference data to update (partial)
 * @returns Promise that resolves when update completes (or is scheduled)
 */
export async function requestUpdate(data: PreferencesUpdate): Promise<void> {
  log("requestUpdate called", { types: Object.keys(data) });

  // Accumulate data from this source
  if (data.favorites) pendingUpdateData.favorites = data.favorites;
  if (data.learning_goals)
    pendingUpdateData.learning_goals = data.learning_goals;
  if (data.reading) pendingUpdateData.reading = data.reading;
  if (data.theme) pendingUpdateData.theme = data.theme;

  // Debounce - reset timer on each call
  if (updateTimeoutId) {
    clearTimeout(updateTimeoutId);
  }

  return new Promise((resolve) => {
    // Track this resolver so ALL callers get notified
    pendingUpdateResolvers.add(resolve);

    const executeUpdate = async () => {
      updateTimeoutId = null;

      // Skip if no data or already updating
      if (Object.keys(pendingUpdateData).length === 0 || isUpdating) {
        pendingUpdateResolvers.forEach((r) => r());
        pendingUpdateResolvers.clear();
        return;
      }

      // Throttle check - reschedule instead of dropping data
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimestamp;
      if (timeSinceLastUpdate < UPDATE_THROTTLE_MS) {
        // Reschedule for when throttle expires
        const delay = UPDATE_THROTTLE_MS - timeSinceLastUpdate;
        updateTimeoutId = setTimeout(executeUpdate, delay);
        return;
      }

      isUpdating = true;
      lastUpdateTimestamp = now;

      // Capture and clear pending data
      const dataToUpdate = { ...pendingUpdateData };
      const resolvers = new Set(pendingUpdateResolvers);
      pendingUpdateData = {};
      pendingUpdateResolvers.clear();

      try {
        log("Update executing", { types: Object.keys(dataToUpdate) });
        await preferencesApi.update(dataToUpdate);
        log("Update completed successfully");
      } catch (error) {
        log("Update failed", error);
        console.error("[PreferenceSyncCoordinator] Update failed:", error);
      } finally {
        isUpdating = false;
      }

      // Resolve all pending promises
      resolvers.forEach((r) => r());
    };

    updateTimeoutId = setTimeout(executeUpdate, UPDATE_DEBOUNCE_MS);
  });
}

/**
 * Flush pending updates immediately (for page unload/visibility change).
 *
 * Skips debounce and sends immediately. Used when user is leaving the page.
 */
export function flushUpdates(): void {
  log("flushUpdates called");

  if (updateTimeoutId) {
    clearTimeout(updateTimeoutId);
    updateTimeoutId = null;
  }

  // Resolve any pending update promises (they won't wait for the flush)
  pendingUpdateResolvers.forEach((r) => r());
  pendingUpdateResolvers.clear();

  // Skip if no data or already updating
  if (Object.keys(pendingUpdateData).length === 0 || isUpdating) {
    log("flushUpdates skipped (no data or already updating)");
    return;
  }

  isUpdating = true;
  const dataToUpdate = { ...pendingUpdateData };
  pendingUpdateData = {};

  log("flushUpdates executing", { types: Object.keys(dataToUpdate) });

  // Fire and forget - we're leaving the page
  preferencesApi
    .update(dataToUpdate)
    .then(() => {
      log("flushUpdates completed successfully");
    })
    .catch((error) => {
      log("flushUpdates failed", error);
      console.error("[PreferenceSyncCoordinator] Flush update failed:", error);
    })
    .finally(() => {
      isUpdating = false;
    });
}

/**
 * Check if an update is currently in progress.
 */
export function isUpdateInProgress(): boolean {
  return isUpdating;
}

/**
 * Check if there are pending updates waiting to be sent.
 */
export function hasPendingUpdates(): boolean {
  return Object.keys(pendingUpdateData).length > 0;
}

// ============================================================================
// FLUSH HANDLERS (visibility change / page unload)
// ============================================================================

let flushHandlersInitialized = false;

/**
 * Initialize flush handlers for visibility change and page unload.
 *
 * Call this once at app startup (e.g., in main.tsx).
 * Ensures pending updates are flushed when user leaves the page.
 *
 * @returns Cleanup function to remove handlers
 */
export function initFlushHandlers(): () => void {
  // Prevent double initialization
  if (flushHandlersInitialized) {
    return () => {};
  }
  flushHandlersInitialized = true;

  const handleUnload = () => {
    flushUpdates();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushUpdates();
    }
  };

  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("pagehide", handleUnload);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.removeEventListener("beforeunload", handleUnload);
    window.removeEventListener("pagehide", handleUnload);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    flushHandlersInitialized = false;
  };
}

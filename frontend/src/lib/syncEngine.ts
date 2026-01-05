/**
 * SyncEngine - Production-grade preference synchronization
 *
 * Core sync logic extracted from React, enabling:
 * - Testability without React test utilities
 * - Single source of truth for sync state
 * - Tiered debouncing based on update frequency
 * - Retry with exponential backoff
 * - Offline handling with auto-reconnect
 *
 * ## Conflict Resolution Strategy
 *
 * Conflict resolution is handled **server-side** using timestamp-based
 * last-write-wins semantics:
 *
 * 1. **On login (merge)**: Client sends local preferences with `updated_at`
 *    timestamps. Server compares with stored timestamps and returns the
 *    newer value for each preference type.
 *
 * 2. **On update**: Client sends current values. Server overwrites stored
 *    values (no conflict possible - single source of truth per user).
 *
 * 3. **Multi-device**: Each device merges on login. The device with the
 *    most recent `updated_at` wins for each preference type.
 *
 * This approach is simple and predictable. For preferences (favorites,
 * goals, reading position), last-write-wins is appropriate since these
 * represent user intent at a point in time.
 *
 * Part of v1.17.3 preference sync improvements.
 */

import type { LocalPreferences, UserPreferences, PreferencesUpdate } from "../types";
import { preferencesApi, getCsrfToken } from "./api";
import { tokenStorage } from "../api/auth";
import { API_BASE_URL, API_V1_PREFIX } from "./config";

// ============================================================================
// TYPES
// ============================================================================

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export type PreferenceType = "favorites" | "goals" | "reading" | "theme";

export interface SyncState {
  status: SyncStatus;
  lastSynced: Date | null;
  pendingCount: number;
  error: Error | null;
}

export interface SyncConfig {
  /** Tiered debounce times (ms) based on update frequency */
  debounceMs: {
    reading: number;   // High frequency (every verse navigation)
    fontSize: number;  // Medium frequency (user may adjust multiple times)
    favorites: number; // Discrete action
    goals: number;     // Intentional selection
    theme: number;     // Intentional change
  };
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry backoff intervals (ms) */
  retryBackoffMs: number[];
  /** Minimum interval between merges (ms) */
  mergeThrottleMs: number;
}

interface PendingChange {
  type: PreferenceType;
  data: unknown;
  timestamp: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: SyncConfig = {
  debounceMs: {
    reading: 15000,   // 15s - high frequency updates
    fontSize: 10000,  // 10s - medium frequency
    favorites: 5000,  // 5s - discrete actions
    goals: 5000,      // 5s - intentional selection
    theme: 5000,      // 5s - intentional change
  },
  maxRetries: 3,
  retryBackoffMs: [1000, 5000, 15000],
  mergeThrottleMs: 10000,
};

// ============================================================================
// DEBUG LOGGING
// ============================================================================

// Debug logging disabled in production - uncomment for local debugging
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function log(_message: string, _data?: unknown): void {
  // No-op in production
}

// ============================================================================
// SYNC ENGINE CLASS
// ============================================================================

export class SyncEngine {
  private queue: Map<PreferenceType, PendingChange> = new Map();
  private debounceTimers: Map<PreferenceType, ReturnType<typeof setTimeout>> = new Map();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private lastMergeTimestamp = 0;
  private isMerging = false;
  private isFlushing = false;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private listeners: Set<(state: SyncState) => void> = new Set();
  private state: SyncState = {
    status: "idle",
    lastSynced: null,
    pendingCount: 0,
    error: null,
  };
  private api: typeof preferencesApi;
  private config: SyncConfig;

  constructor(
    api: typeof preferencesApi = preferencesApi,
    config: SyncConfig = DEFAULT_CONFIG
  ) {
    this.api = api;
    this.config = config;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to sync state changes.
   * Returns unsubscribe function.
   */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current sync state.
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Queue an update for a specific preference type.
   * Updates are debounced based on type.
   */
  update(type: PreferenceType, data: unknown): void {
    log(`update called: ${type}`);

    // Add to queue (overwrites previous for same type)
    this.queue.set(type, {
      type,
      data,
      timestamp: Date.now(),
    });

    // Update pending count
    this.updateState({ pendingCount: this.queue.size });

    // Clear any existing timer for this type
    const existingTimer = this.debounceTimers.get(type);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule debounced flush with type-specific timing
    const debounceMs = this.getDebounceForType(type);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(type);
      this.executeFlush();
    }, debounceMs);

    this.debounceTimers.set(type, timer);
    log(`update queued with ${debounceMs}ms debounce`);
  }

  /**
   * Merge local preferences with server (called on login).
   *
   * Sends local preferences with `updated_at` timestamps to the server.
   * Server compares timestamps and returns the winning value for each
   * preference type (last-write-wins). Client then applies the merged
   * result to both state and localStorage.
   *
   * @param local - Local preferences with timestamps from getAllForMerge()
   * @returns Merged preferences from server, or null if throttled/failed
   */
  async merge(local: LocalPreferences): Promise<UserPreferences | null> {
    const now = Date.now();

    // Throttle check
    if (now - this.lastMergeTimestamp < this.config.mergeThrottleMs) {
      log("merge throttled");
      return null;
    }

    // Skip if already merging
    if (this.isMerging) {
      log("merge skipped (already merging)");
      return null;
    }

    this.isMerging = true;
    this.lastMergeTimestamp = now;
    this.updateState({ status: "syncing", error: null });

    log("merge executing", { types: Object.keys(local) });

    try {
      const merged = await this.api.merge(local);
      log("merge completed successfully");
      this.updateState({
        status: "synced",
        lastSynced: new Date(),
        error: null,
      });
      return merged;
    } catch (error) {
      log("merge failed", error);
      this.updateState({
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return null;
    } finally {
      this.isMerging = false;
    }
  }

  /**
   * Flush all pending changes immediately.
   * Used for visibility change / page unload.
   */
  async flush(): Promise<void> {
    log("flush called");

    // Cancel all debounce timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    await this.executeFlush();
  }

  /**
   * Initialize visibility and unload handlers.
   * Returns cleanup function.
   */
  initFlushHandlers(): () => void {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        log("visibility hidden, flushing");
        this.flush();
      }
    };

    const handleUnload = () => {
      log("page unload, flushing");
      // Use fetch with keepalive for reliability on unload
      // (sendBeacon cannot send custom headers like X-CSRF-Token)
      if (this.queue.size > 0) {
        const batch = this.captureQueue();
        const data = JSON.stringify(this.buildUpdatePayload(batch));
        const url = `${API_BASE_URL}${API_V1_PREFIX}/users/me/preferences`;

        // Build headers with auth and CSRF tokens
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        const token = tokenStorage.getToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        }

        // fetch with keepalive survives page unload like sendBeacon,
        // but allows custom headers for proper authentication
        fetch(url, {
          method: "PUT",
          keepalive: true,
          credentials: "include",
          headers,
          body: data,
        }).catch(() => {
          // Silently ignore errors on unload - nothing we can do
        });
        log("keepalive fetch dispatched");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleUnload);
    };
  }

  /**
   * Initialize online/offline handlers.
   * Returns cleanup function.
   */
  initOnlineHandlers(): () => void {
    const handleOnline = () => {
      log("online detected");
      this.isOnline = true;
      if (this.state.status === "offline") {
        this.updateState({ status: "idle" });
        // Flush any pending changes
        if (this.queue.size > 0) {
          this.flush();
        }
      }
    };

    const handleOffline = () => {
      log("offline detected");
      this.isOnline = false;
      this.updateState({ status: "offline" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  /**
   * Reset sync state (called on logout).
   */
  reset(): void {
    log("reset");

    // Clear all timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Clear queue and state
    this.queue.clear();
    this.retryCount = 0;
    this.isMerging = false;
    this.isFlushing = false;

    this.updateState({
      status: "idle",
      lastSynced: null,
      pendingCount: 0,
      error: null,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ══════════════════════════════════════════════════════════════════════════

  private getDebounceForType(type: PreferenceType): number {
    switch (type) {
      case "reading":
        return this.config.debounceMs.reading;
      case "favorites":
        return this.config.debounceMs.favorites;
      case "goals":
        return this.config.debounceMs.goals;
      case "theme":
        return this.config.debounceMs.theme;
      default:
        return this.config.debounceMs.theme; // Default to shortest
    }
  }

  private async executeFlush(): Promise<void> {
    if (this.queue.size === 0) {
      log("flush skipped (no pending changes)");
      return;
    }

    if (this.isFlushing) {
      log("flush skipped (already flushing)");
      return;
    }

    if (!this.isOnline) {
      log("flush skipped (offline)");
      return;
    }

    this.isFlushing = true;
    this.updateState({ status: "syncing", error: null });

    const batch = this.captureQueue();

    try {
      log("flush executing", { types: batch.map((c) => c.type) });
      await this.api.update(this.buildUpdatePayload(batch));
      log("flush completed successfully");

      this.retryCount = 0;
      this.updateState({
        status: "synced",
        lastSynced: new Date(),
        pendingCount: this.queue.size,
        error: null,
      });
    } catch (error) {
      log("flush failed", error);

      // Re-queue failed items
      this.restoreQueue(batch);

      if (this.retryCount < this.config.maxRetries) {
        const backoff = this.config.retryBackoffMs[this.retryCount] ?? 15000;
        this.retryCount++;
        this.scheduleRetry(backoff);
        this.updateState({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
          pendingCount: this.queue.size,
        });
      } else {
        log("max retries exceeded");
        this.updateState({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
          pendingCount: this.queue.size,
        });
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private captureQueue(): PendingChange[] {
    const batch = Array.from(this.queue.values());
    this.queue.clear();
    return batch;
  }

  private restoreQueue(batch: PendingChange[]): void {
    batch.forEach((change) => {
      // Only restore if not already replaced by newer data
      if (!this.queue.has(change.type)) {
        this.queue.set(change.type, change);
      }
    });
    this.updateState({ pendingCount: this.queue.size });
  }

  private buildUpdatePayload(batch: PendingChange[]): PreferencesUpdate {
    const payload: PreferencesUpdate = {};

    batch.forEach((change) => {
      switch (change.type) {
        case "favorites":
          payload.favorites = change.data as PreferencesUpdate["favorites"];
          break;
        case "goals":
          payload.learning_goals = change.data as PreferencesUpdate["learning_goals"];
          break;
        case "reading":
          payload.reading = change.data as PreferencesUpdate["reading"];
          break;
        case "theme":
          payload.theme = change.data as PreferencesUpdate["theme"];
          break;
      }
    });

    return payload;
  }

  private scheduleRetry(delayMs: number): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    log(`scheduling retry in ${delayMs}ms`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.executeFlush();
    }, delayMs);
  }

  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error("[SyncEngine] Listener error:", error);
      }
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const syncEngine = new SyncEngine();

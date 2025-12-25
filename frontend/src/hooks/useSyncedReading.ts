/**
 * Hook for synced reading progress across devices.
 *
 * For anonymous users: Uses localStorage only.
 * For authenticated users: Syncs with server on login and on changes.
 *
 * Features:
 * - Merge on login (most recent timestamp wins)
 * - Debounced sync on changes (30 seconds for background, immediate on tab switch)
 * - Optimistic updates (UI updates immediately, sync in background)
 * - Flush on page unload (prevents data loss)
 * - Graceful error handling (continues working if sync fails)
 *
 * Sync Strategy: See useSyncedFavorites.ts for rationale on 30s debounce.
 * Primary sync is on visibility change (tab switch/close).
 *
 * Note: Section prefs (IAST, Hindi, English toggles) stay local to VerseFocus
 * and are not synced across devices.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { preferencesApi } from "../lib/api";
import { tokenStorage } from "../api/auth";

/**
 * Read CSRF token from cookie (for native fetch calls)
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

// localStorage keys (match ReadingMode.tsx)
const READING_POSITION_KEY = "geetanjali:readingPosition";
const READING_SETTINGS_KEY = "geetanjali:readingSettings";

// Debounce delay for syncing changes to server (long - primary sync is on visibility change)
const SYNC_DEBOUNCE_MS = 30000;
// Throttle delay for merge calls (prevents 429 on rapid remounts)
const MERGE_THROTTLE_MS = 10000;
// Minimum interval between any sync calls (module-level throttle)
const SYNC_THROTTLE_MS = 5000;

/**
 * Module-level timestamps for rate limiting.
 * See useSyncedFavorites.ts for rationale (cross-remount throttling).
 */
let lastMergeTimestamp = 0;
let lastSyncTimestamp = 0;

/** Font size options */
type FontSize = "small" | "medium" | "large";

interface ReadingPosition {
  chapter: number;
  verse: number;
  timestamp: number;
}

interface ReadingSettings {
  fontSize: FontSize;
}

const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: "medium",
};

interface UseSyncedReadingReturn {
  // Current reading state
  position: ReadingPosition | null;
  settings: ReadingSettings;

  // Actions
  savePosition: (chapter: number, verse: number) => void;
  setFontSize: (size: FontSize) => void;
  resetProgress: () => void;

  // Sync status
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  resync: () => Promise<void>;
}

/**
 * Load reading position from localStorage
 */
function loadPosition(): ReadingPosition | null {
  try {
    const saved = localStorage.getItem(READING_POSITION_KEY);
    if (saved) {
      return JSON.parse(saved) as ReadingPosition;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

/**
 * Load reading settings from localStorage
 */
function loadSettings(): ReadingSettings {
  try {
    const saved = localStorage.getItem(READING_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_SETTINGS;
}

/**
 * Hook for managing reading progress with cross-device sync.
 */
export function useSyncedReading(): UseSyncedReadingReturn {
  const { isAuthenticated, user } = useAuth();

  const [position, setPosition] = useState<ReadingPosition | null>(loadPosition);
  const [settings, setSettings] = useState<ReadingSettings>(loadSettings);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Track user ID to detect login/logout
  const previousUserIdRef = useRef<string | null>(null);
  // Debounce timer ref
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we're currently syncing
  const isSyncingRef = useRef(false);
  // Track pending data to sync
  const pendingDataRef = useRef<{
    chapter?: number;
    verse?: number;
    font_size?: string;
  } | null>(null);

  /**
   * Get current reading data for sync
   */
  const getCurrentData = useCallback(() => {
    const pos = loadPosition();
    const set = loadSettings();

    return {
      chapter: pos?.chapter,
      verse: pos?.verse,
      font_size: set.fontSize,
      updated_at: pos?.timestamp ? new Date(pos.timestamp).toISOString() : undefined,
    };
  }, []);

  /**
   * Merge local reading progress with server (used on login)
   */
  const mergeWithServer = useCallback(async () => {
    // Throttle to prevent 429 on rapid remounts (e.g., React StrictMode)
    const now = Date.now();
    if (now - lastMergeTimestamp < MERGE_THROTTLE_MS) {
      console.debug("[SyncedReading] Merge throttled");
      return;
    }
    if (isSyncingRef.current) return;
    lastMergeTimestamp = now;
    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const localData = getCurrentData();

      // Merge with server
      const merged = await preferencesApi.merge({
        reading: localData,
      });

      // Update local storage with merged result
      if (merged.reading.chapter !== null && merged.reading.verse !== null) {
        const pos: ReadingPosition = {
          chapter: merged.reading.chapter,
          verse: merged.reading.verse,
          timestamp: merged.reading.updated_at
            ? new Date(merged.reading.updated_at).getTime()
            : Date.now(),
        };
        localStorage.setItem(READING_POSITION_KEY, JSON.stringify(pos));
        setPosition(pos);
      }

      if (merged.reading.font_size) {
        const set: ReadingSettings = { fontSize: merged.reading.font_size as FontSize };
        localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify(set));
        setSettings(set);
      }

      setSyncStatus("synced");
      setLastSynced(new Date());

      console.debug("[SyncedReading] Merged with server");
    } catch (error) {
      console.error("[SyncedReading] Merge failed:", error);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, [getCurrentData]);

  /**
   * Sync current reading data to server (debounced)
   *
   * Uses pendingDataRef exclusively to avoid race conditions with localStorage.
   * Each call to savePosition/setFontSize updates pendingDataRef before calling this.
   */
  const syncToServer = useCallback(() => {
    if (!isAuthenticated) return;

    // Clear existing timeout (debounce)
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce the sync
    syncTimeoutRef.current = setTimeout(async () => {
      // Skip if no pending data or already syncing
      const data = pendingDataRef.current;
      if (!data || isSyncingRef.current) return;

      // Throttle check (module-level, prevents rapid syncs)
      const now = Date.now();
      if (now - lastSyncTimestamp < SYNC_THROTTLE_MS) {
        console.debug("[SyncedReading] Sync throttled");
        return;
      }
      lastSyncTimestamp = now;

      isSyncingRef.current = true;
      pendingDataRef.current = null;
      setSyncStatus("syncing");

      try {
        await preferencesApi.update({
          reading: {
            chapter: data.chapter,
            verse: data.verse,
            font_size: data.font_size,
          },
        });
        setSyncStatus("synced");
        setLastSynced(new Date());
      } catch (error) {
        console.error("[SyncedReading] Sync failed:", error);
        setSyncStatus("error");
      } finally {
        isSyncingRef.current = false;
      }
    }, SYNC_DEBOUNCE_MS);
  }, [isAuthenticated]);

  /**
   * Flush pending sync immediately (for page unload)
   *
   * Note: Uses fetch with keepalive instead of sendBeacon because
   * sendBeacon doesn't support custom headers (needed for auth cookies).
   * The keepalive flag allows the request to outlive the page.
   */
  const flushSync = useCallback(() => {
    if (!isAuthenticated || isSyncingRef.current) return;

    // Clear pending timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    // Only sync pending data - don't read from localStorage
    const data = pendingDataRef.current;
    if (!data || (!data.chapter && !data.verse && !data.font_size)) return;

    // Use fetch with keepalive (supports cookies/auth, outlives page)
    // Must manually add headers since axios interceptors don't apply to native fetch
    try {
      const payload = JSON.stringify({ reading: data });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add Authorization header if token available
      const token = tokenStorage.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Add CSRF token for the state-changing request
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }

      fetch("/api/v1/users/me/preferences", {
        method: "PUT",
        headers,
        body: payload,
        credentials: "include", // Include cookies as fallback
        keepalive: true, // Allow request to outlive page
      });
      console.debug("[SyncedReading] Flushed via keepalive fetch");
    } catch (error) {
      console.error("[SyncedReading] Flush failed:", error);
    }
  }, [isAuthenticated]);

  /**
   * Handle login: merge local progress with server
   *
   * Triggers merge when user logs in (or is already logged in on mount).
   * This ensures reading progress is synced immediately.
   */
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const wasLoggedOut = previousUserIdRef.current === null;
    const isNowLoggedIn = currentUserId !== null;

    // Detect login (includes mount when already logged in)
    if (wasLoggedOut && isNowLoggedIn) {
      console.debug("[SyncedReading] Login detected, merging with server");
      mergeWithServer();
    }

    // Detect logout
    if (previousUserIdRef.current !== null && currentUserId === null) {
      console.debug("[SyncedReading] Logout detected, resetting sync status");
      setSyncStatus("idle");
      setLastSynced(null);
      isSyncingRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id, mergeWithServer]);

  /**
   * Flush on page unload or tab switch
   *
   * Handles three scenarios:
   * 1. beforeunload - User closes tab/window
   * 2. pagehide - User navigates away (mobile Safari)
   * 3. visibilitychange - User switches tabs (prevents stale sync race)
   */
  useEffect(() => {
    const handleUnload = () => {
      flushSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushSync();
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushSync]);

  /**
   * Save reading position
   */
  const savePosition = useCallback(
    (chapter: number, verse: number) => {
      const pos: ReadingPosition = {
        chapter,
        verse,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(READING_POSITION_KEY, JSON.stringify(pos));
      } catch {
        // Ignore localStorage errors
      }
      setPosition(pos);

      // Queue for sync
      pendingDataRef.current = {
        ...pendingDataRef.current,
        chapter,
        verse,
      };

      if (isAuthenticated) {
        syncToServer();
      }
    },
    [isAuthenticated, syncToServer],
  );

  /**
   * Set font size
   */
  const setFontSize = useCallback(
    (size: FontSize) => {
      const newSettings = { ...settings, fontSize: size };
      try {
        localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify(newSettings));
      } catch {
        // Ignore localStorage errors
      }
      setSettings(newSettings);

      // Queue for sync
      pendingDataRef.current = {
        ...pendingDataRef.current,
        font_size: size,
      };

      if (isAuthenticated) {
        syncToServer();
      }
    },
    [settings, isAuthenticated, syncToServer],
  );

  /**
   * Reset all reading progress
   */
  const resetProgress = useCallback(() => {
    try {
      localStorage.removeItem(READING_POSITION_KEY);
      localStorage.removeItem(READING_SETTINGS_KEY);
    } catch {
      // Ignore
    }
    setPosition(null);
    setSettings(DEFAULT_SETTINGS);

    // Sync reset to server
    if (isAuthenticated) {
      preferencesApi.update({
        reading: {
          chapter: undefined,
          verse: undefined,
          font_size: "medium",
        },
      }).catch(console.error);
    }
  }, [isAuthenticated]);

  /**
   * Manual resync
   */
  const resync = useCallback(async () => {
    if (isAuthenticated) {
      await mergeWithServer();
    }
  }, [isAuthenticated, mergeWithServer]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return useMemo(
    () => ({
      position,
      settings,
      savePosition,
      setFontSize,
      resetProgress,
      syncStatus,
      lastSynced,
      resync,
    }),
    [
      position,
      settings,
      savePosition,
      setFontSize,
      resetProgress,
      syncStatus,
      lastSynced,
      resync,
    ],
  );
}

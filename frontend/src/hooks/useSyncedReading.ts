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
import { requestMerge, requestUpdate } from "../lib/preferenceSyncCoordinator";
import { setStorageItem, STORAGE_KEYS } from "../lib/storage";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

// Note: All timing/throttling is now handled by preferenceSyncCoordinator
// to consolidate API calls across all preference types.

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
    const saved = localStorage.getItem(STORAGE_KEYS.readingPosition);
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
    const saved = localStorage.getItem(STORAGE_KEYS.readingSettings);
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

  const [position, setPosition] = useState<ReadingPosition | null>(
    loadPosition,
  );
  const [settings, setSettings] = useState<ReadingSettings>(loadSettings);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Track user ID to detect login/logout
  const previousUserIdRef = useRef<string | null>(null);
  // Track if we're currently syncing
  const isSyncingRef = useRef(false);

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
      updated_at: pos?.timestamp
        ? new Date(pos.timestamp).toISOString()
        : undefined,
    };
  }, []);

  /**
   * Merge local reading progress with server (used on login)
   *
   * Uses preferenceSyncCoordinator to batch with other preference types,
   * reducing multiple API calls to a single consolidated merge request.
   */
  const mergeWithServer = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const localData = getCurrentData();

      // Request coordinated merge (batched with other preference types)
      const merged = await requestMerge({ reading: localData }, (result) => {
        // Callback receives merged result from coordinator
        if (result.reading) {
          if (
            result.reading.chapter !== null &&
            result.reading.verse !== null
          ) {
            const pos: ReadingPosition = {
              chapter: result.reading.chapter,
              verse: result.reading.verse,
              timestamp: result.reading.updated_at
                ? new Date(result.reading.updated_at).getTime()
                : Date.now(),
            };
            setStorageItem(STORAGE_KEYS.readingPosition, pos);
            setPosition(pos);
          }

          if (result.reading.font_size) {
            const set: ReadingSettings = {
              fontSize: result.reading.font_size as FontSize,
            };
            setStorageItem(STORAGE_KEYS.readingSettings, set);
            setSettings(set);
          }
        }
      });

      // If coordinator throttled/skipped, merged is null
      if (merged) {
        setSyncStatus("synced");
        setLastSynced(new Date());
      } else {
        setSyncStatus("idle");
      }
    } catch (error) {
      console.error("[SyncedReading] Merge failed:", error);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, [getCurrentData]);

  /**
   * Sync current reading data to server (via coordinator)
   *
   * Uses preferenceSyncCoordinator for debouncing and batching
   * with other preference types.
   */
  const syncToServer = useCallback(
    (data: { chapter?: number; verse?: number; font_size?: string }) => {
      if (!isAuthenticated) return;

      // Send to coordinator for batching
      requestUpdate({
        reading: {
          chapter: data.chapter,
          verse: data.verse,
          font_size: data.font_size,
        },
      });
    },
    [isAuthenticated],
  );

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
      mergeWithServer();
    }

    // Detect logout
    if (previousUserIdRef.current !== null && currentUserId === null) {
      setSyncStatus("idle");
      setLastSynced(null);
      isSyncingRef.current = false;
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id, mergeWithServer]);

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
      setStorageItem(STORAGE_KEYS.readingPosition, pos);
      setPosition(pos);

      // Sync to coordinator
      syncToServer({ chapter, verse });
    },
    [syncToServer],
  );

  /**
   * Set font size
   */
  const setFontSize = useCallback(
    (size: FontSize) => {
      const newSettings = { ...settings, fontSize: size };
      setStorageItem(STORAGE_KEYS.readingSettings, newSettings);
      setSettings(newSettings);

      // Sync to coordinator
      syncToServer({ font_size: size });
    },
    [settings, syncToServer],
  );

  /**
   * Reset all reading progress
   */
  const resetProgress = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.readingPosition);
      localStorage.removeItem(STORAGE_KEYS.readingSettings);
    } catch {
      // Ignore
    }
    setPosition(null);
    setSettings(DEFAULT_SETTINGS);

    // Sync reset via coordinator
    if (isAuthenticated) {
      requestUpdate({
        reading: {
          chapter: undefined,
          verse: undefined,
          font_size: "medium",
        },
      });
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

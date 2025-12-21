/**
 * Hook for synced favorites across devices.
 *
 * For anonymous users: Uses localStorage only (via useFavorites).
 * For authenticated users: Syncs with server on login and on changes.
 *
 * Features:
 * - Merge on login (union of local + server favorites)
 * - Debounced sync on add/remove (1 second)
 * - Optimistic updates (UI updates immediately, sync in background)
 * - Graceful error handling (continues working if sync fails)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useFavorites } from "./useFavorites";
import { useAuth } from "../contexts/AuthContext";
import { preferencesApi } from "../lib/api";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface UseSyncedFavoritesReturn {
  /** Set of favorited verse IDs */
  favorites: Set<string>;
  /** Check if a verse is favorited */
  isFavorite: (verseId: string) => boolean;
  /** Toggle favorite status */
  toggleFavorite: (verseId: string) => boolean;
  /** Add a favorite */
  addFavorite: (verseId: string) => boolean;
  /** Remove a favorite */
  removeFavorite: (verseId: string) => void;
  /** Number of favorites */
  favoritesCount: number;
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Last sync timestamp */
  lastSynced: Date | null;
  /** Manually trigger sync (for debugging) */
  resync: () => Promise<void>;
  /** Whether first sync after login completed (for toast) */
  didInitialSync: boolean;
}

// Debounce delay for syncing changes to server (long - primary sync is on visibility change)
const SYNC_DEBOUNCE_MS = 30000;
// Throttle delay for merge calls (prevents 429 on rapid remounts)
const MERGE_THROTTLE_MS = 10000;
// Minimum interval between any sync calls (module-level throttle)
const SYNC_THROTTLE_MS = 5000;

/**
 * Module-level timestamps for rate limiting.
 *
 * INTENTIONALLY module-level (not refs) because:
 * 1. Throttling must persist across component unmount/remount cycles
 * 2. Prevents 429 errors when React Strict Mode double-mounts or user navigates rapidly
 * 3. Client-side only app, so no SSR state sharing concerns
 *
 * Trade-off: Makes unit testing harder (requires manual reset between tests).
 */
let lastMergeTimestamp = 0;
let lastSyncTimestamp = 0;

/**
 * Hook for managing favorites with cross-device sync.
 *
 * @example
 * ```tsx
 * const { favorites, isFavorite, toggleFavorite, syncStatus } = useSyncedFavorites();
 *
 * // Check if verse is favorited
 * const isLiked = isFavorite('BG_2_47');
 *
 * // Toggle favorite (syncs automatically if authenticated)
 * const handleClick = () => toggleFavorite('BG_2_47');
 * ```
 */
export function useSyncedFavorites(): UseSyncedFavoritesReturn {
  const { isAuthenticated, user } = useAuth();
  const localFavorites = useFavorites();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [didInitialSync, setDidInitialSync] = useState(false);

  // Track user ID to detect login/logout
  const previousUserIdRef = useRef<string | null>(null);
  // Debounce timer ref
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we're currently syncing to prevent duplicate calls
  const isSyncingRef = useRef(false);

  /**
   * Merge local favorites with server (used on login)
   */
  const mergeWithServer = useCallback(async () => {
    // Throttle to prevent 429 on rapid remounts (e.g., React StrictMode)
    const now = Date.now();
    if (now - lastMergeTimestamp < MERGE_THROTTLE_MS) {
      console.debug("[SyncedFavorites] Merge throttled");
      return;
    }
    if (isSyncingRef.current) return;
    lastMergeTimestamp = now;
    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      // Get current local favorites
      const localItems = Array.from(localFavorites.favorites);

      // Merge with server
      const merged = await preferencesApi.merge({
        favorites: { items: localItems },
      });

      // Update local storage with merged result (atomic update to avoid race conditions)
      localFavorites.setAllFavorites(merged.favorites.items);

      setSyncStatus("synced");
      setLastSynced(new Date());
      setDidInitialSync(true);

      console.debug(
        `[SyncedFavorites] Merged: ${localItems.length} local + server = ${merged.favorites.items.length} total`,
      );
    } catch (error) {
      console.error("[SyncedFavorites] Merge failed:", error);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, [localFavorites]);

  /**
   * Sync current favorites to server (debounced)
   *
   * Reads latest favorites from localStorage when sync fires to avoid
   * race conditions with rapid add/remove operations.
   */
  const syncToServer = useCallback(() => {
    if (!isAuthenticated) return;

    // Clear existing timeout (debounce)
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce the sync - read latest favorites when timeout fires
    syncTimeoutRef.current = setTimeout(async () => {
      if (isSyncingRef.current) return;

      // Throttle check (module-level, prevents rapid syncs)
      const now = Date.now();
      if (now - lastSyncTimestamp < SYNC_THROTTLE_MS) {
        console.debug("[SyncedFavorites] Sync throttled");
        return;
      }
      lastSyncTimestamp = now;

      isSyncingRef.current = true;
      setSyncStatus("syncing");

      try {
        // Read current favorites from localStorage at sync time (not call time)
        const currentItems = Array.from(localFavorites.favorites);
        await preferencesApi.update({
          favorites: { items: currentItems },
        });
        setSyncStatus("synced");
        setLastSynced(new Date());
      } catch (error) {
        console.error("[SyncedFavorites] Sync failed:", error);
        setSyncStatus("error");
      } finally {
        isSyncingRef.current = false;
      }
    }, SYNC_DEBOUNCE_MS);
  }, [isAuthenticated, localFavorites.favorites]);

  /**
   * Handle login: merge local favorites with server
   */
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const wasLoggedOut = previousUserIdRef.current === null;
    const isNowLoggedIn = currentUserId !== null;

    // Detect login (was null, now has user ID)
    if (wasLoggedOut && isNowLoggedIn) {
      console.debug("[SyncedFavorites] Login detected, merging with server");
      mergeWithServer();
    }

    // Detect logout (had user ID, now null)
    if (previousUserIdRef.current !== null && currentUserId === null) {
      console.debug("[SyncedFavorites] Logout detected, resetting sync status");
      setSyncStatus("idle");
      setLastSynced(null);
      setDidInitialSync(false);
      // Reset syncing ref to prevent stuck state if logout during sync
      isSyncingRef.current = false;
      // Clear any pending sync timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id, mergeWithServer]);

  /**
   * Add a favorite (syncs to server if authenticated)
   */
  const addFavorite = useCallback(
    (verseId: string): boolean => {
      const success = localFavorites.addFavorite(verseId);

      if (success && isAuthenticated) {
        // Trigger debounced sync (reads latest from localStorage)
        syncToServer();
      }

      return success;
    },
    [localFavorites, isAuthenticated, syncToServer],
  );

  /**
   * Remove a favorite (syncs to server if authenticated)
   */
  const removeFavorite = useCallback(
    (verseId: string): void => {
      localFavorites.removeFavorite(verseId);

      if (isAuthenticated) {
        // Trigger debounced sync (reads latest from localStorage)
        syncToServer();
      }
    },
    [localFavorites, isAuthenticated, syncToServer],
  );

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(
    (verseId: string): boolean => {
      if (localFavorites.isFavorite(verseId)) {
        removeFavorite(verseId);
        return false;
      } else {
        return addFavorite(verseId);
      }
    },
    [localFavorites, addFavorite, removeFavorite],
  );

  /**
   * Manual resync (for debugging or retry)
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

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      favorites: localFavorites.favorites,
      isFavorite: localFavorites.isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      favoritesCount: localFavorites.favoritesCount,
      syncStatus,
      lastSynced,
      resync,
      didInitialSync,
    }),
    [
      localFavorites.favorites,
      localFavorites.isFavorite,
      localFavorites.favoritesCount,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      syncStatus,
      lastSynced,
      resync,
      didInitialSync,
    ],
  );
}

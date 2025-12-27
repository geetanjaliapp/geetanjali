/**
 * Hook for synced favorites across devices.
 *
 * For anonymous users: Uses localStorage only (via useFavorites).
 * For authenticated users: Syncs with server on login and on changes.
 *
 * Features:
 * - Merge on login (union of local + server favorites)
 * - Debounced sync on changes (30 seconds for background, immediate on tab switch)
 * - Optimistic updates (UI updates immediately, sync in background)
 * - Graceful error handling (continues working if sync fails)
 *
 * Sync Strategy:
 * We use a long debounce (30s) because the primary sync trigger is visibility change
 * (user switching tabs or closing page). This reduces API calls while ensuring data
 * is always saved before the user leaves. The debounced sync acts as a fallback for
 * users who stay on the same tab for extended periods.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useFavorites } from "./useFavorites";
import { useAuth } from "../contexts/AuthContext";
import { requestMerge, requestUpdate } from "../lib/preferenceSyncCoordinator";

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

// Note: All timing/throttling is now handled by preferenceSyncCoordinator
// to consolidate API calls across all preference types.

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

  // Destructure to get stable callback references
  // favorites Set changes, but callbacks are now stable (use ref pattern in useFavorites)
  const {
    favorites,
    isFavorite: localIsFavorite,
    addFavorite: localAddFavorite,
    removeFavorite: localRemoveFavorite,
    setAllFavorites,
    favoritesCount,
  } = useFavorites();

  // Ref to access current favorites without causing callback recreation
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites; // Safe: writing (not reading) during render

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [didInitialSync, setDidInitialSync] = useState(false);

  // Track user ID to detect login/logout
  const previousUserIdRef = useRef<string | null>(null);
  // Track if we're currently syncing to prevent duplicate calls
  const isSyncingRef = useRef(false);

  /**
   * Merge local favorites with server (used on login)
   *
   * Uses preferenceSyncCoordinator to batch with other preference types,
   * reducing multiple API calls to a single consolidated merge request.
   */
  const mergeWithServer = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      // Get current local favorites from ref
      const localItems = Array.from(favoritesRef.current);

      // Request coordinated merge (batched with other preference types)
      const merged = await requestMerge(
        { favorites: { items: localItems } },
        (result) => {
          // Callback receives merged result from coordinator
          if (result.favorites?.items) {
            setAllFavorites(result.favorites.items);
            setDidInitialSync(true);
          }
        },
      );

      // If coordinator throttled/skipped, merged is null
      if (merged) {
        setSyncStatus("synced");
        setLastSynced(new Date());
      } else {
        setSyncStatus("idle");
      }
    } catch (error) {
      console.error("[SyncedFavorites] Merge failed:", error);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, [setAllFavorites]);

  /**
   * Sync current favorites to server (via coordinator)
   *
   * Uses preferenceSyncCoordinator for debouncing and batching
   * with other preference types.
   */
  const syncToServer = useCallback(() => {
    if (!isAuthenticated) return;

    // Read current favorites and send to coordinator
    const currentItems = Array.from(favoritesRef.current);
    requestUpdate({ favorites: { items: currentItems } });
  }, [isAuthenticated]);

  /**
   * Handle login: merge local favorites with server
   */
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const wasLoggedOut = previousUserIdRef.current === null;
    const isNowLoggedIn = currentUserId !== null;

    // Detect login (was null, now has user ID)
    if (wasLoggedOut && isNowLoggedIn) {
      mergeWithServer();
    }

    // Detect logout (had user ID, now null)
    if (previousUserIdRef.current !== null && currentUserId === null) {
      setSyncStatus("idle");
      setLastSynced(null);
      setDidInitialSync(false);
      // Reset syncing ref to prevent stuck state if logout during sync
      isSyncingRef.current = false;
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id, mergeWithServer]);

  /**
   * Add a favorite (syncs to server if authenticated)
   * Stable reference - uses stable callbacks from useFavorites
   */
  const addFavorite = useCallback(
    (verseId: string): boolean => {
      const success = localAddFavorite(verseId);

      if (success && isAuthenticated) {
        // Trigger debounced sync (reads latest from ref)
        syncToServer();
      }

      return success;
    },
    [localAddFavorite, isAuthenticated, syncToServer],
  );

  /**
   * Remove a favorite (syncs to server if authenticated)
   * Stable reference - uses stable callbacks from useFavorites
   */
  const removeFavorite = useCallback(
    (verseId: string): void => {
      localRemoveFavorite(verseId);

      if (isAuthenticated) {
        // Trigger debounced sync (reads latest from ref)
        syncToServer();
      }
    },
    [localRemoveFavorite, isAuthenticated, syncToServer],
  );

  /**
   * Toggle favorite status
   * Stable reference - uses stable callbacks from useFavorites
   */
  const toggleFavorite = useCallback(
    (verseId: string): boolean => {
      if (localIsFavorite(verseId)) {
        removeFavorite(verseId);
        return false;
      } else {
        return addFavorite(verseId);
      }
    },
    [localIsFavorite, addFavorite, removeFavorite],
  );

  /**
   * Manual resync (for debugging or retry)
   */
  const resync = useCallback(async () => {
    if (isAuthenticated) {
      await mergeWithServer();
    }
  }, [isAuthenticated, mergeWithServer]);

  // Memoize return value to prevent unnecessary re-renders
  // Note: favorites Set still changes, but all callbacks are now stable
  return useMemo(
    () => ({
      favorites,
      isFavorite: localIsFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      favoritesCount,
      syncStatus,
      lastSynced,
      resync,
      didInitialSync,
    }),
    [
      favorites,
      localIsFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      favoritesCount,
      syncStatus,
      lastSynced,
      resync,
      didInitialSync,
    ],
  );
}

/**
 * Hook for synced learning goals across devices.
 *
 * For anonymous users: Uses localStorage only (via useLearningGoal).
 * For authenticated users: Syncs with server on login and on changes.
 *
 * Features:
 * - Merge on login (most recent timestamp wins)
 * - Debounced sync on changes (30 seconds for background, immediate on tab switch)
 * - Optimistic updates (UI updates immediately, sync in background)
 * - Supports multi-goal selection
 * - Graceful error handling (continues working if sync fails)
 *
 * Sync Strategy: See useSyncedFavorites.ts for rationale on 30s debounce.
 * Primary sync is on visibility change (tab switch/close).
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useLearningGoalContext } from "../contexts/LearningGoalContext";
import { useAuth } from "../contexts/AuthContext";
import { setStorageItem, STORAGE_KEYS } from "../lib/storage";
import { preferencesApi } from "../lib/api";
import type { Goal, Principle } from "../lib/api";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

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

interface StoredGoals {
  goalIds: string[];
  selectedAt: string; // ISO timestamp
}

interface UseSyncedGoalReturn {
  // Current selection
  selectedGoalIds: string[];
  selectedGoals: Goal[];
  goalPrinciples: Principle[];

  // Available goals from taxonomy
  goals: Goal[];

  // Actions
  toggleGoal: (goalId: string) => void;
  setGoals: (goalIds: string[]) => void;
  clearGoals: () => void;
  isSelected: (goalId: string) => boolean;

  // Loading state
  initialized: boolean;

  // Sync status
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  resync: () => Promise<void>;
}

/**
 * Load stored goals from localStorage
 */
function loadStoredGoals(): StoredGoals | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.learningGoals);
    if (stored) {
      return JSON.parse(stored) as StoredGoals;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

/**
 * Hook for managing learning goals with cross-device sync.
 */
export function useSyncedGoal(): UseSyncedGoalReturn {
  const { isAuthenticated, user } = useAuth();
  const goalContext = useLearningGoalContext();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Track user ID to detect login/logout
  const previousUserIdRef = useRef<string | null>(null);
  // Debounce timer ref
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we're currently syncing
  const isSyncingRef = useRef(false);

  /**
   * Merge local goals with server (used on login)
   */
  const mergeWithServer = useCallback(async () => {
    // Throttle to prevent 429 on rapid remounts (e.g., React StrictMode)
    const now = Date.now();
    if (now - lastMergeTimestamp < MERGE_THROTTLE_MS) {
      return;
    }
    if (isSyncingRef.current) return;
    lastMergeTimestamp = now;
    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const stored = loadStoredGoals();
      const localGoalIds = stored?.goalIds ?? [];
      const localUpdatedAt = stored?.selectedAt;

      // Merge with server
      const merged = await preferencesApi.merge({
        learning_goals: {
          goal_ids: localGoalIds,
          updated_at: localUpdatedAt,
        },
      });

      // Update local storage with merged result
      const newGoals: StoredGoals = {
        goalIds: merged.learning_goals.goal_ids,
        selectedAt: merged.learning_goals.updated_at || new Date().toISOString(),
      };
      setStorageItem(STORAGE_KEYS.learningGoals, newGoals);

      // Sync with the context state
      goalContext.setGoals(newGoals.goalIds);

      setSyncStatus("synced");
      setLastSynced(new Date());
    } catch (error) {
      console.error("[SyncedGoal] Merge failed:", error);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, [goalContext]);

  /**
   * Sync current goals to server (debounced)
   */
  const syncToServer = useCallback(() => {
    if (!isAuthenticated) return;

    // Clear existing timeout (debounce)
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce the sync
    syncTimeoutRef.current = setTimeout(async () => {
      if (isSyncingRef.current) return;

      // Throttle check (module-level, prevents rapid syncs)
      const now = Date.now();
      if (now - lastSyncTimestamp < SYNC_THROTTLE_MS) {
        return;
      }
      lastSyncTimestamp = now;

      isSyncingRef.current = true;
      setSyncStatus("syncing");

      try {
        const stored = loadStoredGoals();
        const goalIds = stored?.goalIds ?? [];

        await preferencesApi.update({
          learning_goals: { goal_ids: goalIds },
        });
        setSyncStatus("synced");
        setLastSynced(new Date());
      } catch (error) {
        console.error("[SyncedGoal] Sync failed:", error);
        setSyncStatus("error");
      } finally {
        isSyncingRef.current = false;
      }
    }, SYNC_DEBOUNCE_MS);
  }, [isAuthenticated]);

  /**
   * Handle login: merge local goals with server
   */
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const wasLoggedOut = previousUserIdRef.current === null;
    const isNowLoggedIn = currentUserId !== null;

    // Detect login
    if (wasLoggedOut && isNowLoggedIn) {
      mergeWithServer();
    }

    // Detect logout
    if (previousUserIdRef.current !== null && currentUserId === null) {
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
   * Toggle goal with sync
   */
  const toggleGoal = useCallback(
    (goalId: string) => {
      goalContext.toggleGoal(goalId);

      if (isAuthenticated) {
        syncToServer();
      }
    },
    [goalContext, isAuthenticated, syncToServer],
  );

  /**
   * Set goals with sync
   */
  const setGoals = useCallback(
    (goalIds: string[]) => {
      goalContext.setGoals(goalIds);

      if (isAuthenticated) {
        syncToServer();
      }
    },
    [goalContext, isAuthenticated, syncToServer],
  );

  /**
   * Clear goals with sync
   */
  const clearGoals = useCallback(() => {
    goalContext.clearGoals();

    if (isAuthenticated) {
      // Sync empty goals to server
      preferencesApi
        .update({
          learning_goals: { goal_ids: [] },
        })
        .then(() => {
          setSyncStatus("synced");
          setLastSynced(new Date());
        })
        .catch((error) => {
          console.error("[SyncedGoal] Clear sync failed:", error);
          setSyncStatus("error");
        });
    }
  }, [goalContext, isAuthenticated]);

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
      // Pass through from context
      selectedGoalIds: goalContext.selectedGoalIds,
      selectedGoals: goalContext.selectedGoals,
      goalPrinciples: goalContext.goalPrinciples,
      goals: goalContext.goals,
      isSelected: goalContext.isSelected,
      initialized: goalContext.initialized,

      // Synced actions
      toggleGoal,
      setGoals,
      clearGoals,

      // Sync status
      syncStatus,
      lastSynced,
      resync,
    }),
    [
      goalContext.selectedGoalIds,
      goalContext.selectedGoals,
      goalContext.goalPrinciples,
      goalContext.goals,
      goalContext.isSelected,
      goalContext.initialized,
      toggleGoal,
      setGoals,
      clearGoals,
      syncStatus,
      lastSynced,
      resync,
    ],
  );
}

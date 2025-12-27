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
import { requestMerge, requestUpdate } from "../lib/preferenceSyncCoordinator";
import type { Goal, Principle } from "../lib/api";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

// Note: All timing/throttling is now handled by preferenceSyncCoordinator
// to consolidate API calls across all preference types.

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

  // Destructure setGoals for stable callback dependency
  const { setGoals: contextSetGoals } = goalContext;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Track user ID to detect login/logout
  const previousUserIdRef = useRef<string | null>(null);
  // Track if we're currently syncing
  const isSyncingRef = useRef(false);

  /**
   * Merge local goals with server (used on login)
   *
   * Uses preferenceSyncCoordinator to batch with other preference types,
   * reducing multiple API calls to a single consolidated merge request.
   */
  const mergeWithServer = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const stored = loadStoredGoals();
      const localGoalIds = stored?.goalIds ?? [];
      const localUpdatedAt = stored?.selectedAt;

      // Request coordinated merge (batched with other preference types)
      const merged = await requestMerge(
        {
          learning_goals: {
            goal_ids: localGoalIds,
            updated_at: localUpdatedAt,
          },
        },
        (result) => {
          // Callback receives merged result from coordinator
          if (result.learning_goals) {
            const newGoals: StoredGoals = {
              goalIds: result.learning_goals.goal_ids,
              selectedAt:
                result.learning_goals.updated_at || new Date().toISOString(),
            };
            setStorageItem(STORAGE_KEYS.learningGoals, newGoals);
            contextSetGoals(newGoals.goalIds);
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
      console.error("[SyncedGoal] Merge failed:", error);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, [contextSetGoals]);

  /**
   * Sync current goals to server (via coordinator)
   *
   * Uses preferenceSyncCoordinator for debouncing and batching
   * with other preference types.
   */
  const syncToServer = useCallback(() => {
    if (!isAuthenticated) return;

    // Read current goals and send to coordinator
    const stored = loadStoredGoals();
    const goalIds = stored?.goalIds ?? [];
    requestUpdate({ learning_goals: { goal_ids: goalIds } });
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
      // Sync empty goals via coordinator
      requestUpdate({ learning_goals: { goal_ids: [] } });
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

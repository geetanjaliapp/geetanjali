/**
 * usePreferences - Main hook for accessing user preferences
 *
 * Provides access to the unified PreferencesContext with convenience
 * slice hooks for specific use cases.
 *
 * Slice hooks (useFavoritesPrefs, useGoalsPrefs, useReadingPrefs, useSyncStatus)
 * are optimized to only re-render when their specific slice changes.
 *
 * Part of v1.17.3 preference sync improvements.
 */

import {
  usePreferencesContext,
  useFavoritesSlice,
  useGoalsSlice,
  useReadingSlice,
  useSyncSlice,
} from "../contexts/PreferencesContext";

/**
 * Main hook for accessing all user preferences.
 * Note: This hook re-renders on any preference change.
 * For optimized re-renders, use the slice hooks instead.
 *
 * @example
 * ```tsx
 * const { favorites, toggleFavorite, sync } = usePreferences();
 * ```
 */
export function usePreferences() {
  return usePreferencesContext();
}

/**
 * Optimized hook for favorites functionality.
 * Only re-renders when favorites change, not when goals or reading changes.
 *
 * @example
 * ```tsx
 * const { favorites, isFavorite, toggleFavorite } = useFavoritesPrefs();
 * ```
 */
export function useFavoritesPrefs() {
  return useFavoritesSlice();
}

/**
 * Optimized hook for goals functionality.
 * Only re-renders when goals change, not when favorites or reading changes.
 *
 * @example
 * ```tsx
 * const { selectedGoals, toggleGoal, isGoalSelected } = useGoalsPrefs();
 * ```
 */
export function useGoalsPrefs() {
  const slice = useGoalsSlice();

  return {
    selectedIds: slice.goals.selectedIds,
    selectedGoals: slice.goals.selectedGoals,
    goalPrinciples: slice.goals.goalPrinciples,
    goals: slice.availableGoals,
    toggleGoal: slice.toggleGoal,
    setGoals: slice.setGoals,
    clearGoals: slice.clearGoals,
    isGoalSelected: slice.isGoalSelected,
  };
}

/**
 * Optimized hook for reading preferences.
 * Only re-renders when reading state changes, not when favorites or goals changes.
 *
 * @example
 * ```tsx
 * const { position, settings, saveReadingPosition, setFontSize } = useReadingPrefs();
 * ```
 */
export function useReadingPrefs() {
  const slice = useReadingSlice();

  return {
    position: slice.reading.position,
    settings: slice.reading.settings,
    saveReadingPosition: slice.saveReadingPosition,
    setFontSize: slice.setFontSize,
    resetReadingProgress: slice.resetReadingProgress,
  };
}

/**
 * Optimized hook for sync status.
 * Only re-renders when sync state changes.
 *
 * @example
 * ```tsx
 * const { status, lastSynced, error, resync } = useSyncStatus();
 * ```
 */
export function useSyncStatus() {
  const slice = useSyncSlice();

  return {
    status: slice.sync.status,
    lastSynced: slice.sync.lastSynced,
    pendingCount: slice.sync.pendingCount,
    error: slice.sync.error,
    resync: slice.resync,
  };
}

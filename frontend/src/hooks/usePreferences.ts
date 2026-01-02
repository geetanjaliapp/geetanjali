/**
 * usePreferences - Main hook for accessing user preferences
 *
 * Provides access to the unified PreferencesContext with convenience
 * slice hooks for specific use cases.
 *
 * Part of v1.17.3 preference sync improvements.
 */

import { usePreferencesContext } from "../contexts/PreferencesContext";

/**
 * Main hook for accessing all user preferences.
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
 * Convenience hook for favorites functionality.
 *
 * @example
 * ```tsx
 * const { favorites, isFavorite, toggleFavorite } = useFavoritesPrefs();
 * ```
 */
export function useFavoritesPrefs() {
  const {
    favorites,
    favoritesCount,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  } = usePreferencesContext();

  return {
    favorites,
    favoritesCount,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}

/**
 * Convenience hook for goals functionality.
 *
 * @example
 * ```tsx
 * const { selectedGoals, toggleGoal, isGoalSelected } = useGoalsPrefs();
 * ```
 */
export function useGoalsPrefs() {
  const {
    goals,
    availableGoals,
    toggleGoal,
    setGoals,
    clearGoals,
    isGoalSelected,
  } = usePreferencesContext();

  return {
    selectedIds: goals.selectedIds,
    selectedGoals: goals.selectedGoals,
    goalPrinciples: goals.goalPrinciples,
    goals: availableGoals,
    toggleGoal,
    setGoals,
    clearGoals,
    isGoalSelected,
  };
}

/**
 * Convenience hook for reading preferences.
 *
 * @example
 * ```tsx
 * const { position, settings, saveReadingPosition, setFontSize } = useReadingPrefs();
 * ```
 */
export function useReadingPrefs() {
  const {
    reading,
    saveReadingPosition,
    setFontSize,
    resetReadingProgress,
  } = usePreferencesContext();

  return {
    position: reading.position,
    settings: reading.settings,
    saveReadingPosition,
    setFontSize,
    resetReadingProgress,
  };
}

/**
 * Convenience hook for sync status.
 *
 * @example
 * ```tsx
 * const { status, lastSynced, error, resync } = useSyncStatus();
 * ```
 */
export function useSyncStatus() {
  const { sync, resync } = usePreferencesContext();

  return {
    status: sync.status,
    lastSynced: sync.lastSynced,
    pendingCount: sync.pendingCount,
    error: sync.error,
    resync,
  };
}

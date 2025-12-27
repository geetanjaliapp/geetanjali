import { useState, useCallback, useMemo } from "react";
import { useTaxonomy } from "./useTaxonomy";
import type { Goal, Principle } from "../lib/api";
import { setStorageItem, STORAGE_KEYS } from "../lib/storage";

interface StoredGoals {
  goalIds: string[];
  selectedAt: string; // ISO timestamp
}

/**
 * Hook for managing the user's selected learning goals.
 *
 * Supports multi-selection. Goals are stored in localStorage and can be used for:
 * - Newsletter personalization
 * - Verse recommendations
 * - Personalized greetings
 *
 * @example
 * const { selectedGoalIds, toggleGoal, isSelected } = useLearningGoal();
 *
 * // Toggle a goal
 * toggleGoal('inner_peace');
 *
 * // Check if selected
 * console.log(isSelected('inner_peace')); // true or false
 */
// Helper to load goals from localStorage (for lazy init)
function loadStoredGoals(): StoredGoals | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.learningGoals);
    if (stored) {
      return JSON.parse(stored) as StoredGoals;
    }
  } catch {
    // Silently ignore parse errors - will use default
  }
  return null;
}

export function useLearningGoal() {
  // Lazy initialization from localStorage
  const [storedGoals, setStoredGoals] = useState<StoredGoals | null>(
    loadStoredGoals,
  );
  const { goals, getGoal, getPrinciplesForGoal } = useTaxonomy();

  // Always initialized since we use lazy init
  const initialized = true;

  /**
   * Toggle a goal selection (add if not selected, remove if selected)
   */
  const toggleGoal = useCallback((goalId: string) => {
    setStoredGoals((prev) => {
      const currentIds = prev?.goalIds ?? [];
      const isCurrentlySelected = currentIds.includes(goalId);

      const newIds = isCurrentlySelected
        ? currentIds.filter((id) => id !== goalId)
        : [...currentIds, goalId];

      const newGoals: StoredGoals = {
        goalIds: newIds,
        selectedAt: new Date().toISOString(),
      };

      setStorageItem(STORAGE_KEYS.learningGoals, newGoals);
      return newGoals;
    });
  }, []);

  /**
   * Set specific goals (replaces current selection)
   */
  const setGoals = useCallback((goalIds: string[]) => {
    const newGoals: StoredGoals = {
      goalIds,
      selectedAt: new Date().toISOString(),
    };
    setStorageItem(STORAGE_KEYS.learningGoals, newGoals);
    setStoredGoals(newGoals);
  }, []);

  /**
   * Clear all selected goals
   */
  const clearGoals = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.learningGoals);
    setStoredGoals(null);
  }, []);

  /**
   * Check if a specific goal is selected
   */
  const isSelected = useCallback(
    (goalId: string): boolean => {
      return storedGoals?.goalIds?.includes(goalId) ?? false;
    },
    [storedGoals],
  );

  // Get selected goal IDs (memoized to prevent new array reference each render)
  const selectedGoalIds = useMemo(
    () => storedGoals?.goalIds ?? [],
    [storedGoals?.goalIds],
  );

  // Get full goal data for all selected goals (memoized)
  const selectedGoals: Goal[] = useMemo(
    () =>
      selectedGoalIds
        .map((id) => getGoal(id))
        .filter((g): g is Goal => g !== undefined),
    [selectedGoalIds, getGoal],
  );

  // Get combined principles from all selected goals (deduplicated, memoized)
  const goalPrinciples: Principle[] = useMemo(() => {
    const allPrinciples = selectedGoalIds.flatMap((id) =>
      getPrinciplesForGoal(id),
    );
    // Deduplicate by principle id
    const seen = new Set<string>();
    return allPrinciples.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [selectedGoalIds, getPrinciplesForGoal]);

  // Memoize return value to prevent cascading re-renders
  return useMemo(
    () => ({
      // Current selection
      selectedGoalIds,
      selectedGoals,
      goalPrinciples,

      // Available goals from taxonomy
      goals,

      // Actions
      toggleGoal,
      setGoals,
      clearGoals,
      isSelected,

      // Loading state
      initialized,
    }),
    [
      selectedGoalIds,
      selectedGoals,
      goalPrinciples,
      goals,
      toggleGoal,
      setGoals,
      clearGoals,
      isSelected,
      initialized,
    ],
  );
}

export default useLearningGoal;

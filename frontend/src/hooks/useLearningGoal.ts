import { useState, useCallback } from "react";
import { useTaxonomy } from "./useTaxonomy";
import type { Goal, Principle } from "../lib/api";

const STORAGE_KEY = "geetanjali:learningGoals";

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
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredGoals;
    }
  } catch (e) {
    console.warn("Failed to parse stored learning goals:", e);
  }
  return null;
}

export function useLearningGoal() {
  // Lazy initialization from localStorage
  const [storedGoals, setStoredGoals] = useState<StoredGoals | null>(loadStoredGoals);
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

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newGoals));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newGoals));
    setStoredGoals(newGoals);
  }, []);

  /**
   * Clear all selected goals
   */
  const clearGoals = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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

  // Get selected goal IDs
  const selectedGoalIds: string[] = storedGoals?.goalIds ?? [];

  // Get full goal data for all selected goals
  const selectedGoals: Goal[] = selectedGoalIds
    .map((id) => getGoal(id))
    .filter((g): g is Goal => g !== undefined);

  // Get combined principles from all selected goals (deduplicated)
  const goalPrinciples: Principle[] = (() => {
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
  })();

  return {
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
  };
}

export default useLearningGoal;

/**
 * Context for sharing learning goals state across components.
 *
 * This context holds the selected learning goals and provides actions
 * to modify them. All components using useSyncedGoal() will share the
 * same state through this context.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useTaxonomy } from "../hooks/useTaxonomy";
import type { Goal, Principle } from "../lib/api";
import { setStorageItem, STORAGE_KEYS } from "../lib/storage";

interface StoredGoals {
  goalIds: string[];
  selectedAt: string; // ISO timestamp
}

interface LearningGoalContextType {
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
}

const LearningGoalContext = createContext<LearningGoalContextType | undefined>(
  undefined,
);

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
    // Silently ignore parse errors - will use default
  }
  return null;
}

interface LearningGoalProviderProps {
  children: ReactNode;
}

export function LearningGoalProvider({ children }: LearningGoalProviderProps) {
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

  // Memoize context value
  const value = useMemo<LearningGoalContextType>(
    () => ({
      selectedGoalIds,
      selectedGoals,
      goalPrinciples,
      goals,
      toggleGoal,
      setGoals,
      clearGoals,
      isSelected,
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

  return (
    <LearningGoalContext.Provider value={value}>
      {children}
    </LearningGoalContext.Provider>
  );
}

/**
 * Hook to access the learning goal context.
 * Must be used within a LearningGoalProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useLearningGoalContext(): LearningGoalContextType {
  const context = useContext(LearningGoalContext);
  if (!context) {
    throw new Error(
      "useLearningGoalContext must be used within a LearningGoalProvider",
    );
  }
  return context;
}

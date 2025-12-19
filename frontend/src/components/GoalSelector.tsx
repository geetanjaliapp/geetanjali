import { useLearningGoal } from "../hooks";
import { GoalIconsById, GoalIcons, CheckIcon } from "./icons";
import type { Goal } from "../lib/api";

interface GoalCardProps {
  goal: Goal;
  isSelected: boolean;
  onToggle: () => void;
}

function GoalCard({ goal, isSelected, onToggle }: GoalCardProps) {
  // Try ID-based lookup first, then fall back to icon name
  const IconComponent = GoalIconsById[goal.id] || GoalIcons[goal.icon];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-150
        text-left w-full
        focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        ${
          isSelected
            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
        }
      `}
      aria-pressed={isSelected}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 dark:bg-amber-600 flex items-center justify-center">
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Icon */}
      <div
        className={`
          mb-3 p-2 rounded-lg transition-colors
          ${
            isSelected
              ? "bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-400"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          }
        `}
      >
        {IconComponent ? (
          <IconComponent className="w-6 h-6" />
        ) : (
          // Fallback: question mark icon
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.01 4h.01" />
          </svg>
        )}
      </div>

      {/* Label */}
      <h3
        className={`
          font-semibold text-sm mb-1 transition-colors
          ${
            isSelected
              ? "text-amber-900 dark:text-amber-300"
              : "text-gray-900 dark:text-gray-100"
          }
        `}
      >
        {goal.label}
      </h3>

      {/* Description */}
      <p
        className={`
          text-xs text-center leading-relaxed transition-colors
          ${
            isSelected
              ? "text-amber-700 dark:text-amber-400"
              : "text-gray-500 dark:text-gray-400"
          }
        `}
      >
        {goal.description}
      </p>
    </button>
  );
}

interface GoalSelectorProps {
  /** Optional callback when goals change */
  onGoalsChange?: (goalIds: string[]) => void;
  /** Show loading skeleton when goals are loading */
  showSkeleton?: boolean;
}

/**
 * Goal selector grid component with multi-selection support.
 *
 * Displays all learning goals in a responsive grid.
 * Uses checkbox/toggle behavior - tapping toggles selection.
 * Consistent with "quiet library" design philosophy.
 */
export function GoalSelector({
  onGoalsChange,
  showSkeleton = true,
}: GoalSelectorProps) {
  const {
    goals,
    toggleGoal,
    isSelected,
    selectedGoalIds,
    initialized,
    setGoals,
    clearGoals,
  } = useLearningGoal();

  const handleToggle = (goalId: string) => {
    toggleGoal(goalId);
    // Callback with updated selection (need to compute new state)
    const newSelection = isSelected(goalId)
      ? selectedGoalIds.filter((id) => id !== goalId)
      : [...selectedGoalIds, goalId];
    onGoalsChange?.(newSelection);
  };

  const handleSelectAll = () => {
    const allIds = goals.map((g) => g.id);
    setGoals(allIds);
    onGoalsChange?.(allIds);
  };

  const handleClearAll = () => {
    clearGoals();
    onGoalsChange?.([]);
  };

  const selectedCount = selectedGoalIds.length;
  const allSelected = selectedCount === goals.length && goals.length > 0;

  // Loading skeleton
  if (!initialized && showSkeleton) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
          >
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Selection helpers */}
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          {selectedCount === 0
            ? "Select one or more"
            : `${selectedCount} selected`}
        </span>
        <div className="flex gap-3">
          {!allSelected && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline"
            >
              Select all
            </button>
          )}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Goal grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeIn"
        role="group"
        aria-label="Select your learning goals (multiple allowed)"
      >
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            isSelected={isSelected(g.id)}
            onToggle={() => handleToggle(g.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default GoalSelector;

import { useSyncedGoal } from "../hooks";
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
        relative flex items-center gap-2 p-2 sm:flex-col sm:p-2.5 sm:gap-1
        rounded-[var(--radius-button)] sm:rounded-[var(--radius-card)] border transition-[var(--transition-all)] w-full
        focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2
        focus-visible:ring-offset-[var(--focus-ring-offset)]
        ${
          isSelected
            ? "border-[var(--border-accent)] bg-[var(--surface-warm)]"
            : "border-[var(--border-default)] bg-[var(--surface-elevated)] hover:border-[var(--border-warm)]"
        }
      `}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Deselect" : "Select"} ${goal.label} learning goal`}
    >
      {/* Selection badge - only on sm+ */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-[var(--radius-avatar)] bg-[var(--chip-selected-bg)] ring-1 ring-[var(--chip-selected-ring)] flex items-center justify-center shadow-[var(--shadow-button)]">
          <CheckIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--chip-selected-text)]" />
        </div>
      )}

      {/* Icon badge */}
      <div
        className={`
          w-8 h-8 sm:w-10 sm:h-10 rounded-[var(--radius-avatar)] flex items-center justify-center shrink-0 transition-[var(--transition-color)]
          ${
            isSelected
              ? "bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)]"
              : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
          }
        `}
      >
        {IconComponent ? (
          <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.01 4h.01" />
          </svg>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 text-left sm:text-center">
        <h3
          className={`
            font-medium text-xs sm:text-sm leading-tight transition-[var(--transition-color)] truncate sm:whitespace-normal
            ${
              isSelected
                ? "text-[var(--badge-warm-text)]"
                : "text-[var(--text-primary)]"
            }
          `}
        >
          {goal.label}
        </h3>
        {/* Description - hidden on mobile */}
        <p className="hidden sm:block text-[11px] text-center leading-snug text-[var(--text-tertiary)] line-clamp-2 mt-0.5">
          {goal.description}
        </p>
      </div>
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
  } = useSyncedGoal();

  const handleToggle = (goalId: string) => {
    // Compute new selection BEFORE toggle to avoid stale closure
    const wasSelected = isSelected(goalId);
    const newSelection = wasSelected
      ? selectedGoalIds.filter((id) => id !== goalId)
      : [...selectedGoalIds, goalId];

    toggleGoal(goalId);
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-2 sm:flex-col sm:p-2.5 rounded-[var(--radius-button)] sm:rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-elevated)] animate-pulse"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--surface-muted)] rounded-[var(--radius-avatar)] shrink-0" />
            <div className="flex-1 sm:w-full">
              <div className="h-3 sm:h-4 bg-[var(--surface-muted)] rounded-[var(--radius-skeleton)] w-16 sm:w-full sm:mx-auto" />
              <div className="hidden sm:block h-3 bg-[var(--surface-muted)] rounded-[var(--radius-skeleton)] w-20 mx-auto mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Selection helpers */}
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="text-[var(--text-tertiary)] py-2">
          {selectedCount === 0
            ? "Select one or more"
            : `${selectedCount} selected`}
        </span>
        <div className="flex gap-1">
          {!allSelected && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="min-h-[44px] px-3 py-2 text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:bg-[var(--surface-warm)] active:bg-[var(--badge-warm-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
            >
              Select all
            </button>
          )}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="min-h-[44px] px-3 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)] active:bg-[var(--surface-muted)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Goal grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 animate-fadeIn"
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

/**
 * GoalFilterSelector - Goal picker for Verse Explorer filter bar
 *
 * Design: Matches TopicSelector pattern - subtle popover/bottom sheet.
 * Single select - when a goal is selected, verses are filtered by that goal's principles.
 *
 * Features:
 * - 8 learning goals in responsive grid
 * - Mobile: bottom sheet, Tablet+: dropdown
 * - Footer link to /settings#goals for full goal management
 * - WCAG grid keyboard navigation
 *
 * Used by: Verses.tsx filter bar
 */

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { GoalIconsById } from "./icons";

interface GoalFilterSelectorProps {
  /** Currently selected goal ID (null = none) */
  selectedGoal: string | null;
  /** Callback when a goal is selected */
  onSelect: (goalId: string | null) => void;
  /** Callback to close the selector */
  onClose: () => void;
  /** Whether the selector is visible */
  isOpen: boolean;
}

export function GoalFilterSelector({
  selectedGoal,
  onSelect,
  onClose,
  isOpen,
}: GoalFilterSelectorProps) {
  const { goals, loading } = useTaxonomy();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus management: focus selected goal or first goal on open
  useEffect(() => {
    if (isOpen && goals.length > 0) {
      requestAnimationFrame(() => {
        const selectedIndex = selectedGoal
          ? goals.findIndex((g) => g.id === selectedGoal)
          : 0;
        const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
        buttonRefs.current[targetIndex]?.focus();
      });
    }
  }, [isOpen, selectedGoal, goals]);

  // Keyboard navigation (WCAG grid pattern)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const total = goals.length;
      if (total === 0) return;

      // Responsive columns: 2 on mobile, 4 on tablet+
      const isMobile = window.innerWidth < 640;
      const cols = isMobile ? 2 : 4;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          return;
        case "ArrowRight":
          e.preventDefault();
          nextIndex = index < total - 1 ? index + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = index > 0 ? index - 1 : total - 1;
          break;
        case "ArrowDown":
          e.preventDefault();
          nextIndex = index + cols < total ? index + cols : index % cols;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex =
            index - cols >= 0 ? index - cols : total - cols + (index % cols);
          if (nextIndex >= total) nextIndex = total - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = total - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        buttonRefs.current[nextIndex]?.focus();
      }
    },
    [goals.length, onClose]
  );

  // Handle goal selection
  const handleSelect = useCallback(
    (goalId: string) => {
      // Toggle off if already selected, otherwise select
      onSelect(selectedGoal === goalId ? null : goalId);
      onClose();
    },
    [selectedGoal, onSelect, onClose]
  );

  // Handle footer link click (close selector)
  const handleFooterClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Use portal to render outside sticky filter bar
  return createPortal(
    <>
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg-light)] z-50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="goal-backdrop"
      />

      {/* Bottom sheet on mobile, dropdown on desktop */}
      <div
        className="fixed bottom-0 left-0 right-0 sm:bottom-auto sm:top-[140px] sm:right-4 sm:left-auto
                   z-50 w-full sm:w-[360px] md:w-[420px] max-h-[80vh] sm:max-h-[70vh] overflow-y-auto
                   bg-[var(--surface-sticky-translucent)] backdrop-blur-xs
                   border-t sm:border border-[var(--border-warm)]
                   rounded-t-[var(--radius-modal)] sm:rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)]
                   p-4 pb-20 sm:pb-4"
        role="dialog"
        aria-modal="true"
        aria-label="Select learning goal"
      >
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden flex justify-center mb-3">
          <div className="w-10 h-1 bg-[var(--border-warm)] rounded-full" />
        </div>

        {/* Header */}
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          What brings you to the Geeta?
        </h3>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-3 rounded-[var(--radius-button)] border border-[var(--border-default)] bg-[var(--surface-elevated)] animate-pulse"
              >
                <div className="w-8 h-8 bg-[var(--skeleton-bg)] rounded-full mb-2" />
                <div className="h-3 bg-[var(--skeleton-bg)] rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          /* Goals grid: 2 cols on mobile, 4 cols on tablet+ */
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            role="group"
            aria-label="Learning goals"
          >
            {goals.map((goal, index) => {
              const isSelected = goal.id === selectedGoal;
              const isTabTarget =
                (selectedGoal && goal.id === selectedGoal) ||
                (!selectedGoal && index === 0);
              const IconComponent = GoalIconsById[goal.id];

              return (
                <button
                  key={goal.id}
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  onClick={() => handleSelect(goal.id)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  tabIndex={isTabTarget ? 0 : -1}
                  className={`
                    flex flex-col items-center p-3 rounded-[var(--radius-button)]
                    text-center transition-[var(--transition-color)]
                    focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                    ${
                      isSelected
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-[var(--chip-selected-ring)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)] active:bg-[var(--badge-warm-hover)]"
                    }
                  `}
                  aria-pressed={isSelected}
                >
                  {/* Icon */}
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center mb-1.5 transition-colors
                      ${
                        isSelected
                          ? "bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)]"
                          : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                      }
                    `}
                  >
                    {IconComponent && (
                      <IconComponent className="w-4 h-4" />
                    )}
                  </div>
                  {/* Label */}
                  <span className="text-xs font-medium leading-tight line-clamp-2">
                    {goal.label}
                  </span>
                  {/* Principle count - subtle */}
                  <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {goal.principles.length === 0
                      ? "All 16 topics"
                      : `${goal.principles.length} topics`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer separator and link */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <Link
            to="/settings#goals"
            onClick={handleFooterClick}
            className="text-sm font-medium text-[var(--text-accent)]
                       hover:text-[var(--interactive-primary)]
                       underline underline-offset-2
                       focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            Manage your learning goals →
          </Link>
        </div>
      </div>
    </>,
    document.body
  );
}

/**
 * ChapterFilterSelector - Chapter picker for Verse Explorer filter bar
 *
 * Design: Matches GoalFilterSelector/TopicSelector pattern - portal-based
 * popover that escapes sticky bar clipping.
 *
 * Features:
 * - 18 chapter buttons in 6-column grid
 * - Mobile: bottom sheet, Desktop: centered dropdown
 * - Toggle behavior (click selected to clear)
 * - WCAG grid keyboard navigation
 *
 * Used by: Verses.tsx filter bar
 */

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

interface ChapterFilterSelectorProps {
  /** Currently selected chapter (null = none) */
  selectedChapter: number | null;
  /** Callback when a chapter is selected */
  onSelect: (chapter: number | null) => void;
  /** Callback to close the selector */
  onClose: () => void;
  /** Whether the selector is visible */
  isOpen: boolean;
}

const TOTAL_CHAPTERS = 18;
const GRID_COLS = 6;

export function ChapterFilterSelector({
  selectedChapter,
  onSelect,
  onClose,
  isOpen,
}: ChapterFilterSelectorProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus management: focus selected chapter or first on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        const targetIndex = selectedChapter ? selectedChapter - 1 : 0;
        buttonRefs.current[targetIndex]?.focus();
      });
    }
  }, [isOpen, selectedChapter]);

  // Keyboard navigation (WCAG grid pattern)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          return;
        case "ArrowRight":
          e.preventDefault();
          nextIndex = index < TOTAL_CHAPTERS - 1 ? index + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = index > 0 ? index - 1 : TOTAL_CHAPTERS - 1;
          break;
        case "ArrowDown":
          e.preventDefault();
          nextIndex =
            index + GRID_COLS < TOTAL_CHAPTERS
              ? index + GRID_COLS
              : index % GRID_COLS;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex =
            index - GRID_COLS >= 0
              ? index - GRID_COLS
              : TOTAL_CHAPTERS - GRID_COLS + (index % GRID_COLS);
          if (nextIndex >= TOTAL_CHAPTERS) nextIndex = TOTAL_CHAPTERS - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = TOTAL_CHAPTERS - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        buttonRefs.current[nextIndex]?.focus();
      }
    },
    [onClose]
  );

  // Handle chapter selection (toggle off if already selected)
  const handleSelect = useCallback(
    (chapter: number) => {
      onSelect(selectedChapter === chapter ? null : chapter);
      onClose();
    },
    [selectedChapter, onSelect, onClose]
  );

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg-light)] z-50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="chapter-backdrop"
      />

      {/* Bottom sheet on mobile, centered dropdown on desktop */}
      <div
        className="fixed bottom-0 left-0 right-0
                   sm:bottom-auto sm:top-[160px] sm:left-1/2 sm:-translate-x-1/2 sm:right-auto
                   z-50 w-full sm:w-[320px] max-h-[80vh] sm:max-h-[70vh] overflow-y-auto
                   bg-[var(--surface-sticky-translucent)] backdrop-blur-xs
                   border-t sm:border border-[var(--border-warm)]
                   rounded-t-[var(--radius-modal)] sm:rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)]
                   p-4 pb-20 sm:pb-4"
        role="dialog"
        aria-modal="true"
        aria-label="Select chapter"
      >
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden flex justify-center mb-3">
          <div className="w-10 h-1 bg-[var(--border-warm)] rounded-full" />
        </div>

        {/* Header */}
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Select Chapter
        </h3>

        {/* Chapter grid: 6 columns */}
        <div
          className="grid grid-cols-6 gap-2"
          role="group"
          aria-label="Chapters"
        >
          {Array.from({ length: TOTAL_CHAPTERS }, (_, i) => i + 1).map(
            (chapter, index) => {
              const isSelected = chapter === selectedChapter;
              const isTabTarget =
                (selectedChapter && chapter === selectedChapter) ||
                (!selectedChapter && index === 0);

              return (
                <button
                  key={chapter}
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  onClick={() => handleSelect(chapter)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  tabIndex={isTabTarget ? 0 : -1}
                  className={`
                    h-10 sm:h-11 rounded-[var(--radius-button)]
                    text-sm font-medium
                    transition-[var(--transition-color)]
                    focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                    ${
                      isSelected
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-[var(--chip-selected-ring)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)] active:bg-[var(--badge-warm-hover)]"
                    }
                  `}
                  aria-pressed={isSelected}
                >
                  {chapter}
                </button>
              );
            }
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

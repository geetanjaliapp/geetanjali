/**
 * ChapterFilterSelector - Chapter picker for Verse Explorer filter bar
 *
 * Design: Portal-based popover matching GoalFilterSelector/TopicSelector.
 * Mobile uses top+bottom positioning due to mobile viewport quirks.
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
  selectedChapter: number | null;
  onSelect: (chapter: number | null) => void;
  onClose: () => void;
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

  // Focus management
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg-light)] z-50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="chapter-backdrop"
      />

      {/* Dropdown: Mobile bottom sheet, Desktop centered */}
      <div
        className="fixed z-50 bg-[var(--surface-elevated)] shadow-[var(--shadow-dropdown)]
                   left-0 right-0 top-[50%] bottom-0 rounded-t-2xl overflow-y-auto p-4
                   sm:bottom-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:top-[160px]
                   sm:w-[280px] sm:rounded-xl sm:border sm:border-[var(--border-default)]"
        role="dialog"
        aria-modal="true"
        aria-label="Select chapter"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center mb-3">
          <div className="w-10 h-1 bg-[var(--border-warm)] rounded-full" />
        </div>

        {/* Header */}
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Select Chapter
        </h3>

        {/* Chapter grid */}
        <div className="grid grid-cols-6 gap-2" role="group" aria-label="Chapters">
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
                    h-10 sm:h-11 rounded-lg text-sm font-medium transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                    ${
                      isSelected
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-[var(--chip-selected-ring)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
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

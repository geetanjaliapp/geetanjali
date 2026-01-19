/**
 * ChapterSelector - Compact chapter picker for Reading Mode
 *
 * Design: Subtle popover that feels like a quiet helper, not a modal blocker.
 * Matches the amber/spiritual aesthetic of the reading experience.
 *
 * Features:
 * - Compact 6x3 grid
 * - Current chapter subtly highlighted
 * - Click outside or Escape to close
 *
 * Used by: ReadingMode
 */

import { useEffect, useCallback, useRef } from "react";
import { CHAPTERS } from "../constants/chapters";

interface ChapterSelectorProps {
  /** Currently selected chapter */
  currentChapter: number;
  /** Callback when a chapter is selected */
  onSelect: (chapter: number) => void;
  /** Callback to close the selector */
  onClose: () => void;
  /** Whether the selector is visible */
  isOpen: boolean;
  /** Callback when Dhyanam is selected (Phase 3.6) */
  onDhyanam?: () => void;
}

export function ChapterSelector({
  currentChapter,
  onSelect,
  onClose,
  isOpen,
  onDhyanam,
}: ChapterSelectorProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Grid columns: 6 columns × 3 rows = 18 chapters (fixed for Bhagavad Geeta)
  // This is intentionally not responsive - the Geeta always has 18 chapters
  const COLS = 6;

  // Focus first item when selector opens (WCAG 2.1)
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        // Focus current chapter button, or first button
        const currentIndex = currentChapter - 1;
        const targetButton = buttonRefs.current[currentIndex] ?? buttonRefs.current[0];
        targetButton?.focus();
      });
    }
  }, [isOpen, currentChapter]);

  // Handle keyboard navigation (WCAG 2.1 grid pattern)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const totalChapters = Object.keys(CHAPTERS).length;
      let nextIndex: number | null = null;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          return;
        case "ArrowRight":
          e.preventDefault();
          nextIndex = index < totalChapters - 1 ? index + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = index > 0 ? index - 1 : totalChapters - 1;
          break;
        case "ArrowDown":
          e.preventDefault();
          nextIndex = index + COLS < totalChapters ? index + COLS : index % COLS;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = index - COLS >= 0 ? index - COLS : totalChapters - COLS + (index % COLS);
          // Clamp to valid range
          if (nextIndex >= totalChapters) nextIndex = totalChapters - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = totalChapters - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        buttonRefs.current[nextIndex]?.focus();
      }
    },
    [onClose],
  );

  // Handle chapter selection
  const handleSelect = useCallback(
    (chapter: number) => {
      onSelect(chapter);
      onClose();
    },
    [onSelect, onClose],
  );

  // Handle Dhyanam selection
  const handleDhyanam = useCallback(() => {
    if (onDhyanam) {
      onDhyanam();
      onClose();
    }
  }, [onDhyanam, onClose]);

  if (!isOpen) return null;

  const chapters = Object.keys(CHAPTERS).map(Number);
  const currentIndex = chapters.indexOf(currentChapter);

  return (
    <>
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg-light)] z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Compact popover - positioned above bottom nav */}
      <div
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50
                   bg-[var(--surface-sticky-translucent)] backdrop-blur-xs border border-[var(--border-warm)]
                   rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] p-3 w-[328px] sm:w-[360px]"
        role="dialog"
        aria-modal="true"
        aria-label="Select chapter"
      >
        {/* Dhyanam link - persistent entry point (Phase 3.6) */}
        {onDhyanam && (
          <button
            onClick={handleDhyanam}
            className="w-full mb-3 py-2.5 flex items-center justify-center gap-2
                       text-sm font-medium text-[var(--text-primary)]
                       bg-[var(--surface-warm-subtle)] hover:bg-[var(--surface-warm-hover)]
                       border border-[var(--border-warm-subtle)] hover:border-[var(--border-warm)]
                       rounded-[var(--radius-button)] transition-[var(--transition-color)]
                       focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <span>🙏</span>
            <span>गीता ध्यानम्</span>
            <span className="text-[var(--text-tertiary)]">· Invocation</span>
          </button>
        )}

        {/* Compact chapter grid - 6 columns with improved touch targets */}
        <div
          ref={gridRef}
          className="grid grid-cols-6 gap-2"
          role="grid"
          aria-label="Chapters"
        >
          {chapters.map((chapter, index) => {
            const isCurrentChapter = chapter === currentChapter;
            const isTabTarget = index === currentIndex || (currentIndex === -1 && index === 0);

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
                  flex items-center justify-center
                  w-12 h-12 rounded-[var(--radius-button)] text-sm font-medium
                  transition-[var(--transition-color)]
                  focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                  ${
                    isCurrentChapter
                      ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-[var(--chip-selected-ring)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)] active:bg-[var(--badge-warm-hover)]"
                  }
                `}
                aria-current={isCurrentChapter ? "true" : undefined}
                aria-label={`Chapter ${chapter}${isCurrentChapter ? ", current" : ""}`}
              >
                {chapter}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

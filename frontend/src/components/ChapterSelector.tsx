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

import { useEffect, useCallback } from "react";
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
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
        <div className="grid grid-cols-6 gap-2">
          {chapters.map((chapter) => {
            const isCurrentChapter = chapter === currentChapter;

            return (
              <button
                key={chapter}
                onClick={() => handleSelect(chapter)}
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

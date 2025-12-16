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
}

export function ChapterSelector({
  currentChapter,
  onSelect,
  onClose,
  isOpen,
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

  if (!isOpen) return null;

  const chapters = Object.keys(CHAPTERS).map(Number);

  return (
    <>
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 bg-amber-900/20 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Compact popover - positioned above bottom nav */}
      <div
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50
                   bg-amber-50/95 backdrop-blur-sm border border-amber-200/60
                   rounded-xl shadow-lg p-3 w-[280px] sm:w-[320px]"
        role="dialog"
        aria-modal="true"
        aria-label="Select chapter"
      >
        {/* Compact chapter grid - 6 columns */}
        <div className="grid grid-cols-6 gap-1.5">
          {chapters.map((chapter) => {
            const isCurrentChapter = chapter === currentChapter;

            return (
              <button
                key={chapter}
                onClick={() => handleSelect(chapter)}
                className={`
                  flex items-center justify-center
                  w-10 h-10 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                  ${
                    isCurrentChapter
                      ? "bg-amber-600 text-white"
                      : "text-amber-800 hover:bg-amber-200/70 active:bg-amber-300/70"
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

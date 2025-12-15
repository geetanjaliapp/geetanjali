/**
 * ChapterSelector - Grid overlay for selecting chapters in Reading Mode
 *
 * Features:
 * - 18 chapter grid (6x3 on mobile, responsive)
 * - Current chapter highlighted
 * - Shows verse count per chapter
 * - Click to navigate, escape to close
 * - Backdrop click to close
 *
 * Used by: ReadingMode
 */

import { useEffect, useCallback } from "react";
import { CHAPTERS, getChapterVerseCount } from "../constants/chapters";

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
    [onSelect, onClose]
  );

  if (!isOpen) return null;

  const chapters = Object.keys(CHAPTERS).map(Number);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Selector Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl
                   animate-slide-up max-h-[70vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Select chapter"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 text-center">
            Select Chapter
          </h2>
        </div>

        {/* Chapter Grid */}
        <div className="p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {chapters.map((chapter) => {
              const isCurrentChapter = chapter === currentChapter;
              const verseCount = getChapterVerseCount(chapter);

              return (
                <button
                  key={chapter}
                  onClick={() => handleSelect(chapter)}
                  className={`
                    flex flex-col items-center justify-center
                    p-3 sm:p-4 rounded-xl
                    transition-all duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                    ${
                      isCurrentChapter
                        ? "bg-amber-500 text-white shadow-lg scale-105"
                        : "bg-amber-50 text-amber-900 hover:bg-amber-100 hover:scale-102"
                    }
                  `}
                  aria-current={isCurrentChapter ? "true" : undefined}
                  aria-label={`Chapter ${chapter}, ${verseCount} verses${isCurrentChapter ? ", current" : ""}`}
                >
                  <span className="text-lg sm:text-xl font-bold">{chapter}</span>
                  <span
                    className={`text-xs mt-0.5 ${
                      isCurrentChapter ? "text-amber-100" : "text-amber-600/70"
                    }`}
                  >
                    {verseCount}v
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Close button for accessibility */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 text-amber-700 font-medium hover:bg-amber-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

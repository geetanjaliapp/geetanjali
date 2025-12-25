/**
 * StickyBottomNav - Fixed footer navigation for mobile
 *
 * Shows previous/next verse navigation at the bottom of the screen,
 * always visible without scrolling.
 *
 * Features:
 * - Fixed position at bottom (thumb zone)
 * - Touch-friendly tap targets (min 44px)
 * - Graceful fallback at boundaries
 * - Hidden on desktop (sm:hidden)
 *
 * Used by: VerseDetail (mobile only)
 */

import { Link } from "react-router-dom";
import type { Verse } from "../types";

interface StickyBottomNavProps {
  /** Previous verse data, null if at start of Geeta */
  prevVerse: Verse | null;
  /** Next verse data, null if at end of Geeta */
  nextVerse: Verse | null;
  /** Current chapter number (for display when no adjacent verse) */
  currentChapter: number;
  /** Current verse number (for display when no adjacent verse) */
  currentVerse: number;
}

/**
 * Format verse reference (e.g., "2.46")
 */
function formatVerseRef(verse: Verse): string {
  return `${verse.chapter}.${verse.verse}`;
}

export function StickyBottomNav({
  prevVerse,
  nextVerse,
  currentChapter,
  currentVerse,
}: StickyBottomNavProps) {
  // Check if we're at boundaries
  const isAtStart = !prevVerse && currentChapter === 1 && currentVerse === 1;
  const isAtEnd = !nextVerse && currentChapter === 18;

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xs
                 border-t border-amber-200 dark:border-gray-700 shadow-lg z-40"
      aria-label="Verse navigation"
    >
      <div className="flex items-stretch">
        {/* Previous verse button */}
        {prevVerse ? (
          <Link
            to={`/verses/${prevVerse.canonical_id}?from=browse`}
            className="flex-1 flex items-center justify-start gap-2 p-4 min-h-[56px]
                       hover:bg-amber-50 dark:hover:bg-gray-700 active:bg-amber-100 dark:active:bg-gray-600 transition-colors
                       focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset
                       focus-visible:ring-amber-500"
            aria-label={`Previous verse: ${formatVerseRef(prevVerse)}`}
          >
            <span
              aria-hidden="true"
              className="text-amber-700 dark:text-amber-400 text-lg"
            >
              ←
            </span>
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {formatVerseRef(prevVerse)}
            </span>
          </Link>
        ) : (
          <div
            className={`flex-1 flex items-center justify-start gap-2 p-4 min-h-[56px]
                        ${isAtStart ? "text-gray-300 dark:text-gray-600" : "text-gray-400 dark:text-gray-500"}`}
            aria-disabled="true"
          >
            <span aria-hidden="true" className="text-lg">
              ←
            </span>
            <span className="font-medium">{isAtStart ? "Start" : "..."}</span>
          </div>
        )}

        {/* Divider */}
        <div className="w-px bg-amber-200 dark:bg-gray-600 my-3" />

        {/* Next verse button */}
        {nextVerse ? (
          <Link
            to={`/verses/${nextVerse.canonical_id}?from=browse`}
            className="flex-1 flex items-center justify-end gap-2 p-4 min-h-[56px]
                       hover:bg-amber-50 dark:hover:bg-gray-700 active:bg-amber-100 dark:active:bg-gray-600 transition-colors
                       focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset
                       focus-visible:ring-amber-500"
            aria-label={`Next verse: ${formatVerseRef(nextVerse)}`}
          >
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {formatVerseRef(nextVerse)}
            </span>
            <span
              aria-hidden="true"
              className="text-amber-700 dark:text-amber-400 text-lg"
            >
              →
            </span>
          </Link>
        ) : (
          <div
            className={`flex-1 flex items-center justify-end gap-2 p-4 min-h-[56px]
                        ${isAtEnd ? "text-gray-300 dark:text-gray-600" : "text-gray-400 dark:text-gray-500"}`}
            aria-disabled="true"
          >
            <span className="font-medium">{isAtEnd ? "End" : "..."}</span>
            <span aria-hidden="true" className="text-lg">
              →
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}

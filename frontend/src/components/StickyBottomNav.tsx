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
      className="sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface-elevated)]/95 backdrop-blur-xs
                 border-t border-[var(--border-warm)] shadow-lg z-40"
      aria-label="Verse navigation"
    >
      <div className="flex items-stretch">
        {/* Previous verse button */}
        {prevVerse ? (
          <Link
            to={`/verses/${prevVerse.canonical_id}?from=browse`}
            className="flex-1 flex items-center justify-start gap-2 p-4 min-h-[56px]
                       hover:bg-[var(--surface-warm)] active:bg-[var(--badge-warm-bg)] transition-colors
                       focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset
                       focus-visible:ring-amber-500"
            aria-label={`Previous verse: ${formatVerseRef(prevVerse)}`}
          >
            <span
              aria-hidden="true"
              className="text-[var(--badge-warm-text)] text-lg"
            >
              ←
            </span>
            <span className="text-[var(--badge-warm-text)] font-medium">
              {formatVerseRef(prevVerse)}
            </span>
          </Link>
        ) : (
          <div
            className={`flex-1 flex items-center justify-start gap-2 p-4 min-h-[56px]
                        ${isAtStart ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]"}`}
            aria-disabled="true"
          >
            <span aria-hidden="true" className="text-lg">
              ←
            </span>
            <span className="font-medium">{isAtStart ? "Start" : "..."}</span>
          </div>
        )}

        {/* Divider */}
        <div className="w-px bg-[var(--divider-warm)] my-3" />

        {/* Next verse button */}
        {nextVerse ? (
          <Link
            to={`/verses/${nextVerse.canonical_id}?from=browse`}
            className="flex-1 flex items-center justify-end gap-2 p-4 min-h-[56px]
                       hover:bg-[var(--surface-warm)] active:bg-[var(--badge-warm-bg)] transition-colors
                       focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset
                       focus-visible:ring-amber-500"
            aria-label={`Next verse: ${formatVerseRef(nextVerse)}`}
          >
            <span className="text-[var(--badge-warm-text)] font-medium">
              {formatVerseRef(nextVerse)}
            </span>
            <span
              aria-hidden="true"
              className="text-[var(--badge-warm-text)] text-lg"
            >
              →
            </span>
          </Link>
        ) : (
          <div
            className={`flex-1 flex items-center justify-end gap-2 p-4 min-h-[56px]
                        ${isAtEnd ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]"}`}
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

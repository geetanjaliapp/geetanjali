/**
 * FloatingNavArrow - Desktop gallery-style floating navigation
 *
 * Floating arrows positioned at the sides of the viewport for
 * easy verse navigation without scrolling.
 *
 * Features:
 * - Fixed Y position (vertically centered in viewport)
 * - Absolute X position (left/right of content)
 * - Default: Translucent (70% opacity)
 * - Hover: Solid + scale up
 * - Hidden on mobile (hidden sm:block)
 *
 * Used by: VerseDetail (desktop only)
 */

import { Link } from "react-router-dom";
import type { Verse } from "../types";

interface FloatingNavArrowProps {
  /** Direction of navigation */
  direction: "prev" | "next";
  /** Verse data for the navigation target */
  verse: Verse | null;
  /** Whether the user is at the start (prev) or end (next) of the Geeta */
  isAtBoundary: boolean;
}

/**
 * Format verse reference (e.g., "2.46")
 */
function formatVerseRef(verse: Verse): string {
  return `${verse.chapter}.${verse.verse}`;
}

export function FloatingNavArrow({
  direction,
  verse,
  isAtBoundary,
}: FloatingNavArrowProps) {
  const isPrev = direction === "prev";

  // Don't render if at boundary or no verse data
  if (!verse || isAtBoundary) {
    return null;
  }

  return (
    <Link
      to={`/verses/${verse.canonical_id}?from=browse`}
      className={`hidden sm:flex fixed top-1/2 -translate-y-1/2 z-30
                  ${isPrev ? "left-2 lg:left-4" : "right-2 lg:right-4"}
                  items-center justify-center
                  p-3 lg:p-4
                  bg-[var(--surface-elevated-translucent)] backdrop-blur-xs rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)]
                  border border-[var(--border-warm)]
                  opacity-70 hover:opacity-100
                  hover:bg-[var(--surface-elevated)] hover:scale-105 hover:shadow-[var(--shadow-modal)]
                  transition-[var(--transition-all)]
                  focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                  focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]`}
      aria-label={`${isPrev ? "Previous" : "Next"} verse: ${formatVerseRef(verse)}`}
    >
      <div
        className={`flex items-center gap-1.5 text-[var(--badge-warm-text)] font-medium text-sm lg:text-base
                       ${isPrev ? "flex-row" : "flex-row-reverse"}`}
      >
        <span aria-hidden="true" className="text-lg lg:text-xl">
          {isPrev ? "←" : "→"}
        </span>
        <span>{formatVerseRef(verse)}</span>
      </div>
    </Link>
  );
}

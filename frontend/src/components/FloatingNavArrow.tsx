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
      to={`/verses/${verse.canonical_id}`}
      className={`hidden sm:flex fixed top-1/2 -translate-y-1/2 z-30
                  ${isPrev ? "left-2 lg:left-4" : "right-2 lg:right-4"}
                  items-center justify-center
                  p-3 lg:p-4
                  bg-white/80 backdrop-blur-sm rounded-xl shadow-lg
                  border border-amber-200/50
                  opacity-70 hover:opacity-100
                  hover:bg-white hover:scale-105 hover:shadow-xl
                  transition-all duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                  focus-visible:ring-offset-2`}
      aria-label={`${isPrev ? "Previous" : "Next"} verse: ${formatVerseRef(verse)}`}
    >
      <div
        className={`flex items-center gap-1.5 text-amber-700 font-medium text-sm lg:text-base
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

/**
 * Utility functions for verse grid components.
 *
 * Separated from VersesGrid.tsx to allow Fast Refresh to work properly
 * (React Fast Refresh requires files to only export components).
 */

import type { SearchResult } from "../../types";
import type { VerseMatch } from "../VerseCard";

/**
 * Get human-readable label for search strategy
 */
export function getStrategyLabel(strategy: string): string {
  const labels: Record<string, string> = {
    canonical: "Exact Match",
    sanskrit: "Sanskrit Match",
    keyword: "Keyword Search",
    principle: "Topic Filter",
    semantic: "Semantic Search",
  };
  return labels[strategy] || strategy;
}

/**
 * Convert SearchResult match to VerseMatch for VerseCard
 */
export function toVerseMatch(match: SearchResult["match"]): VerseMatch {
  return {
    type: match.type as VerseMatch["type"],
    highlight: match.highlight ?? undefined,
    field: match.field?.replace("_", " ") ?? undefined,
  };
}

/**
 * Get number of columns based on viewport width (matches Tailwind breakpoints)
 */
export function getColumnCount(): number {
  if (typeof window === "undefined") return 1;
  const width = window.innerWidth;
  if (width >= 1280) return 4; // xl
  if (width >= 1024) return 3; // lg
  if (width >= 640) return 2; // sm
  return 1;
}

/**
 * Virtualized verse grid components for browse and search modes.
 *
 * Uses @tanstack/react-virtual for efficient rendering of large datasets,
 * with automatic fallback to simple grid for small datasets.
 */

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { Verse, SearchResult } from "../../types";
import { VerseCard } from "../VerseCard";
import { toVerseMatch } from "./versesGridUtils";

// Shared grid layout classes
const VERSE_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 items-start";

// Virtualization threshold - below this, render without virtualization
// Set to 60 (5 pages) to avoid mid-session switches when loading more
const VIRTUALIZATION_THRESHOLD = 60;

// Estimated row height for virtualization (includes gap)
// Card ~260px + gap 16px = ~276px, round up for safety
const ESTIMATED_ROW_HEIGHT = 290;

// Gap between grid rows (matches gap-4 = 1rem = 16px)
const ROW_GAP = 16;

/**
 * Browse Verse Grid - Uses virtualization for large datasets, simple grid for small ones
 */
export interface BrowseVerseGridProps {
  verses: Verse[];
  columnCount: number;
  loading: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

export function BrowseVerseGrid({
  verses,
  columnCount,
  loading,
  isFavorite,
  toggleFavorite,
}: BrowseVerseGridProps) {
  // Calculate row count for virtualization
  const rowCount = Math.ceil(verses.length / columnCount);

  // Use virtualization only for large datasets
  const shouldVirtualize = verses.length > VIRTUALIZATION_THRESHOLD;

  // Window virtualizer for row-based virtualization
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 3, // Render 3 extra rows above/below viewport
  });

  // Render a single verse card
  const renderVerseCard = (verse: Verse) => (
    <VerseCard
      key={verse.id}
      verse={verse}
      displayMode="compact"
      showSpeaker={false}
      showCitation={true}
      showTranslation={false}
      showTranslationPreview={true}
      linkTo={`/verses/${verse.canonical_id}?from=browse`}
      isFavorite={isFavorite(verse.canonical_id)}
      onToggleFavorite={toggleFavorite}
    />
  );

  // Simple grid for small datasets (no virtualization)
  if (!shouldVirtualize) {
    return (
      <div
        className={`relative z-0 pb-4 ${loading ? "opacity-50" : "opacity-100"}`}
      >
        <div className={VERSE_GRID_CLASSES}>{verses.map(renderVerseCard)}</div>
      </div>
    );
  }

  // Virtualized grid for large datasets
  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      className={`relative z-0 pb-4 ${loading ? "opacity-50" : "opacity-100"}`}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowVerses = verses.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: `${ROW_GAP}px`,
              }}
            >
              <div className={VERSE_GRID_CLASSES}>
                {rowVerses.map(renderVerseCard)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Search Verse Grid - Uses virtualization for large result sets, simple grid for small ones
 */
export interface SearchVerseGridProps {
  results: SearchResult[];
  columnCount: number;
  loading: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

export function SearchVerseGrid({
  results,
  columnCount,
  loading,
  isFavorite,
  toggleFavorite,
}: SearchVerseGridProps) {
  // Calculate row count for virtualization
  const rowCount = Math.ceil(results.length / columnCount);

  // Use virtualization only for large datasets
  const shouldVirtualize = results.length > VIRTUALIZATION_THRESHOLD;

  // Window virtualizer for row-based virtualization
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 3,
  });

  // Render a single search result card
  const renderResultCard = (result: SearchResult) => (
    <VerseCard
      key={result.canonical_id}
      verse={
        {
          ...result,
          id: result.canonical_id,
          consulting_principles: result.principles,
          created_at: "",
        } as Verse
      }
      displayMode="compact"
      showSpeaker={false}
      showCitation={true}
      showTranslation={false}
      showTranslationPreview={!result.match.highlight}
      linkTo={`/verses/${result.canonical_id}?from=search`}
      isFavorite={isFavorite(result.canonical_id)}
      onToggleFavorite={toggleFavorite}
      match={toVerseMatch(result.match)}
    />
  );

  // Simple grid for small datasets (no virtualization)
  if (!shouldVirtualize) {
    return (
      <div
        className={`relative z-0 pb-4 ${loading ? "opacity-50" : "opacity-100"}`}
      >
        <div className={VERSE_GRID_CLASSES}>
          {results.map(renderResultCard)}
        </div>
      </div>
    );
  }

  // Virtualized grid for large datasets
  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      className={`relative z-0 pb-4 ${loading ? "opacity-50" : "opacity-100"}`}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowResults = results.slice(
            startIndex,
            startIndex + columnCount,
          );

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: `${ROW_GAP}px`,
              }}
            >
              <div className={VERSE_GRID_CLASSES}>
                {rowResults.map(renderResultCard)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

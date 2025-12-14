/**
 * useAdjacentVerses - Custom hook to fetch previous and next verse data
 *
 * Fetches adjacent verses in parallel with the main verse for navigation preview.
 * Handles chapter boundaries (e.g., BG_2_1 prev = BG_1_47).
 * Falls back gracefully if fetch fails.
 *
 * Used by: VerseDetail for navigation preview
 */

import { useState, useEffect } from "react";
import { versesApi } from "../lib/api";
import { getChapterInfo, TOTAL_CHAPTERS } from "../constants/chapters";
import type { Verse } from "../types";

interface AdjacentVerses {
  /** Previous verse data, null if at start of Geeta or fetch failed */
  prevVerse: Verse | null;
  /** Next verse data, null if at end of Geeta or fetch failed */
  nextVerse: Verse | null;
  /** True while fetching adjacent verses */
  loading: boolean;
  /** Error message if fetch failed, null otherwise */
  error: string | null;
}

/**
 * Calculate the canonical ID for the previous verse
 * Handles chapter boundaries
 */
function getPrevCanonicalId(chapter: number, verse: number): string | null {
  if (verse > 1) {
    // Previous verse in same chapter
    return `BG_${chapter}_${verse - 1}`;
  } else if (chapter > 1) {
    // Last verse of previous chapter
    const prevChapterInfo = getChapterInfo(chapter - 1);
    if (prevChapterInfo) {
      return `BG_${chapter - 1}_${prevChapterInfo.verses}`;
    }
  }
  // At the very beginning of Geeta
  return null;
}

/**
 * Calculate the canonical ID for the next verse
 * Handles chapter boundaries
 */
function getNextCanonicalId(chapter: number, verse: number): string | null {
  const chapterInfo = getChapterInfo(chapter);
  if (!chapterInfo) return null;

  if (verse < chapterInfo.verses) {
    // Next verse in same chapter
    return `BG_${chapter}_${verse + 1}`;
  } else if (chapter < TOTAL_CHAPTERS) {
    // First verse of next chapter
    return `BG_${chapter + 1}_1`;
  }
  // At the very end of Geeta
  return null;
}

/**
 * Custom hook to fetch adjacent verses for navigation preview
 *
 * @param chapter - Current chapter number
 * @param verse - Current verse number
 * @returns Object with prevVerse, nextVerse, loading, and error
 */
export function useAdjacentVerses(
  chapter: number,
  verse: number
): AdjacentVerses {
  const [prevVerse, setPrevVerse] = useState<Verse | null>(null);
  const [nextVerse, setNextVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAdjacentVerses = async () => {
      setLoading(true);
      setError(null);

      const prevId = getPrevCanonicalId(chapter, verse);
      const nextId = getNextCanonicalId(chapter, verse);

      try {
        // Fetch both in parallel, with individual error handling
        const [prevData, nextData] = await Promise.all([
          prevId
            ? versesApi.get(prevId).catch(() => null)
            : Promise.resolve(null),
          nextId
            ? versesApi.get(nextId).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setPrevVerse(prevData);
          setNextVerse(nextData);
        }
      } catch {
        // This shouldn't happen due to individual catches, but just in case
        if (!cancelled) {
          setError("Failed to load adjacent verses");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAdjacentVerses();

    return () => {
      cancelled = true;
    };
  }, [chapter, verse]);

  return { prevVerse, nextVerse, loading, error };
}

// Export helper functions for testing and reuse
export { getPrevCanonicalId, getNextCanonicalId };

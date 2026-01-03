/**
 * useCrossChapterPreload - Preload audio across chapter boundaries
 *
 * Starts preloading the first verse of the next chapter when user is
 * within PRELOAD_THRESHOLD verses of the current chapter's end.
 *
 * This ensures seamless playback at chapter transitions by having
 * the next chapter's audio ready before the user reaches it.
 *
 * Features:
 * - Preloads next chapter's first verse during last N verses
 * - Respects Save-Data and slow connection preferences
 * - Only triggers once per chapter (no duplicate requests)
 * - Works with auto-advance mode
 */

import { useEffect, useRef } from "react";
import { versesApi } from "../lib/api";
import { getChapterInfo, TOTAL_CHAPTERS } from "../constants/chapters";
import { preloadAudio } from "../lib/audioPreload";

/** Number of verses from chapter end to start preloading next chapter */
const PRELOAD_THRESHOLD_VERSES = 2;

export interface CrossChapterPreloadConfig {
  /** Current chapter number */
  chapter: number;
  /** Current verse number */
  verse: number;
  /** Whether preloading is enabled (e.g., in auto-advance mode) */
  enabled?: boolean;
}

/**
 * Hook to preload audio across chapter boundaries.
 *
 * When the user is within PRELOAD_THRESHOLD_VERSES of the chapter end,
 * this hook fetches the first verse of the next chapter and preloads its audio.
 */
export function useCrossChapterPreload(config: CrossChapterPreloadConfig): void {
  const { chapter, verse, enabled = true } = config;

  // Track which chapter we've already preloaded to avoid duplicates
  const preloadedChapterRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Get current chapter info
    const chapterInfo = getChapterInfo(chapter);
    if (!chapterInfo) {
      return;
    }

    // Check if we're within threshold of chapter end
    const versesRemaining = chapterInfo.verses - verse;
    const shouldPreloadNextChapter =
      versesRemaining < PRELOAD_THRESHOLD_VERSES && chapter < TOTAL_CHAPTERS;

    if (!shouldPreloadNextChapter) {
      return;
    }

    const nextChapter = chapter + 1;

    // Already preloaded this chapter
    if (preloadedChapterRef.current === nextChapter) {
      return;
    }

    // Fetch first verse of next chapter and preload its audio
    const preloadNextChapter = async () => {
      try {
        const firstVerseId = `BG_${nextChapter}_1`;
        const verseData = await versesApi.get(firstVerseId);

        if (verseData.audio_url) {
          preloadAudio(verseData.audio_url);
          preloadedChapterRef.current = nextChapter;

          // Track analytics
          if (window.umami) {
            window.umami.track("cross_chapter_preload", {
              from_chapter: chapter,
              to_chapter: nextChapter,
            });
          }
        }
      } catch (error) {
        // Silently fail - this is just a preload optimization
        console.debug("[CrossChapterPreload] Failed to preload:", error);
      }
    };

    preloadNextChapter();
  }, [chapter, verse, enabled]);

  // Reset preloaded chapter when moving to a new chapter
  useEffect(() => {
    preloadedChapterRef.current = null;
  }, [chapter]);
}

export { PRELOAD_THRESHOLD_VERSES };

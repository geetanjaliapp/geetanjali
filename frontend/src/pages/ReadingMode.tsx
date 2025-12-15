/**
 * ReadingMode - Distraction-free sequential reading experience
 *
 * Features:
 * - Sanskrit-first display with tap-to-reveal translations
 * - Swipe navigation (mobile) + keyboard navigation (desktop)
 * - Chapter progress tracking
 * - Deep linking support via URL params (?c=2&v=47)
 *
 * Route: /read
 */

import { useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { versesApi } from "../lib/api";
import type { Verse } from "../types";
import { Navbar, VerseFocus } from "../components";
import { useSEO, useSwipeNavigation } from "../hooks";
import {
  getChapterName,
  getChapterVerseCount,
  getVerseProgress,
  TOTAL_CHAPTERS,
} from "../constants/chapters";
import { errorMessages } from "../lib/errorMessages";

/**
 * Reading mode state
 */
interface ReadingState {
  chapter: number;
  verseIndex: number; // 0-based index into chapterVerses array
  chapterVerses: Verse[];
  isLoading: boolean;
  error: string | null;
}

export default function ReadingMode() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse initial state from URL params
  const getInitialChapter = (): number => {
    const c = searchParams.get("c");
    if (c) {
      const chapter = parseInt(c, 10);
      if (chapter >= 1 && chapter <= TOTAL_CHAPTERS) {
        return chapter;
      }
    }
    return 1; // Default to chapter 1
  };

  const getInitialVerse = (): number => {
    const v = searchParams.get("v");
    if (v) {
      const verse = parseInt(v, 10);
      if (verse >= 1) {
        return verse;
      }
    }
    return 1; // Default to verse 1
  };

  const [state, setState] = useState<ReadingState>({
    chapter: getInitialChapter(),
    verseIndex: 0,
    chapterVerses: [],
    isLoading: true,
    error: null,
  });

  const [initialVerse] = useState(getInitialVerse);

  // Current verse from the chapter verses array
  const currentVerse =
    state.chapterVerses.length > 0
      ? state.chapterVerses[state.verseIndex]
      : null;

  // Progress calculation
  const progress = currentVerse
    ? getVerseProgress(state.chapter, currentVerse.verse)
    : { position: 0, total: 0, percentage: 0 };

  // SEO
  useSEO({
    title: currentVerse
      ? `${state.chapter}.${currentVerse.verse} — Reading Mode`
      : `Reading Mode — Chapter ${state.chapter}`,
    description: `Read the Bhagavad Geeta in a distraction-free environment. Currently reading Chapter ${state.chapter}: ${getChapterName(state.chapter)}.`,
    canonical: `/read${currentVerse ? `?c=${state.chapter}&v=${currentVerse.verse}` : ""}`,
  });

  // Load chapter verses (paginated - API limit is 50)
  const loadChapter = useCallback(async (chapter: number) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const allVerses: Verse[] = [];
      const pageSize = 50; // API max limit
      let skip = 0;
      let hasMore = true;

      // Paginate until we have all verses in the chapter
      while (hasMore) {
        const batch = await versesApi.list(
          skip,
          pageSize,
          chapter,
          undefined, // No featured filter
          undefined // No principles filter
        );
        allVerses.push(...batch);
        hasMore = batch.length === pageSize;
        skip += pageSize;
      }

      // Sort by verse number to ensure correct order
      allVerses.sort((a, b) => a.verse - b.verse);

      setState((prev) => ({
        ...prev,
        chapter,
        chapterVerses: allVerses,
        isLoading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessages.verseLoad(err),
      }));
    }
  }, []);

  // Load initial chapter
  useEffect(() => {
    loadChapter(state.chapter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Set initial verse index once chapter loads
  useEffect(() => {
    if (state.chapterVerses.length > 0 && initialVerse > 1) {
      const index = state.chapterVerses.findIndex(
        (v) => v.verse === initialVerse
      );
      if (index !== -1) {
        setState((prev) => ({ ...prev, verseIndex: index }));
      }
    }
  }, [state.chapterVerses, initialVerse]);

  // Update URL when verse changes
  useEffect(() => {
    if (currentVerse) {
      const newParams = new URLSearchParams();
      newParams.set("c", state.chapter.toString());
      newParams.set("v", currentVerse.verse.toString());
      setSearchParams(newParams, { replace: true });
    }
  }, [state.chapter, currentVerse, setSearchParams]);

  // Navigation functions
  const nextVerse = useCallback(() => {
    setState((prev) => {
      // If not at end of chapter, go to next verse
      if (prev.verseIndex < prev.chapterVerses.length - 1) {
        return { ...prev, verseIndex: prev.verseIndex + 1 };
      }
      // At end of chapter - could navigate to next chapter (handled later)
      return prev;
    });
  }, []);

  const prevVerse = useCallback(() => {
    setState((prev) => {
      // If not at start of chapter, go to previous verse
      if (prev.verseIndex > 0) {
        return { ...prev, verseIndex: prev.verseIndex - 1 };
      }
      // At start of chapter - could navigate to previous chapter (handled later)
      return prev;
    });
  }, []);

  // Check navigation boundaries
  const canGoPrev = state.verseIndex > 0 || state.chapter > 1;
  const canGoNext =
    state.verseIndex < state.chapterVerses.length - 1 ||
    state.chapter < TOTAL_CHAPTERS;

  // Swipe navigation for mobile
  const swipeRef = useSwipeNavigation<HTMLElement>({
    onNext: canGoNext ? nextVerse : undefined,
    onPrev: canGoPrev ? prevVerse : undefined,
    enabled: !state.isLoading && !!currentVerse,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
      <Navbar />

      {/* Chapter Header */}
      <header className="sticky top-14 sm:top-16 z-10 bg-amber-50/95 backdrop-blur-sm border-b border-amber-200/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Chapter info */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-amber-700 font-medium">
              Chapter {state.chapter}
              <span className="mx-2 text-amber-300">·</span>
              <span className="text-amber-600/80">
                {getChapterName(state.chapter)}
              </span>
            </div>
            {currentVerse && (
              <div className="text-sm text-amber-600">
                Verse {currentVerse.verse} of {getChapterVerseCount(state.chapter)}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div
            className="h-1 bg-amber-200/50 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Chapter progress: ${progress.percentage}%`}
          >
            <div
              className="h-full bg-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area - swipeable on mobile */}
      <main
        ref={swipeRef}
        className="flex-1 flex flex-col items-center justify-center px-4 py-8 touch-pan-y"
      >
        {state.isLoading ? (
          // Loading state
          <div className="text-center">
            <div className="text-4xl text-amber-300/60 mb-4 animate-pulse">ॐ</div>
            <p className="text-amber-600/70">Loading chapter...</p>
          </div>
        ) : state.error ? (
          // Error state
          <div className="text-center max-w-md">
            <div className="text-4xl text-red-300/60 mb-4">⚠</div>
            <p className="text-red-600 mb-4">{state.error}</p>
            <button
              onClick={() => loadChapter(state.chapter)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : currentVerse ? (
          // Verse display with tap-to-reveal translations
          <VerseFocus verse={currentVerse} />
        ) : (
          // No verses loaded
          <div className="text-center">
            <div className="text-4xl text-amber-300/60 mb-4">ॐ</div>
            <p className="text-amber-600/70">No verses found in this chapter</p>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar (placeholder - will be a separate component) */}
      <nav
        className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-amber-200 shadow-lg"
        aria-label="Verse navigation"
      >
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Previous button */}
            <button
              onClick={prevVerse}
              disabled={!canGoPrev}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canGoPrev
                  ? "text-amber-700 hover:bg-amber-50 active:bg-amber-100"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Previous verse"
            >
              <span className="text-lg">←</span>
              <span className="text-sm font-medium">Prev</span>
            </button>

            {/* Chapter selector button (placeholder) */}
            <button
              className="flex items-center gap-2 px-4 py-2 text-amber-700 hover:bg-amber-50 active:bg-amber-100 rounded-lg transition-colors"
              aria-label="Select chapter"
            >
              <span className="text-sm font-medium">
                {currentVerse
                  ? `${state.chapter}.${currentVerse.verse}`
                  : `Ch ${state.chapter}`}
              </span>
            </button>

            {/* Next button */}
            <button
              onClick={nextVerse}
              disabled={!canGoNext}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canGoNext
                  ? "text-amber-700 hover:bg-amber-50 active:bg-amber-100"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Next verse"
            >
              <span className="text-sm font-medium">Next</span>
              <span className="text-lg">→</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}

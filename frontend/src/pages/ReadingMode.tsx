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
import { useEffect, useState, useCallback, useRef } from "react";
import { versesApi, readingApi } from "../lib/api";
import type { Verse, BookMetadata, ChapterMetadata } from "../types";
import { Navbar, VerseFocus, ProgressBar, ChapterSelector, IntroCard } from "../components";
import { useSEO, useSwipeNavigation } from "../hooks";
import {
  getChapterName,
  getChapterVerseCount,
  getVerseProgress,
  TOTAL_CHAPTERS,
} from "../constants/chapters";
import { errorMessages } from "../lib/errorMessages";

// localStorage keys
const READING_POSITION_KEY = "geetanjali:readingPosition";
const READING_SETTINGS_KEY = "geetanjali:readingSettings";
const ONBOARDING_SEEN_KEY = "geetanjali:readingOnboardingSeen";

// Special page indices for intro cards
// -2 = book cover, -1 = chapter intro, >= 0 = verse index
const PAGE_BOOK_COVER = -2;
const PAGE_CHAPTER_INTRO = -1;

interface ReadingPosition {
  chapter: number;
  verse: number;
  timestamp: number;
}

/** Font size options */
type FontSize = "small" | "medium" | "large";

interface ReadingSettings {
  fontSize: FontSize;
}

const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: "medium",
};

/**
 * Get saved settings from localStorage
 */
function getSavedSettings(): ReadingSettings {
  try {
    const saved = localStorage.getItem(READING_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: ReadingSettings): void {
  try {
    localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get saved reading position from localStorage
 */
function getSavedPosition(): ReadingPosition | null {
  try {
    const saved = localStorage.getItem(READING_POSITION_KEY);
    if (saved) {
      return JSON.parse(saved) as ReadingPosition;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

/**
 * Save reading position to localStorage
 */
function savePosition(chapter: number, verse: number): void {
  try {
    const position: ReadingPosition = {
      chapter,
      verse,
      timestamp: Date.now(),
    };
    localStorage.setItem(READING_POSITION_KEY, JSON.stringify(position));
  } catch {
    // Ignore localStorage errors (quota exceeded, private browsing, etc.)
  }
}

/**
 * Reading mode state
 */
interface ReadingState {
  chapter: number;
  pageIndex: number; // -2 = book cover, -1 = chapter intro, >= 0 = verse index
  chapterVerses: Verse[];
  isLoading: boolean;
  error: string | null;
}

export default function ReadingMode() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Check URL params and saved position on mount
  const urlChapter = searchParams.get("c");
  const urlVerse = searchParams.get("v");
  const savedPosition = getSavedPosition();

  // Determine initial state based on URL and saved position
  const getInitialState = (): { chapter: number; verse: number; hasPosition: boolean } => {
    // URL params take priority (deep link)
    if (urlChapter) {
      const chapter = parseInt(urlChapter, 10);
      if (chapter >= 1 && chapter <= TOTAL_CHAPTERS) {
        const verse = urlVerse ? parseInt(urlVerse, 10) : 1;
        return { chapter, verse: verse >= 1 ? verse : 1, hasPosition: true };
      }
    }
    // Fall back to saved position
    if (savedPosition && savedPosition.chapter >= 1 && savedPosition.chapter <= TOTAL_CHAPTERS) {
      return {
        chapter: savedPosition.chapter,
        verse: savedPosition.verse >= 1 ? savedPosition.verse : 1,
        hasPosition: true,
      };
    }
    // Fresh start - no position
    return { chapter: 1, verse: 1, hasPosition: false };
  };

  const initial = getInitialState();

  const [state, setState] = useState<ReadingState>({
    chapter: initial.chapter,
    // Fresh start → book cover, has position → chapter intro (then resume verse)
    pageIndex: initial.hasPosition ? PAGE_CHAPTER_INTRO : PAGE_BOOK_COVER,
    chapterVerses: [],
    isLoading: true,
    error: null,
  });

  // Target verse to navigate to after chapter intro (for resume/deep-link)
  const [targetVerse, setTargetVerse] = useState<number | null>(
    initial.hasPosition ? initial.verse : null
  );

  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [settings, setSettings] = useState<ReadingSettings>(getSavedSettings);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_SEEN_KEY);
    } catch {
      return false;
    }
  });

  // Book and chapter metadata for intro cards
  const [bookMetadata, setBookMetadata] = useState<BookMetadata | null>(null);
  const [chapterMetadata, setChapterMetadata] = useState<ChapterMetadata | null>(null);

  // Dismiss onboarding and remember
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    } catch {
      // Ignore
    }
  }, []);

  // Cycle font size: small → medium → large → small
  const cycleFontSize = useCallback(() => {
    const sizes: FontSize[] = ["small", "medium", "large"];
    const currentIndex = sizes.indexOf(settings.fontSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    const newSettings = { ...settings, fontSize: sizes[nextIndex] };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings]);

  // Chapter prefetch cache (prevents duplicate fetches)
  const prefetchCache = useRef<Map<number, Verse[]>>(new Map());
  const prefetchingRef = useRef<Set<number>>(new Set());

  // Current verse from the chapter verses array (only when pageIndex >= 0)
  const currentVerse =
    state.pageIndex >= 0 && state.chapterVerses.length > 0
      ? state.chapterVerses[state.pageIndex]
      : null;

  // Determine what type of page we're showing
  const isBookCover = state.pageIndex === PAGE_BOOK_COVER;
  const isChapterIntro = state.pageIndex === PAGE_CHAPTER_INTRO;
  const isVerse = state.pageIndex >= 0;

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
  // Uses prefetch cache when available for instant loading
  const loadChapter = useCallback(async (chapter: number) => {
    // Check prefetch cache first
    const cached = prefetchCache.current.get(chapter);
    if (cached) {
      setState((prev) => ({
        ...prev,
        chapter,
        chapterVerses: cached,
        isLoading: false,
        error: null,
      }));
      return;
    }

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

      // Cache for future use
      prefetchCache.current.set(chapter, allVerses);

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

  // Reset reading progress - clear saved position and start over
  const resetProgress = useCallback(() => {
    try {
      localStorage.removeItem(READING_POSITION_KEY);
    } catch {
      // Ignore
    }
    // Clear URL params
    setSearchParams({}, { replace: true });
    // Reset to book cover, chapter 1
    setState((prev) => ({
      ...prev,
      chapter: 1,
      pageIndex: PAGE_BOOK_COVER,
      chapterVerses: [],
    }));
    setTargetVerse(null);
    loadChapter(1);
  }, [setSearchParams, loadChapter]);

  // Prefetch a chapter silently (no state updates, just cache)
  const prefetchChapter = useCallback(async (chapter: number) => {
    // Skip if already cached or currently fetching
    if (
      prefetchCache.current.has(chapter) ||
      prefetchingRef.current.has(chapter) ||
      chapter < 1 ||
      chapter > TOTAL_CHAPTERS
    ) {
      return;
    }

    prefetchingRef.current.add(chapter);

    try {
      const allVerses: Verse[] = [];
      const pageSize = 50;
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await versesApi.list(skip, pageSize, chapter, undefined, undefined);
        allVerses.push(...batch);
        hasMore = batch.length === pageSize;
        skip += pageSize;
      }

      allVerses.sort((a, b) => a.verse - b.verse);
      prefetchCache.current.set(chapter, allVerses);
    } catch {
      // Silently fail - prefetch is optional optimization
    } finally {
      prefetchingRef.current.delete(chapter);
    }
  }, []);

  // Load initial chapter
  useEffect(() => {
    loadChapter(state.chapter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL on mount if resuming from saved position (no URL params)
  useEffect(() => {
    if (!urlChapter && !urlVerse && initial.hasPosition) {
      const newParams = new URLSearchParams();
      newParams.set("c", initial.chapter.toString());
      newParams.set("v", initial.verse.toString());
      setSearchParams(newParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch book metadata on mount (for cover page)
  useEffect(() => {
    readingApi.getBookMetadata()
      .then(setBookMetadata)
      .catch(() => {
        // If book metadata fails, skip to chapter intro
        if (state.pageIndex === PAGE_BOOK_COVER) {
          setState((prev) => ({ ...prev, pageIndex: PAGE_CHAPTER_INTRO }));
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch chapter metadata when chapter changes
  useEffect(() => {
    readingApi.getChapter(state.chapter)
      .then(setChapterMetadata)
      .catch(() => {
        // Silently fail - will use fallback in UI
        setChapterMetadata(null);
      });
  }, [state.chapter]);

  // Prefetch adjacent chapters when near boundaries (80%/20%)
  useEffect(() => {
    if (state.chapterVerses.length === 0 || state.pageIndex < 0) return;

    const progressInChapter = (state.pageIndex + 1) / state.chapterVerses.length;

    // Near end (80%+) - prefetch next chapter
    if (progressInChapter >= 0.8 && state.chapter < TOTAL_CHAPTERS) {
      prefetchChapter(state.chapter + 1);
    }

    // Near start (20%-) - prefetch previous chapter
    if (progressInChapter <= 0.2 && state.chapter > 1) {
      prefetchChapter(state.chapter - 1);
    }
  }, [state.pageIndex, state.chapterVerses.length, state.chapter, prefetchChapter]);

  // Handle "start at end" case when navigating to previous chapter
  // pageIndex of -3 signals "start at last verse of chapter"
  useEffect(() => {
    if (state.chapterVerses.length > 0 && state.pageIndex === -3) {
      setState((prev) => ({
        ...prev,
        pageIndex: prev.chapterVerses.length - 1,
      }));
    }
  }, [state.chapterVerses, state.pageIndex]);

  // Update URL and save position when verse changes
  useEffect(() => {
    if (currentVerse) {
      // Update URL for deep linking
      const newParams = new URLSearchParams();
      newParams.set("c", state.chapter.toString());
      newParams.set("v", currentVerse.verse.toString());
      setSearchParams(newParams, { replace: true });

      // Save position to localStorage for "continue reading"
      savePosition(state.chapter, currentVerse.verse);
    }
  }, [state.chapter, currentVerse, setSearchParams]);

  // Navigate to a different chapter
  // startAtEnd: if true, start at the last verse (for prev navigation)
  const goToChapter = useCallback(
    (chapter: number, startAtEnd = false) => {
      if (chapter >= 1 && chapter <= TOTAL_CHAPTERS && chapter !== state.chapter) {
        setState((prev) => ({
          ...prev,
          chapter,
          // -3 signals "start at end", -1 is chapter intro
          pageIndex: startAtEnd ? -3 : PAGE_CHAPTER_INTRO,
          chapterVerses: [],
        }));
        loadChapter(chapter);
      }
    },
    [loadChapter, state.chapter]
  );

  // Ref to hold goToChapter for stable reference in navigation callbacks
  const goToChapterRef = useRef(goToChapter);
  goToChapterRef.current = goToChapter;

  // Navigation functions - use refs to avoid stale closures
  const nextPage = useCallback(() => {
    setState((prev) => {
      // Book cover → chapter intro
      if (prev.pageIndex === PAGE_BOOK_COVER) {
        return { ...prev, pageIndex: PAGE_CHAPTER_INTRO };
      }
      // Chapter intro → target verse (resume) or first verse
      if (prev.pageIndex === PAGE_CHAPTER_INTRO) {
        if (targetVerse && prev.chapterVerses.length > 0) {
          const index = prev.chapterVerses.findIndex((v) => v.verse === targetVerse);
          if (index !== -1) {
            // Clear target verse after using it
            setTargetVerse(null);
            return { ...prev, pageIndex: index };
          }
        }
        return { ...prev, pageIndex: 0 };
      }
      // If not at end of chapter, go to next verse
      if (prev.pageIndex < prev.chapterVerses.length - 1) {
        return { ...prev, pageIndex: prev.pageIndex + 1 };
      }
      // At end of chapter - advance to next chapter (will show chapter intro)
      if (prev.chapter < TOTAL_CHAPTERS) {
        setTimeout(() => goToChapterRef.current(prev.chapter + 1), 0);
      }
      return prev;
    });
  }, [targetVerse]);

  const prevPage = useCallback(() => {
    setState((prev) => {
      // First verse → chapter intro
      if (prev.pageIndex === 0) {
        return { ...prev, pageIndex: PAGE_CHAPTER_INTRO };
      }
      // Chapter intro → book cover (only for chapter 1)
      if (prev.pageIndex === PAGE_CHAPTER_INTRO && prev.chapter === 1) {
        return { ...prev, pageIndex: PAGE_BOOK_COVER };
      }
      // Chapter intro → go to previous chapter (at end)
      if (prev.pageIndex === PAGE_CHAPTER_INTRO && prev.chapter > 1) {
        setTimeout(() => goToChapterRef.current(prev.chapter - 1, true), 0);
        return prev;
      }
      // If not at start of chapter, go to previous verse
      if (prev.pageIndex > 0) {
        return { ...prev, pageIndex: prev.pageIndex - 1 };
      }
      return prev;
    });
  }, []);

  // Check navigation boundaries
  // Can go prev: not at book cover
  const canGoPrev = state.pageIndex > PAGE_BOOK_COVER;
  // Can go next: not at last verse of last chapter
  const canGoNext =
    state.pageIndex < 0 || // on intro pages
    state.pageIndex < state.chapterVerses.length - 1 ||
    state.chapter < TOTAL_CHAPTERS;

  // Swipe navigation for mobile
  const swipeRef = useSwipeNavigation<HTMLElement>({
    onNext: canGoNext ? nextPage : undefined,
    onPrev: canGoPrev ? prevPage : undefined,
    enabled: !state.isLoading,
  });

  // Keyboard navigation for desktop
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Arrow keys and J/K for navigation
      if ((event.key === "ArrowLeft" || event.key === "k" || event.key === "K") && canGoPrev) {
        event.preventDefault();
        prevPage();
      } else if ((event.key === "ArrowRight" || event.key === "j" || event.key === "J") && canGoNext) {
        event.preventDefault();
        nextPage();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canGoPrev, canGoNext, prevPage, nextPage]);

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
            <div className="flex items-center gap-2">
              {/* Font size toggle - Aa + filled circles */}
              <button
                onClick={cycleFontSize}
                className="flex items-center gap-1.5 px-2 py-1 text-amber-600 hover:bg-amber-100 active:bg-amber-200 rounded transition-colors"
                aria-label={`Font size: ${settings.fontSize}. Tap to change.`}
                title={`Font size: ${settings.fontSize}`}
              >
                <span className="text-sm font-serif">Aa</span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className={`w-1.5 h-1.5 rounded-full ${settings.fontSize !== "small" ? "bg-amber-500" : "bg-amber-200"}`} />
                  <span className={`w-1.5 h-1.5 rounded-full ${settings.fontSize === "large" ? "bg-amber-500" : "bg-amber-200"}`} />
                </span>
              </button>
              {/* Reset progress button */}
              <button
                onClick={resetProgress}
                className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-100 active:bg-amber-200 rounded transition-colors"
                aria-label="Start over from beginning"
                title="Start over"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              {/* Verse counter */}
              {currentVerse && (
                <div className="text-sm text-amber-600 ml-1">
                  {currentVerse.verse}/{getChapterVerseCount(state.chapter)}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar
            percentage={progress.percentage}
            height={4}
            ariaLabel={`Chapter ${state.chapter} progress: ${progress.percentage}%`}
          />
        </div>
      </header>

      {/* Main Content Area - swipeable on mobile */}
      {/* Note: justify-start (not center) to prevent layout shift when translation expands */}
      <main
        ref={swipeRef}
        className="flex-1 flex flex-col items-center justify-start px-4 pt-8 sm:pt-12 pb-8 touch-pan-y overflow-y-auto"
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
        ) : isBookCover && bookMetadata ? (
          // Book cover page
          <IntroCard key="book-cover" type="book" book={bookMetadata} fontSize={settings.fontSize} />
        ) : isChapterIntro && chapterMetadata ? (
          // Chapter intro page
          <IntroCard key={`chapter-${state.chapter}-intro`} type="chapter" chapter={chapterMetadata} fontSize={settings.fontSize} />
        ) : currentVerse ? (
          // Verse display with tap-to-reveal translations
          <VerseFocus key={currentVerse.canonical_id} verse={currentVerse} fontSize={settings.fontSize} />
        ) : (
          // Fallback: No content available
          <div className="text-center">
            <div className="text-4xl text-amber-300/60 mb-4">ॐ</div>
            <p className="text-amber-600/70">Loading...</p>
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
              onClick={prevPage}
              disabled={!canGoPrev}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canGoPrev
                  ? "text-amber-700 hover:bg-amber-50 active:bg-amber-100"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Previous"
            >
              <span className="text-lg">←</span>
              <span className="text-sm font-medium">Prev</span>
            </button>

            {/* Chapter selector button */}
            <button
              onClick={() => setShowChapterSelector(true)}
              className="flex items-center gap-2 px-4 py-2 text-amber-700 hover:bg-amber-50 active:bg-amber-100 rounded-lg transition-colors"
              aria-label="Select chapter"
            >
              <span className="text-sm font-medium">
                {currentVerse
                  ? `${state.chapter}.${currentVerse.verse}`
                  : `Ch ${state.chapter}`}
              </span>
              {/* Dropdown indicator */}
              <svg
                className="w-4 h-4 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Next button */}
            <button
              onClick={nextPage}
              disabled={!canGoNext}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canGoNext
                  ? "text-amber-700 hover:bg-amber-50 active:bg-amber-100"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Next"
            >
              <span className="text-sm font-medium">Next</span>
              <span className="text-lg">→</span>
            </button>

          </div>
        </div>
      </nav>

      {/* Chapter Selector Overlay */}
      <ChapterSelector
        currentChapter={state.chapter}
        onSelect={goToChapter}
        onClose={() => setShowChapterSelector(false)}
        isOpen={showChapterSelector}
      />

      {/* Onboarding Overlay - First-time users */}
      {showOnboarding && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={dismissOnboarding}
            aria-hidden="true"
          />

          {/* Onboarding Card */}
          <div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto
                       bg-white rounded-2xl shadow-2xl p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="Reading Mode tips"
          >
            <h2 className="text-lg font-semibold text-amber-900 text-center mb-4">
              Welcome to Reading Mode
            </h2>

            <div className="space-y-4 text-sm text-gray-700">
              {/* Tap hint */}
              <div className="flex items-start gap-3">
                <span className="text-xl">👆</span>
                <div>
                  <p className="font-medium text-gray-900">Tap for translation</p>
                  <p className="text-gray-500">Tap the verse to reveal Hindi, English & IAST</p>
                </div>
              </div>

              {/* Swipe hint */}
              <div className="flex items-start gap-3">
                <span className="text-xl">👈👉</span>
                <div>
                  <p className="font-medium text-gray-900">Swipe to navigate</p>
                  <p className="text-gray-500">Swipe left/right to move between verses</p>
                </div>
              </div>

              {/* Keyboard hint - desktop only */}
              <div className="hidden sm:flex items-start gap-3">
                <span className="text-xl">⌨️</span>
                <div>
                  <p className="font-medium text-gray-900">Keyboard shortcuts</p>
                  <p className="text-gray-500">← → or J/K to navigate, Space for translation</p>
                </div>
              </div>
            </div>

            <button
              onClick={dismissOnboarding}
              className="w-full mt-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
            >
              Got it!
            </button>
          </div>
        </>
      )}

    </div>
  );
}

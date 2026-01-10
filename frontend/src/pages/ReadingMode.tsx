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

import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { versesApi, readingApi } from "../lib/api";
import type { Verse, BookMetadata, ChapterMetadata, FontSize } from "../types";
import {
  Navbar,
  VerseFocus,
  ProgressBar,
  ChapterSelector,
  IntroCard,
  Toast,
} from "../components";
// Direct imports to avoid Rollup circular chunk dependencies
import { MiniPlayer } from "../components/audio/MiniPlayer/index";
import { useAudioPlayer } from "../components/audio/AudioPlayerContext";
import { useAutoAdvance } from "../hooks/useAutoAdvance";
import { useStudyAutoMode } from "../hooks/useStudyAutoMode";
import {
  useSEO,
  useSwipeNavigation,
  usePreferences,
  useCrossChapterPreload,
} from "../hooks";
import {
  getChapterName,
  getChapterVerseCount,
  getVerseProgress,
  TOTAL_CHAPTERS,
} from "../constants/chapters";
import { errorMessages } from "../lib/errorMessages";
import {
  setStorageItemRaw,
  STORAGE_KEYS,
  SESSION_KEYS,
  getStorageItem,
  setStorageItem,
} from "../lib/storage";

// Storage key for continuous playback preference
const CONTINUOUS_PLAYBACK_KEY = "geetanjali_continuous_playback";

// Show toast after reading this many verses
const TOAST_THRESHOLD = 5;
// Rate limit: once per week (7 days in ms)
const TOAST_RATE_LIMIT = 7 * 24 * 60 * 60 * 1000;

// Special page indices for intro cards
// -2 = book cover, -1 = chapter intro, >= 0 = verse index
const PAGE_BOOK_COVER = -2;
const PAGE_CHAPTER_INTRO = -1;

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

  // Cross-device sync for reading position and settings
  // Destructure stable callbacks to avoid infinite loops in useEffect dependencies
  const {
    reading: { position: savedPosition, settings },
    saveReadingPosition: savePosition,
    setFontSize,
    resetReadingProgress: resetSyncedProgress,
  } = usePreferences();

  // Check URL params and saved position on mount
  const urlChapter = searchParams.get("c");
  const urlVerse = searchParams.get("v");

  // Determine initial state based on URL and saved position
  const getInitialState = (): {
    chapter: number;
    verse: number;
    hasPosition: boolean;
  } => {
    // URL params take priority (deep link)
    if (urlChapter) {
      const chapter = parseInt(urlChapter, 10);
      if (chapter >= 1 && chapter <= TOTAL_CHAPTERS) {
        const verse = urlVerse ? parseInt(urlVerse, 10) : 1;
        return { chapter, verse: verse >= 1 ? verse : 1, hasPosition: true };
      }
    }
    // Fall back to saved position
    if (
      savedPosition &&
      savedPosition.chapter >= 1 &&
      savedPosition.chapter <= TOTAL_CHAPTERS
    ) {
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
    initial.hasPosition ? initial.verse : null,
  );

  const [showChapterSelector, setShowChapterSelector] = useState(false);
  // settings is now destructured from usePreferences above
  // Onboarding starts hidden, then shows after 3-second delay for first-time users
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNewsletterToast, setShowNewsletterToast] = useState(false);

  // Continuous playback: auto-advance to next chapter when current chapter ends
  const [continuousPlayback, setContinuousPlayback] = useState(() =>
    getStorageItem<boolean>(CONTINUOUS_PLAYBACK_KEY, false)
  );

  // Ref for continuous playback (avoids stale closures in callbacks)
  const continuousPlaybackRef = useRef(continuousPlayback);
  continuousPlaybackRef.current = continuousPlayback;

  // Toggle continuous playback and persist
  const toggleContinuousPlayback = useCallback(() => {
    setContinuousPlayback((prev) => {
      const newValue = !prev;
      setStorageItem(CONTINUOUS_PLAYBACK_KEY, newValue);
      // Track analytics
      if (window.umami) {
        window.umami.track("continuous_playback_toggle", { enabled: newValue });
      }
      return newValue;
    });
  }, []);

  // Audio player for keyboard pause/resume control
  const audioPlayer = useAudioPlayer();

  // Show onboarding after 3-second delay to let users see the UI first
  useEffect(() => {
    try {
      // Skip if user has already seen onboarding
      if (localStorage.getItem(STORAGE_KEYS.readingOnboardingSeen)) return;
    } catch {
      return;
    }

    const timer = setTimeout(() => {
      setShowOnboarding(true);
    }, 3000); // 3-second delay

    return () => clearTimeout(timer);
  }, []);

  // Book and chapter metadata for intro cards
  const [bookMetadata, setBookMetadata] = useState<BookMetadata | null>(null);
  const [chapterMetadata, setChapterMetadata] =
    useState<ChapterMetadata | null>(null);
  // Navigation for Dhyanam page
  const navigate = useNavigate();

  // Translation visibility - persists within chapter, resets on chapter change
  const [showTranslation, setShowTranslation] = useState(false);
  const toggleTranslation = useCallback(
    () => setShowTranslation((prev) => !prev),
    [],
  );

  // Slide animation direction for verse transitions
  // 'from-left' = sliding in from left (going to prev), 'from-right' = sliding in from right (going to next)
  const [slideDirection, setSlideDirection] = useState<
    "from-left" | "from-right" | null
  >(null);

  // Clear slide animation after it completes
  useEffect(() => {
    if (slideDirection) {
      const timer = setTimeout(() => setSlideDirection(null), 200);
      return () => clearTimeout(timer);
    }
  }, [slideDirection]);

  // Dismiss onboarding and remember
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setStorageItemRaw(STORAGE_KEYS.readingOnboardingSeen, "1");
  }, []);

  // Track unique verses read and show newsletter toast
  useEffect(() => {
    // Only count actual verses (not intro pages)
    if (state.pageIndex < 0 || state.chapterVerses.length === 0) return;

    const verse = state.chapterVerses[state.pageIndex];
    if (!verse?.canonical_id) return;

    try {
      // Skip if already subscribed
      if (localStorage.getItem(STORAGE_KEYS.newsletterSubscribed) === "true")
        return;

      // Skip if toast shown within rate limit
      const lastShown = localStorage.getItem(STORAGE_KEYS.newsletterToastShown);
      if (
        lastShown &&
        Date.now() - parseInt(lastShown, 10) < TOAST_RATE_LIMIT
      ) {
        return;
      }

      // Track unique verses read (prevents double-counting when navigating back)
      const seenJson =
        sessionStorage.getItem(SESSION_KEYS.readingVersesRead) || "[]";
      const seenVerses: string[] = JSON.parse(seenJson);

      // Skip if already seen this verse
      if (seenVerses.includes(verse.canonical_id)) return;

      // Add to seen list
      seenVerses.push(verse.canonical_id);
      sessionStorage.setItem(
        SESSION_KEYS.readingVersesRead,
        JSON.stringify(seenVerses),
      );

      // Show toast after threshold unique verses
      if (seenVerses.length === TOAST_THRESHOLD) {
        setShowNewsletterToast(true);
        setStorageItemRaw(
          STORAGE_KEYS.newsletterToastShown,
          Date.now().toString(),
        );
      }
    } catch {
      // Ignore storage errors
    }
  }, [state.pageIndex, state.chapterVerses]);

  // Dismiss newsletter toast
  const dismissNewsletterToast = useCallback(() => {
    setShowNewsletterToast(false);
  }, []);

  // Cycle font size: small → regular → large → small
  const cycleFontSize = useCallback(() => {
    const sizes: FontSize[] = ["small", "regular", "large"];
    const currentIndex = sizes.indexOf(settings.fontSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setFontSize(sizes[nextIndex]);
  }, [settings.fontSize, setFontSize]);

  // Chapter prefetch cache (prevents duplicate fetches)
  const prefetchCache = useRef<Map<number, Verse[]>>(new Map());
  const prefetchingRef = useRef<Set<number>>(new Set());

  // Current verse from the chapter verses array (only when pageIndex >= 0)
  const currentVerse =
    state.pageIndex >= 0 && state.chapterVerses.length > 0
      ? state.chapterVerses[state.pageIndex]
      : null;

  // Next verse for preloading
  const nextVerse =
    state.pageIndex >= 0 && state.pageIndex < state.chapterVerses.length - 1
      ? state.chapterVerses[state.pageIndex + 1]
      : null;

  // Auto-advance hook for Listen/Read modes (Phase 3.7)
  const autoAdvance = useAutoAdvance({
    currentIndex: state.pageIndex,
    totalCount: state.chapterVerses.length,
    audioUrl: currentVerse?.audio_url,
    durationMs: currentVerse?.duration_ms,
    audioId: currentVerse?.canonical_id || "",
    nextAudioUrl: nextVerse?.audio_url,
    onAdvance: (nextIndex: number) => {
      // Hide translation and advance to next verse
      setShowTranslation(false);
      setSlideDirection("from-right");
      setState((prev) => ({ ...prev, pageIndex: nextIndex }));
    },
    onComplete: () => {
      // End of chapter reached
      // Check if continuous playback is enabled and there's a next chapter
      if (continuousPlaybackRef.current && state.chapter < TOTAL_CHAPTERS) {
        // Navigate to next chapter (goToChapter is defined later, accessed via ref)
        setTimeout(() => {
          if (goToChapterRef.current) {
            goToChapterRef.current(state.chapter + 1, false);
            // Auto-start audio mode after chapter loads
            setTimeout(() => {
              autoAdvance.startAudioMode();
            }, 1000); // Wait for chapter to load
          }
        }, 500);
      } else {
        // Stop auto-advance - user stays on last verse
        autoAdvance.stop();
      }
    },
  });

  // Cross-chapter audio preloading (Phase 1.19.0)
  // Preloads first verse of next chapter when near end of current chapter
  useCrossChapterPreload({
    chapter: state.chapter,
    verse: currentVerse?.verse ?? 1,
    enabled: autoAdvance.mode === "audio",
  });

  // Study Auto Mode hook (v1.25.0)
  // Orchestrates Sanskrit audio + TTS translations + auto-advance
  // With wrapping commentaries: chapter intro, verse announcements, chapter complete
  const studyAutoMode = useStudyAutoMode({
    verses: state.chapterVerses,
    currentIndex: state.pageIndex >= 0 ? state.pageIndex : 0,
    chapterMetadata, // For intro/outro narration
    onNavigate: (nextIndex: number) => {
      // Hide translation and advance to next verse
      setShowTranslation(false);
      setSlideDirection("from-right");
      setState((prev) => ({ ...prev, pageIndex: nextIndex }));
    },
    onChapterEnd: () => {
      // End of chapter reached - study mode stops automatically
      // Could add chapter end UI here in the future
    },
    onStop: () => {
      // Study mode stopped - no additional action needed
    },
  });

  // Determine what type of page we're showing
  const isBookCover = state.pageIndex === PAGE_BOOK_COVER;
  const isChapterIntro = state.pageIndex === PAGE_CHAPTER_INTRO;

  // Progress calculation
  const progress = currentVerse
    ? getVerseProgress(state.chapter, currentVerse.verse)
    : { position: 0, total: 0, percentage: 0 };

  // Memoize versePosition to prevent unnecessary MiniPlayer re-renders
  const versePosition = useMemo(
    () => ({
      current: Math.max(1, state.pageIndex + 1), // Ensure positive (1-indexed)
      total: state.chapterVerses.length,
    }),
    [state.pageIndex, state.chapterVerses.length],
  );

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
          undefined, // No principles filter
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

  // Reset reading progress - clear saved position, settings, and start over
  const resetProgress = useCallback(() => {
    // Reset via synced hook (clears localStorage and syncs to server if logged in)
    resetSyncedProgress();
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
  }, [setSearchParams, loadChapter, resetSyncedProgress]);

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
        const batch = await versesApi.list(
          skip,
          pageSize,
          chapter,
          undefined,
          undefined,
        );
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- runs once on mount to load initial chapter

  // Update URL on mount if resuming from saved position (no URL params)
  useEffect(() => {
    if (!urlChapter && !urlVerse && initial.hasPosition) {
      const newParams = new URLSearchParams();
      newParams.set("c", initial.chapter.toString());
      newParams.set("v", initial.verse.toString());
      setSearchParams(newParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- runs once on mount with initial values

  // Fetch book metadata on mount (for cover page)
  useEffect(() => {
    readingApi
      .getBookMetadata()
      .then(setBookMetadata)
      .catch(() => {
        // If book metadata fails, skip to chapter intro
        if (state.pageIndex === PAGE_BOOK_COVER) {
          setState((prev) => ({ ...prev, pageIndex: PAGE_CHAPTER_INTRO }));
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- runs once on mount to fetch metadata

  // Fetch chapter metadata when chapter changes
  useEffect(() => {
    // Clear stale metadata first to show loading state
    setChapterMetadata(null);
    readingApi
      .getChapter(state.chapter)
      .then(setChapterMetadata)
      .catch(() => {
        // Silently fail - will use fallback in UI
        setChapterMetadata(null);
      });
  }, [state.chapter]);

  // Prefetch adjacent chapters when near boundaries (80%/20%)
  useEffect(() => {
    if (state.chapterVerses.length === 0 || state.pageIndex < 0) return;

    const progressInChapter =
      (state.pageIndex + 1) / state.chapterVerses.length;

    // Near end (80%+) - prefetch next chapter
    if (progressInChapter >= 0.8 && state.chapter < TOTAL_CHAPTERS) {
      prefetchChapter(state.chapter + 1);
    }

    // Near start (20%-) - prefetch previous chapter
    if (progressInChapter <= 0.2 && state.chapter > 1) {
      prefetchChapter(state.chapter - 1);
    }
  }, [
    state.pageIndex,
    state.chapterVerses.length,
    state.chapter,
    prefetchChapter,
  ]);

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

  // Update URL and save position when verse/page changes
  useEffect(() => {
    const newParams = new URLSearchParams();
    newParams.set("c", state.chapter.toString());

    if (currentVerse) {
      // On a verse - include verse number in URL
      newParams.set("v", currentVerse.verse.toString());
      setSearchParams(newParams, { replace: true });
      // Save position via synced hook (localStorage + server sync if logged in)
      savePosition(state.chapter, currentVerse.verse);
    } else if (state.pageIndex === PAGE_CHAPTER_INTRO) {
      // On chapter intro - URL is just ?c=N (no verse)
      setSearchParams(newParams, { replace: true });
    }
    // Book cover (-2) doesn't update URL
  }, [
    state.chapter,
    state.pageIndex,
    currentVerse,
    setSearchParams,
    savePosition,
  ]);

  // Navigate to a different chapter
  // startAtEnd: if true, start at the last verse (for prev navigation)
  const goToChapter = useCallback(
    (chapter: number, startAtEnd = false) => {
      if (
        chapter >= 1 &&
        chapter <= TOTAL_CHAPTERS &&
        chapter !== state.chapter
      ) {
        setState((prev) => ({
          ...prev,
          chapter,
          // -3 signals "start at end", -1 is chapter intro
          pageIndex: startAtEnd ? -3 : PAGE_CHAPTER_INTRO,
          chapterVerses: [],
        }));
        // Reset translation visibility for new chapter
        setShowTranslation(false);
        loadChapter(chapter);
      }
    },
    [loadChapter, state.chapter],
  );

  // Ref to hold goToChapter for stable reference in navigation callbacks
  const goToChapterRef = useRef(goToChapter);
  goToChapterRef.current = goToChapter;

  // Navigation functions - use refs to avoid stale closures
  const nextPage = useCallback(() => {
    // Stop auto-advance on manual navigation
    autoAdvance.handleManualNavigation();
    // Set slide animation direction (content slides in from right)
    setSlideDirection("from-right");
    setState((prev) => {
      // Book cover → chapter intro
      if (prev.pageIndex === PAGE_BOOK_COVER) {
        return { ...prev, pageIndex: PAGE_CHAPTER_INTRO };
      }
      // Chapter intro → target verse (resume) or first verse
      if (prev.pageIndex === PAGE_CHAPTER_INTRO) {
        if (targetVerse && prev.chapterVerses.length > 0) {
          const index = prev.chapterVerses.findIndex(
            (v) => v.verse === targetVerse,
          );
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
  }, [targetVerse, autoAdvance]);

  const prevPage = useCallback(() => {
    // Stop auto-advance on manual navigation
    autoAdvance.handleManualNavigation();
    // Set slide animation direction (content slides in from left)
    setSlideDirection("from-left");
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
  }, [autoAdvance]);

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
      if (
        (event.key === "ArrowLeft" || event.key === "k" || event.key === "K") &&
        canGoPrev
      ) {
        event.preventDefault();
        prevPage();
      } else if (
        (event.key === "ArrowRight" ||
          event.key === "j" ||
          event.key === "J") &&
        canGoNext
      ) {
        event.preventDefault();
        nextPage();
      } else if (event.key === " " || event.key === "Spacebar") {
        // Space: Pause/resume study mode, auto-advance, or audio playback
        if (studyAutoMode.isActive) {
          event.preventDefault();
          if (studyAutoMode.isPaused) {
            studyAutoMode.resume();
          } else {
            studyAutoMode.pause();
          }
        } else if (autoAdvance.isActive) {
          event.preventDefault();
          if (autoAdvance.isPaused) {
            autoAdvance.resume();
          } else {
            autoAdvance.pause();
          }
        } else if (
          audioPlayer.state === "playing" ||
          audioPlayer.state === "paused"
        ) {
          // Audio playing from verse button click - pause/resume
          event.preventDefault();
          if (audioPlayer.state === "playing") {
            audioPlayer.pause();
          } else {
            audioPlayer.resume();
          }
        }
      } else if (event.key === "Escape") {
        // Escape: Stop study mode, auto-advance, or audio playback
        if (studyAutoMode.isActive) {
          event.preventDefault();
          studyAutoMode.stop();
        } else if (autoAdvance.isActive) {
          event.preventDefault();
          autoAdvance.stop();
        } else if (
          audioPlayer.state === "playing" ||
          audioPlayer.state === "paused"
        ) {
          event.preventDefault();
          audioPlayer.stop();
        }
      } else if (event.key === "ArrowDown" && studyAutoMode.isActive) {
        // Down arrow: Skip to next verse in study mode
        event.preventDefault();
        studyAutoMode.skipVerse();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canGoPrev, canGoNext, prevPage, nextPage, autoAdvance, audioPlayer, studyAutoMode]);

  return (
    <div className="h-screen reading-container flex flex-col overflow-hidden">
      <Navbar />

      {/* Chapter Header - shrink-0 prevents flex shrinking */}
      <header className="shrink-0 z-10 bg-[var(--surface-reading-header)] backdrop-blur-xs border-b border-[var(--border-reading-header)]">
        <div className="max-w-4xl mx-auto px-4 py-2">
          {/* Chapter info */}
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm text-[var(--text-reading-primary)] font-medium">
              Chapter {state.chapter}
              <span className="mx-2 text-[var(--text-reading-muted)]">·</span>
              <span className="text-[var(--text-reading-secondary)]">
                {getChapterName(state.chapter)}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Font size toggle - Aa + filled circles */}
              <button
                onClick={cycleFontSize}
                className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3 py-2 text-[var(--text-reading-primary)] hover:bg-[var(--interactive-reading-hover-bg)] active:bg-[var(--interactive-reading-active-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
                aria-label={`Font size: ${settings.fontSize}. Tap to change.`}
                title={`Font size: ${settings.fontSize}`}
              >
                <span className="text-sm font-serif">Aa</span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-[var(--radius-progress)] bg-[var(--reading-indicator-active)]" />
                  <span
                    className={`w-1.5 h-1.5 rounded-[var(--radius-progress)] ${settings.fontSize !== "small" ? "bg-[var(--reading-indicator-active)]" : "bg-[var(--reading-indicator-inactive)]"}`}
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-[var(--radius-progress)] ${settings.fontSize === "large" ? "bg-[var(--reading-indicator-active)]" : "bg-[var(--reading-indicator-inactive)]"}`}
                  />
                </span>
              </button>
              {/* Reset progress button */}
              <button
                onClick={resetProgress}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-[var(--text-reading-muted)] hover:text-[var(--text-reading-primary)] hover:bg-[var(--interactive-reading-hover-bg)] active:bg-[var(--interactive-reading-active-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
                aria-label="Start over from beginning"
                title="Start over"
              >
                <svg
                  className="w-5 h-5"
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
              {/* Keyboard shortcuts hint - desktop only */}
              <div className="hidden lg:flex items-center gap-1 text-xs text-[var(--text-reading-muted)] ml-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--surface-warm-subtle)] border border-[var(--border-warm-subtle)] rounded text-[10px] font-mono">
                  ←
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-[var(--surface-warm-subtle)] border border-[var(--border-warm-subtle)] rounded text-[10px] font-mono">
                  →
                </kbd>
              </div>
              {/* Verse counter - shows progress within chapter */}
              {currentVerse && (
                <div className="text-sm text-[var(--text-reading-primary)]/80 ml-1">
                  {currentVerse.verse}/{getChapterVerseCount(state.chapter)}
                </div>
              )}
              {/* View verse details - rightmost icon */}
              {currentVerse && (
                <Link
                  to={`/verses/${currentVerse.canonical_id}`}
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-[var(--text-reading-muted)] hover:text-[var(--text-reading-primary)] hover:bg-[var(--interactive-reading-hover-bg)] active:bg-[var(--interactive-reading-active-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
                  aria-label="View verse details"
                  title="View verse details"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          {/* Progress bar - 6px on mobile, 4px on desktop for better visibility */}
          <ProgressBar
            percentage={progress.percentage}
            className="h-1.5 sm:h-1"
            ariaLabel={`Chapter ${state.chapter} progress: ${progress.percentage}%`}
          />
        </div>
      </header>

      {/* Main Content Area - swipeable on mobile */}
      {/* flex-1 expands to fill space; justify-start prevents shift when translation expands */}
      <main
        ref={swipeRef}
        className="flex-1 flex flex-col items-center justify-start px-4 pt-8 sm:pt-12 pb-8 touch-pan-y overflow-y-auto"
      >
        {state.isLoading || (isChapterIntro && !chapterMetadata) ? (
          // Loading state (verses loading or chapter metadata loading)
          <div className="text-center">
            <div className="text-4xl text-[var(--decorative-om)] mb-4 animate-pulse">
              ॐ
            </div>
            <p className="text-[var(--text-reading-secondary)]">
              Loading chapter...
            </p>
          </div>
        ) : state.error ? (
          // Error state
          <div className="text-center max-w-md">
            <div className="text-4xl text-[var(--status-error-text)]/60 mb-4">
              ⚠
            </div>
            <p className="text-[var(--status-error-text)] mb-4">
              {state.error}
            </p>
            <button
              onClick={() => loadChapter(state.chapter)}
              className="px-4 py-2 bg-[var(--interactive-contextual)] text-[var(--interactive-contextual-text)] rounded-[var(--radius-button)] hover:opacity-90 transition-[var(--transition-color)]"
            >
              Try Again
            </button>
          </div>
        ) : isBookCover && bookMetadata ? (
          // Book cover page
          <div
            key="book-cover"
            className={
              slideDirection === "from-left"
                ? "animate-slide-in-from-left"
                : slideDirection === "from-right"
                  ? "animate-slide-in-from-right"
                  : ""
            }
          >
            <IntroCard
              type="book"
              book={bookMetadata}
              fontSize={settings.fontSize}
              onBegin={nextPage}
              onStartDhyanam={() => navigate("/read/dhyanam")}
            />
          </div>
        ) : isChapterIntro && chapterMetadata ? (
          // Chapter intro page
          <div
            key={`chapter-${state.chapter}-intro`}
            className={
              slideDirection === "from-left"
                ? "animate-slide-in-from-left"
                : slideDirection === "from-right"
                  ? "animate-slide-in-from-right"
                  : ""
            }
          >
            <IntroCard
              type="chapter"
              chapter={chapterMetadata}
              fontSize={settings.fontSize}
              onBegin={nextPage}
              resumeVerse={targetVerse}
            />
          </div>
        ) : currentVerse ? (
          // Verse display with tap-to-reveal translations
          <div
            key={currentVerse.canonical_id}
            className={
              slideDirection === "from-left"
                ? "animate-slide-in-from-left"
                : slideDirection === "from-right"
                  ? "animate-slide-in-from-right"
                  : ""
            }
          >
            <VerseFocus
              verse={currentVerse}
              fontSize={settings.fontSize}
              showTranslation={showTranslation}
              onToggleTranslation={toggleTranslation}
            />
          </div>
        ) : (
          // Fallback: No content available
          <div className="text-center">
            <div className="text-4xl text-[var(--decorative-om)] mb-4">ॐ</div>
            <p className="text-[var(--text-reading-secondary)]">Loading...</p>
          </div>
        )}
      </main>

      {/* Audio MiniPlayer - shown when current verse has audio */}
      {currentVerse?.audio_url && (
        <MiniPlayer
          verseId={currentVerse.canonical_id}
          audioUrl={currentVerse.audio_url}
          autoPlay={false}
          // Auto-advance props (Phase 3.7)
          autoAdvanceMode={autoAdvance.mode}
          isAutoAdvancePaused={autoAdvance.isPaused}
          textModeProgress={autoAdvance.textModeProgress}
          durationMs={currentVerse.duration_ms}
          versePosition={versePosition}
          onStartAudioMode={autoAdvance.startAudioMode}
          onStartTextMode={autoAdvance.startTextMode}
          onPauseAutoAdvance={autoAdvance.pause}
          onResumeAutoAdvance={autoAdvance.resume}
          onStopAutoAdvance={autoAdvance.stop}
          // Continuous playback props (Phase 1.19.0)
          continuousPlayback={continuousPlayback}
          onToggleContinuousPlayback={toggleContinuousPlayback}
          // Study mode props (v1.25.0) - with wrapping commentaries
          studyModeStatus={studyAutoMode.state.status}
          studyModePhase={studyAutoMode.state.phase}
          studyModeSection={studyAutoMode.state.currentSection}
          studyModeAvailableSections={studyAutoMode.state.availableSections}
          isStudyModeLoading={studyAutoMode.isLoading}
          onStartStudyMode={studyAutoMode.start}
          onPauseStudyMode={studyAutoMode.pause}
          onResumeStudyMode={studyAutoMode.resume}
          onStopStudyMode={studyAutoMode.stop}
          onSkipStudySection={studyAutoMode.skipSection}
          onSkipStudyVerse={studyAutoMode.skipVerse}
        />
      )}

      {/* Bottom Navigation Bar - shrink-0 prevents flex shrinking */}
      <nav
        className="shrink-0 bg-[var(--surface-reading-header)] backdrop-blur-xs border-t border-[var(--border-reading-header)]"
        aria-label="Verse navigation"
      >
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Previous button */}
            <button
              onClick={prevPage}
              disabled={!canGoPrev}
              className={`flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] transition-[var(--transition-color)] ${
                canGoPrev
                  ? "text-[var(--text-reading-primary)] hover:bg-[var(--interactive-reading-hover-bg)] active:bg-[var(--interactive-reading-active-bg)]"
                  : "text-[var(--interactive-reading-disabled)] cursor-not-allowed"
              }`}
              aria-label="Previous"
            >
              <span className="text-lg">←</span>
              <span className="text-sm font-medium">Prev</span>
            </button>

            {/* Chapter selector button */}
            <button
              onClick={() => setShowChapterSelector(true)}
              className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-[var(--text-reading-primary)] hover:bg-[var(--interactive-reading-hover-bg)] active:bg-[var(--interactive-reading-active-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
              aria-label="Select chapter"
            >
              <span className="text-sm font-medium">
                {currentVerse
                  ? `${state.chapter}.${currentVerse.verse}`
                  : `Ch ${state.chapter}`}
              </span>
              {/* Dropdown indicator */}
              <svg
                className="w-4 h-4 text-[var(--reading-indicator-active)]"
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
              className={`flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] transition-[var(--transition-color)] ${
                canGoNext
                  ? "text-[var(--text-reading-primary)] hover:bg-[var(--interactive-reading-hover-bg)] active:bg-[var(--interactive-reading-active-bg)]"
                  : "text-[var(--interactive-reading-disabled)] cursor-not-allowed"
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
        onDhyanam={() => navigate("/read/dhyanam")}
      />

      {/* Onboarding Overlay - First-time users */}
      {showOnboarding && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-xs z-50"
            onClick={dismissOnboarding}
            aria-hidden="true"
          />

          {/* Onboarding Card */}
          <div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto
                       bg-[var(--surface-elevated)] rounded-[var(--radius-modal)] shadow-[var(--shadow-modal)] p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="Reading Mode tips"
          >
            <h2 className="text-lg font-semibold font-heading text-[var(--text-primary)] text-center mb-4">
              Welcome to Reading Mode
            </h2>

            <div className="space-y-4 text-sm text-[var(--text-secondary)]">
              {/* Tap hint */}
              <div className="flex items-start gap-3">
                <span className="text-xl">👆</span>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    Tap for translation
                  </p>
                  <p className="text-[var(--text-muted)]">
                    Tap the verse to reveal Hindi, English & IAST
                  </p>
                </div>
              </div>

              {/* Swipe hint */}
              <div className="flex items-start gap-3">
                <span className="text-xl">👈👉</span>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    Swipe to navigate
                  </p>
                  <p className="text-[var(--text-muted)]">
                    Swipe left/right to move between verses
                  </p>
                </div>
              </div>

              {/* Keyboard hint - desktop only */}
              <div className="hidden sm:flex items-start gap-3">
                <span className="text-xl">⌨️</span>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    Keyboard shortcuts
                  </p>
                  <p className="text-[var(--text-muted)]">
                    ← → or J/K to navigate, Space for translation
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={dismissOnboarding}
              className="w-full mt-6 py-3 bg-[var(--interactive-contextual)] hover:opacity-90 text-[var(--interactive-contextual-text)] font-medium rounded-[var(--radius-card)] transition-[var(--transition-color)]"
            >
              Got it!
            </button>
          </div>
        </>
      )}

      {/* Newsletter Toast - shown after reading 5+ verses */}
      {showNewsletterToast && (
        <Toast
          message="Enjoying your reading?"
          linkText="Get daily verses"
          linkTo="/settings#newsletter"
          duration={6000}
          onDismiss={dismissNewsletterToast}
        />
      )}
    </div>
  );
}

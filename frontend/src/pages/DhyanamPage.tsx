/**
 * DhyanamPage - Geeta Dhyanam (9 Sacred Invocation Verses)
 *
 * Features:
 * - VerseFocus-style single verse display
 * - Swipe/arrow navigation through 9 verses
 * - Progress dots
 * - MiniPlayer with auto-advance modes (Listen/Read)
 * - Single-play button on verse card
 * - Summary screen after verse 9
 * - No auto-play on page load (user must tap to start)
 * - Deep linking support: /read/dhyanam/3 starts at verse 3
 * - URL sync: URL updates as user navigates for shareable links
 *
 * Routes:
 * - /read/dhyanam - Start at verse 1
 * - /read/dhyanam/:verseNumber - Start at specific verse (1-9)
 *
 * Design: Mobile-first, 44×44px touch targets, content-forward
 *
 * Phase 3.7c: Refactored to use shared useAutoAdvance hook and MiniPlayer
 * Phase 3.7d: Added deep linking and URL sync for shareable verse links
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { dhyanamApi } from "../lib/api";
import type { GeetaDhyanamVerse } from "../types";
import { Navbar } from "../components";
import { DhyanamVerseFocus } from "../components/DhyanamVerseFocus";
import {
  LogoIcon,
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
  CheckIcon,
  AlertCircleIcon,
} from "../components/icons";
import { useSwipeNavigation, useReadingPrefs, useAutoAdvance } from "../hooks";
import { MiniPlayer, useAudioPlayer } from "../components/audio";

/** Dhyanam page state */
type DhyanamState = "loading" | "viewing" | "completed" | "error";

/** Progress dots component - 44px touch targets with small visual dots */
function ProgressDots({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (index: number) => void;
}) {
  return (
    <div className="flex justify-center -mx-2" role="tablist">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={() => onDotClick(index)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-full"
          role="tab"
          aria-selected={index === current}
          aria-label={`Go to verse ${index + 1}`}
        >
          <span
            className={`
              block rounded-full transition-all duration-200
              ${
                index === current
                  ? "w-4 h-2 bg-[var(--interactive-primary)]"
                  : "w-2 h-2 bg-[var(--border-warm)] hover:bg-[var(--border-warm-hover)]"
              }
            `}
          />
        </button>
      ))}
    </div>
  );
}

/** Summary screen after verse 9 */
function DhyanamSummary({
  onReciteAgain,
  onBeginReading,
  onResume,
  resumePosition,
}: {
  onReciteAgain: () => void;
  onBeginReading: () => void;
  onResume?: () => void;
  resumePosition?: { chapter: number; verse: number } | null;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto text-center px-4">
      {/* Logo */}
      <div className="flex justify-center mb-4">
        <LogoIcon className="h-16 w-16 sm:h-20 sm:w-20" />
      </div>

      {/* Sacred header with full title */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-sanskrit text-[var(--text-sanskrit)] mb-1">
          श्रीमद्भगवद्गीता
        </h1>
        <h2 className="text-lg sm:text-xl font-sanskrit text-[var(--text-primary)] mb-2">
          ध्यानम् सम्पूर्णम्
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          The Invocation is Complete
        </p>
      </div>

      {/* Inspirational verse - from Gita 2.47 */}
      <div className="bg-[var(--surface-warm-subtle)] border border-[var(--border-warm)] rounded-[var(--radius-card)] p-4 sm:p-6 mb-6">
        <p className="font-sanskrit text-base sm:text-lg text-[var(--text-primary)] mb-2 leading-relaxed">
          कर्मण्येवाधिकारस्ते मा फलेषु कदाचन
        </p>
        <p className="text-sm text-[var(--text-secondary)] italic">
          "You have the right to work, but never to the fruit of work."
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          — Bhagavad Gita 2.47
        </p>
      </div>

      {/* Completion badge */}
      <div className="flex justify-center mb-6">
        <span className="px-4 py-2 bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-sm rounded-[var(--radius-chip)]">
          ✓ 9 Sacred Verses Recited
        </span>
      </div>

      {/* CTAs */}
      <div className="space-y-3">
        <button
          onClick={onBeginReading}
          className="w-full px-6 py-3 bg-[var(--interactive-contextual)] hover:bg-[var(--interactive-contextual-hover)] text-[var(--interactive-contextual-text)] font-medium rounded-[var(--radius-button)] transition-[var(--transition-color)] shadow-[var(--shadow-card)]"
        >
          Begin Chapter 1 →
        </button>

        {resumePosition && onResume && (
          <button
            onClick={onResume}
            className="w-full px-6 py-3 border border-[var(--border-warm)] hover:border-[var(--border-warm-hover)] hover:bg-[var(--interactive-ghost-hover-bg)] text-[var(--text-primary)] font-medium rounded-[var(--radius-button)] transition-[var(--transition-color)]"
          >
            Resume at {resumePosition.chapter}.{resumePosition.verse} →
          </button>
        )}
      </div>

      {/* Start over link - tertiary action */}
      <button
        onClick={onReciteAgain}
        className="mt-6 min-h-[44px] px-4 py-2.5 text-[var(--interactive-ghost-text)] hover:text-[var(--interactive-ghost-hover-text)] hover:bg-[var(--interactive-ghost-hover-bg)] text-sm rounded-[var(--radius-button)] transition-[var(--transition-color)]"
      >
        ← Return to Dhyanam
      </button>
    </div>
  );
}

/** Navigation controls for prev/next and skip */
function NavigationControls({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onSkip,
}: {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="bg-[var(--surface-reading-header)] border-t border-[var(--border-reading)] px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Prev button */}
        <button
          onClick={onPrev}
          disabled={!canGoPrev}
          className="min-w-[44px] min-h-[44px] p-3 rounded-[var(--radius-button)] text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-[var(--transition-button)] flex items-center justify-center"
          aria-label="Previous verse"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Skip to Reading link */}
        <button
          onClick={onSkip}
          className="min-h-[44px] px-3 py-2 text-sm text-[var(--interactive-ghost-text)] hover:text-[var(--interactive-ghost-hover-text)] hover:bg-[var(--interactive-ghost-hover-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
        >
          Skip to Reading →
        </button>

        {/* Next button */}
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="min-w-[44px] min-h-[44px] p-3 rounded-[var(--radius-button)] text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-[var(--transition-button)] flex items-center justify-center"
          aria-label="Next verse"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function DhyanamPage() {
  const navigate = useNavigate();
  const { verseNumber } = useParams<{ verseNumber?: string }>();

  // Parse and validate verse number from URL (1-9, default 1)
  const initialIndex = useMemo(() => {
    if (!verseNumber) return 0;
    const parsed = parseInt(verseNumber, 10);
    if (isNaN(parsed) || parsed < 1) return 0;
    if (parsed > 9) return 8; // Clamp to max
    return parsed - 1; // Convert to 0-based index
  }, [verseNumber]);

  // Core state
  const [verses, setVerses] = useState<GeetaDhyanamVerse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [pageState, setPageState] = useState<DhyanamState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  // Single-play mode for individual verse playback (Phase 3.7b)
  const [isSinglePlayMode, setIsSinglePlayMode] = useState(false);

  // Audio player (for single-play mode)
  const audioPlayer = useAudioPlayer();

  // Get saved reading position
  const { position: savedPosition } = useReadingPrefs();

  // Current verse - memoized to prevent effect re-runs on every render
  const currentVerse = useMemo(
    () => verses[currentIndex],
    [verses, currentIndex],
  );

  // Audio ID for current verse
  const audioId = `dhyanam_${currentIndex + 1}`;

  // Next verse for preloading
  const nextVerse =
    currentIndex >= 0 && currentIndex < verses.length - 1
      ? verses[currentIndex + 1]
      : null;

  // Auto-advance hook - manages Listen/Read modes
  const autoAdvance = useAutoAdvance({
    currentIndex,
    totalCount: verses.length,
    audioUrl: currentVerse?.audio_url,
    durationMs: currentVerse?.duration_ms,
    audioId,
    nextAudioUrl: nextVerse?.audio_url,
    onAdvance: (nextIndex) => {
      setCurrentIndex(nextIndex);
      setShowTranslation(false);
    },
    onComplete: () => {
      setPageState("completed");
    },
  });

  // Fetch Dhyanam verses
  useEffect(() => {
    async function loadVerses() {
      try {
        const data = await dhyanamApi.getAll();
        setVerses(data);
        setPageState("viewing");
      } catch {
        setError("Failed to load Dhyanam verses");
        setPageState("error");
      }
    }
    loadVerses();
  }, []);

  // Sync URL with current verse (for shareable deep links)
  useEffect(() => {
    if (pageState !== "viewing" || verses.length === 0) return;

    const newVerseNumber = currentIndex + 1;
    const currentUrlVerseNumber = verseNumber ? parseInt(verseNumber, 10) : 1;

    // Only update URL if it differs (avoid unnecessary history entries)
    if (newVerseNumber !== currentUrlVerseNumber) {
      navigate(`/read/dhyanam/${newVerseNumber}`, { replace: true });
    }
  }, [currentIndex, pageState, verses.length, verseNumber, navigate]);

  // Single-play: Auto-dismiss after completion or error
  const SINGLE_PLAY_DISMISS_DELAY_MS = 1500;
  useEffect(() => {
    if (
      isSinglePlayMode &&
      audioPlayer.currentlyPlaying === audioId &&
      (audioPlayer.state === "completed" || audioPlayer.state === "error")
    ) {
      const timer = setTimeout(() => {
        setIsSinglePlayMode(false);
      }, SINGLE_PLAY_DISMISS_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [
    isSinglePlayMode,
    audioPlayer.currentlyPlaying,
    audioPlayer.state,
    audioId,
  ]);

  // Stop single-play when entering auto-advance mode
  useEffect(() => {
    if (autoAdvance.isActive && isSinglePlayMode) {
      audioPlayer.stop();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync single-play state when auto-advance starts
      setIsSinglePlayMode(false);
    }
  }, [autoAdvance.isActive, isSinglePlayMode, audioPlayer]);

  // Navigation callbacks - manual navigation stops auto-advance
  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      autoAdvance.handleManualNavigation();
      setIsSinglePlayMode(false);
      setCurrentIndex((prev) => prev - 1);
      setShowTranslation(false);
    }
  }, [currentIndex, autoAdvance]);

  const goToNext = useCallback(() => {
    if (currentIndex < verses.length - 1) {
      autoAdvance.handleManualNavigation();
      setIsSinglePlayMode(false);
      setCurrentIndex((prev) => prev + 1);
      setShowTranslation(false);
    } else if (currentIndex === verses.length - 1) {
      autoAdvance.handleManualNavigation();
      setIsSinglePlayMode(false);
      setPageState("completed");
    }
  }, [currentIndex, verses.length, autoAdvance]);

  const goToVerse = useCallback(
    (index: number) => {
      if (index >= 0 && index < verses.length) {
        autoAdvance.handleManualNavigation();
        setIsSinglePlayMode(false);
        setCurrentIndex(index);
        setShowTranslation(false);
      }
    },
    [verses.length, autoAdvance],
  );

  // Swipe navigation
  const swipeRef = useSwipeNavigation({
    onNext: goToNext,
    onPrev: goToPrev,
    enabled: pageState === "viewing",
  });

  // Single-play: Play current verse without auto-advance
  const handleSinglePlay = useCallback(() => {
    if (!currentVerse?.audio_url) return;

    // Stop auto-advance if active
    if (autoAdvance.isActive) {
      autoAdvance.stop();
    }

    setIsSinglePlayMode(true);
    audioPlayer.play(audioId, currentVerse.audio_url);
  }, [currentVerse, autoAdvance, audioPlayer, audioId]);

  // Exit single-play mode
  const handleExitSinglePlay = useCallback(() => {
    audioPlayer.stop();
    setIsSinglePlayMode(false);
  }, [audioPlayer]);

  // Navigation to reading
  const handleSkipToReading = useCallback(() => {
    autoAdvance.stop();
    navigate("/read");
  }, [navigate, autoAdvance]);

  const handleBeginReading = useCallback(() => {
    autoAdvance.stop();
    navigate("/read?c=1&v=1");
  }, [navigate, autoAdvance]);

  const handleResume = useCallback(() => {
    if (savedPosition) {
      autoAdvance.stop();
      navigate(`/read?c=${savedPosition.chapter}&v=${savedPosition.verse}`);
    }
  }, [savedPosition, navigate, autoAdvance]);

  const handleReciteAgain = useCallback(() => {
    autoAdvance.stop();
    setCurrentIndex(0);
    setShowTranslation(false);
    setPageState("viewing");
  }, [autoAdvance]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pageState !== "viewing") return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goToPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goToNext();
          break;
        case " ":
        case "Spacebar":
          // Space to pause/resume if active
          if (autoAdvance.isActive) {
            e.preventDefault();
            if (autoAdvance.isPaused) {
              autoAdvance.resume();
            } else {
              autoAdvance.pause();
            }
          } else if (isSinglePlayMode) {
            e.preventDefault();
            if (audioPlayer.state === "playing") {
              audioPlayer.pause();
            } else if (audioPlayer.state === "paused") {
              audioPlayer.resume();
            }
          }
          break;
        case "Escape":
          // Escape to stop
          if (autoAdvance.isActive) {
            e.preventDefault();
            autoAdvance.stop();
          } else if (isSinglePlayMode) {
            e.preventDefault();
            handleExitSinglePlay();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    pageState,
    goToPrev,
    goToNext,
    autoAdvance,
    isSinglePlayMode,
    audioPlayer,
    handleExitSinglePlay,
  ]);

  // Loading state
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-[var(--surface-reading)]">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-6 h-6 border-2 border-[var(--interactive-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <div className="min-h-screen bg-[var(--surface-reading)]">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh] px-4 text-center">
          <p className="text-[var(--status-error-text)] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Summary screen
  if (pageState === "completed") {
    return (
      <div className="min-h-screen bg-[var(--surface-reading)] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-8">
          <DhyanamSummary
            onReciteAgain={handleReciteAgain}
            onBeginReading={handleBeginReading}
            onResume={savedPosition ? handleResume : undefined}
            resumePosition={savedPosition}
          />
        </div>
      </div>
    );
  }

  // Main viewing state
  return (
    <div
      ref={swipeRef}
      className="min-h-screen bg-[var(--surface-reading)] flex flex-col"
    >
      <Navbar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center px-4 py-6 overflow-y-auto">
        {/* Hero header - shown when not in auto-advance mode */}
        {!autoAdvance.isActive && (
          <div className="text-center mb-4 sm:mb-6">
            {/* Logo */}
            <div className="flex justify-center mb-3">
              <LogoIcon className="h-14 w-14 sm:h-16 sm:w-16" />
            </div>

            {/* Title */}
            <h1 className="text-lg sm:text-xl font-sanskrit text-[var(--text-sanskrit)] mb-1">
              श्रीमद्भगवद्गीता
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              गीता ध्यानम् · Sacred Invocation
            </p>
          </div>
        )}

        {/* Verse card - styled like FeaturedVerse on home page */}
        {currentVerse && (
          <div
            className={`w-full max-w-2xl ${autoAdvance.isActive ? "flex-1 flex flex-col justify-center" : ""}`}
          >
            <div className="relative bg-[var(--surface-card)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 border border-[var(--border-warm)] shadow-[var(--shadow-modal)]">
              {/* Single-play button - top right of card */}
              {!autoAdvance.isActive &&
                currentVerse.audio_url &&
                (() => {
                  const isThisPlaying =
                    audioPlayer.currentlyPlaying === audioId;
                  const state = isThisPlaying ? audioPlayer.state : "idle";

                  // Determine button appearance based on state (subtle styling like FeaturedVerse)
                  const getButtonStyle = () => {
                    if (state === "error")
                      return "text-[var(--status-error-text)] bg-[var(--status-error-text)]/10";
                    if (state === "completed")
                      return "text-[var(--status-success-text)] bg-[var(--status-success-text)]/10";
                    if (state === "playing" || state === "loading")
                      return "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10";
                    return "text-[var(--text-muted)] hover:text-[var(--interactive-primary)] hover:bg-[var(--surface-muted)]";
                  };

                  const getAriaLabel = () => {
                    if (state === "loading") return "Loading verse audio";
                    if (state === "playing") return "Pause verse audio";
                    if (state === "paused") return "Resume verse audio";
                    if (state === "completed") return "Replay verse audio";
                    if (state === "error") return "Retry verse audio";
                    return "Play this verse";
                  };

                  const handleClick = () => {
                    if (state === "playing") {
                      audioPlayer.pause();
                    } else if (state === "paused") {
                      audioPlayer.resume();
                    } else if (state === "error") {
                      audioPlayer.retry();
                    } else {
                      handleSinglePlay();
                    }
                  };

                  return (
                    <button
                      onClick={handleClick}
                      disabled={state === "loading"}
                      className={`absolute top-4 right-4 min-w-[44px] min-h-[44px] p-3 rounded-full transition-[var(--transition-all)] flex items-center justify-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-70 disabled:cursor-not-allowed ${getButtonStyle()}`}
                      aria-label={getAriaLabel()}
                    >
                      {state === "loading" ? (
                        <SpinnerIcon className="w-5 h-5" />
                      ) : state === "playing" ? (
                        <PauseIcon className="w-5 h-5" />
                      ) : state === "completed" ? (
                        <CheckIcon className="w-5 h-5" />
                      ) : state === "error" ? (
                        <AlertCircleIcon className="w-5 h-5" />
                      ) : (
                        <PlayIcon className="w-5 h-5" />
                      )}
                    </button>
                  );
                })()}

              <DhyanamVerseFocus
                verse={currentVerse}
                fontSize="medium"
                showTranslation={showTranslation}
                onToggleTranslation={() => setShowTranslation((prev) => !prev)}
              />
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div className="mt-4 sm:mt-6">
          <ProgressDots
            total={verses.length}
            current={currentIndex}
            onDotClick={goToVerse}
          />
        </div>
      </div>

      {/* Bottom bar: MiniPlayer + Navigation (same order as ReadingMode) */}
      <div className="flex flex-col">
        {/* MiniPlayer for audio/auto-advance */}
        {currentVerse && (
          <MiniPlayer
            verseId={audioId}
            audioUrl={currentVerse.audio_url}
            autoAdvanceMode={autoAdvance.mode}
            isAutoAdvancePaused={autoAdvance.isPaused}
            textModeProgress={autoAdvance.textModeProgress}
            durationMs={currentVerse.duration_ms}
            versePosition={{ current: currentIndex + 1, total: verses.length }}
            onStartAudioMode={autoAdvance.startAudioMode}
            onStartTextMode={autoAdvance.startTextMode}
            onPauseAutoAdvance={autoAdvance.pause}
            onResumeAutoAdvance={autoAdvance.resume}
            onStopAutoAdvance={autoAdvance.stop}
            singlePlayMode={isSinglePlayMode}
            onExitSinglePlay={handleExitSinglePlay}
          />
        )}

        {/* Navigation controls - always visible */}
        <NavigationControls
          canGoPrev={currentIndex > 0}
          canGoNext={currentIndex < verses.length - 1}
          onPrev={goToPrev}
          onNext={goToNext}
          onSkip={handleSkipToReading}
        />
      </div>
    </div>
  );
}

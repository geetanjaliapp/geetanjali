/**
 * useStudyAutoMode - Orchestrates continuous study mode across verses
 *
 * Composes useStudyMode (section sequencing) with verse progression logic
 * to create a hands-free study experience with wrapping commentaries:
 *
 * [Chapter Intro] → "Verse 1" → Sanskrit → English → Hindi → Insight →
 * "Verse 2" → Sanskrit → English → Hindi → Insight → ... → [Chapter Complete]
 *
 * Features:
 * - Chapter introduction before first verse (uses ChapterMetadata.summary)
 * - Verse number announcements before each verse
 * - Chapter completion announcement
 * - Auto-advances to next verse after all sections complete
 * - Chapter boundary handling (stop + prompt)
 * - Manual navigation stops study mode
 * - Pause/resume support
 * - Background audio compatible
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useStudyMode, type StudySection, type StudyModeStatus } from "./useStudyMode";
import { useTTSContext } from "../contexts/TTSContext";
import type { Verse, ChapterMetadata } from "../types";

// ============================================================================
// Types
// ============================================================================

export type StudyAutoModePhase =
  | "idle"
  | "chapter_intro"    // Playing chapter introduction
  | "verse_intro"      // Announcing verse number
  | "verse_content"    // Playing verse sections (Sanskrit, English, Hindi, Insight)
  | "advancing"        // Gap between verses
  | "chapter_complete" // Announcing chapter completion
  | "finished";        // Study session ended

export type StudyAutoModeStatus =
  | "idle"
  | "playing"
  | "paused"
  | "advancing"
  | "chapter_end"
  | "completed";

export interface StudyAutoModeState {
  status: StudyAutoModeStatus;
  /** Current phase in the study flow */
  phase: StudyAutoModePhase;
  /** Current section within the verse (null during intro/outro phases) */
  currentSection: StudySection | null;
  /** Available sections for current verse */
  availableSections: StudySection[];
  /** Current verse index in the sequence */
  verseIndex: number;
  /** What's currently being narrated (for UI display) */
  currentNarration: string | null;
}

export interface StudyAutoModeConfig {
  /** Array of verses in the sequence (typically a chapter) */
  verses: Verse[];
  /** Current verse index */
  currentIndex: number;
  /** Chapter metadata for intro/outro narration */
  chapterMetadata?: ChapterMetadata | null;
  /** Callback to navigate to a verse */
  onNavigate: (index: number) => void;
  /** Callback when reaching chapter end */
  onChapterEnd?: () => void;
  /** Callback when study mode stops (manual or auto) */
  onStop?: () => void;
  /** Delay between verses in ms */
  advanceDelayMs?: number;
}

export interface StudyAutoModeControls {
  state: StudyAutoModeState;
  /** Inner study mode status for current verse */
  verseStatus: StudyModeStatus;
  /** Start study mode from current verse */
  start: () => Promise<void>;
  /** Stop study mode */
  stop: () => void;
  /** Pause study mode */
  pause: () => void;
  /** Resume study mode */
  resume: () => void;
  /** Skip to next section */
  skipSection: () => void;
  /** Skip to next verse */
  skipVerse: () => void;
  /** Is study mode currently active? */
  isActive: boolean;
  /** Is currently paused? */
  isPaused: boolean;
  /** Is loading translations? */
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Delay between verses (ms) */
const DEFAULT_VERSE_ADVANCE_DELAY_MS = 800;

/** Delay after chapter intro before first verse (ms) */
const CHAPTER_INTRO_GAP_MS = 1000;

/** Delay after verse announcement before content (ms) */
const VERSE_INTRO_GAP_MS = 500;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate chapter introduction text for TTS
 * Keeps it concise but informative
 */
function generateChapterIntro(metadata: ChapterMetadata): string {
  const title = metadata.english_title;
  // Truncate summary to ~2 sentences for natural TTS
  const summary = metadata.summary.split(". ").slice(0, 2).join(". ");
  return `Chapter ${metadata.chapter_number}: ${title}. ${summary}.`;
}

/**
 * Generate verse announcement text for TTS
 */
function generateVerseAnnouncement(verse: Verse): string {
  return `Verse ${verse.verse}`;
}

/**
 * Generate chapter completion text for TTS
 */
function generateChapterComplete(metadata: ChapterMetadata): string {
  return `Chapter ${metadata.chapter_number} complete.`;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStudyAutoMode(config: StudyAutoModeConfig): StudyAutoModeControls {
  const {
    verses,
    currentIndex,
    chapterMetadata,
    onNavigate,
    onChapterEnd,
    onStop,
    advanceDelayMs = DEFAULT_VERSE_ADVANCE_DELAY_MS,
  } = config;

  // TTS for wrapping commentaries
  const tts = useTTSContext();

  // Safe verse access with bounds checking (currentIndex can be -1 on intro pages)
  const safeIndex = currentIndex >= 0 && currentIndex < verses.length ? currentIndex : 0;
  const currentVerse = verses.length > 0 ? verses[safeIndex] : null;

  // Placeholder verse for when verses array is empty (during loading)
  // This is never actually used since start() guards against empty verses
  const placeholderVerse: Verse = {
    id: "",
    canonical_id: "",
    chapter: 0,
    verse: 0,
    created_at: "",
  };

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [status, setStatus] = useState<StudyAutoModeStatus>("idle");
  const [phase, setPhase] = useState<StudyAutoModePhase>("idle");
  const [currentNarration, setCurrentNarration] = useState<string | null>(null);

  const isActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingVerseIndexRef = useRef<number>(0); // Track where we started

  // -------------------------------------------------------------------------
  // Callbacks (stable refs to avoid circular deps)
  // -------------------------------------------------------------------------

  const onNavigateRef = useRef(onNavigate);
  const onChapterEndRef = useRef(onChapterEnd);
  const onStopRef = useRef(onStop);
  const chapterMetadataRef = useRef(chapterMetadata);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onChapterEndRef.current = onChapterEnd;
    onStopRef.current = onStop;
    chapterMetadataRef.current = chapterMetadata;
  });

  // -------------------------------------------------------------------------
  // TTS Completion Detection for Wrapping Commentaries
  // -------------------------------------------------------------------------

  const ttsCurrentText = tts.currentText;
  const ttsLoadingText = tts.loadingText;
  const isTTSIdle = ttsCurrentText === null && ttsLoadingText === null;

  // Track TTS completion for intro/outro phases
  useEffect(() => {
    if (!isActiveRef.current || isPausedRef.current) return;
    if (!isTTSIdle) return;

    // Handle phase transitions after TTS completes
    if (phase === "chapter_intro") {
      // Chapter intro done → small gap → verse intro
      advanceTimerRef.current = setTimeout(() => {
        if (isActiveRef.current && !isPausedRef.current) {
          playVerseIntro();
        }
      }, CHAPTER_INTRO_GAP_MS);
    } else if (phase === "verse_intro") {
      // Verse intro done → small gap → verse content
      advanceTimerRef.current = setTimeout(() => {
        if (isActiveRef.current && !isPausedRef.current) {
          startVerseContent();
        }
      }, VERSE_INTRO_GAP_MS);
    } else if (phase === "chapter_complete") {
      // Chapter complete announcement done → finish
      setPhase("finished");
      setStatus("chapter_end");
      isActiveRef.current = false;
      setCurrentNarration(null);
      onChapterEndRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTTSIdle, phase]);

  // -------------------------------------------------------------------------
  // Phase Handlers
  // -------------------------------------------------------------------------

  // Intentionally omit playVerseIntro from deps to avoid circular dependency.
  // playVerseIntro is called synchronously in catch handlers where closure is current.
  const playChapterIntro = useCallback(() => {
    const metadata = chapterMetadataRef.current;
    if (!metadata) {
      // No chapter metadata, skip to verse intro
      playVerseIntro();
      return;
    }

    setPhase("chapter_intro");
    setStatus("playing");
    const introText = generateChapterIntro(metadata);
    setCurrentNarration(introText);

    tts.speak(introText, { lang: "en" }).catch((error) => {
      console.error("[StudyAutoMode] Chapter intro TTS error:", error);
      // Continue anyway
      playVerseIntro();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts]);

  // Intentionally omit startVerseContent from deps to avoid circular dependency.
  // startVerseContent is called synchronously in catch handler where closure is current.
  const playVerseIntro = useCallback(() => {
    const verse = currentVerse;
    if (!verse) return;

    setPhase("verse_intro");
    setStatus("playing");
    const verseText = generateVerseAnnouncement(verse);
    setCurrentNarration(verseText);

    tts.speak(verseText, { lang: "en" }).catch((error) => {
      console.error("[StudyAutoMode] Verse intro TTS error:", error);
      // Continue anyway
      startVerseContent();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts, currentVerse]);

  const startVerseContent = useCallback(() => {
    setPhase("verse_content");
    setCurrentNarration(null);
    // studyMode.start() is called via the effect watching phase
  }, []);

  const playChapterComplete = useCallback(() => {
    const metadata = chapterMetadataRef.current;
    if (!metadata) {
      // No metadata, just finish
      setPhase("finished");
      setStatus("chapter_end");
      isActiveRef.current = false;
      onChapterEndRef.current?.();
      return;
    }

    setPhase("chapter_complete");
    setStatus("playing");
    const completeText = generateChapterComplete(metadata);
    setCurrentNarration(completeText);

    tts.speak(completeText, { lang: "en" }).catch((error) => {
      console.error("[StudyAutoMode] Chapter complete TTS error:", error);
      setPhase("finished");
      setStatus("chapter_end");
      isActiveRef.current = false;
      onChapterEndRef.current?.();
    });

    if (window.umami) {
      window.umami.track("study_auto_chapter_end", {
        chapter: currentVerse?.chapter,
        total_verses: verses.length,
      });
    }
  }, [tts, currentVerse?.chapter, verses.length]);

  // -------------------------------------------------------------------------
  // Handle verse completion → advance to next or finish
  // -------------------------------------------------------------------------

  const handleVerseComplete = useCallback(() => {
    if (!isActiveRef.current) return;

    const nextIndex = currentIndex + 1;

    if (nextIndex >= verses.length) {
      // Chapter complete → play completion announcement
      playChapterComplete();
      return;
    }

    // Advance to next verse after delay
    setPhase("advancing");
    setStatus("advancing");
    setCurrentNarration(null);

    advanceTimerRef.current = setTimeout(() => {
      if (!isActiveRef.current) return;

      onNavigateRef.current(nextIndex);
      // After navigation, play verse intro for the new verse
      // This is handled by the effect watching currentIndex

      if (window.umami) {
        window.umami.track("study_auto_advance", {
          from_verse: currentIndex,
          to_verse: nextIndex,
        });
      }
    }, advanceDelayMs);
  }, [currentIndex, verses.length, advanceDelayMs, playChapterComplete]);

  // -------------------------------------------------------------------------
  // Use study mode for section sequencing
  // -------------------------------------------------------------------------

  const studyMode = useStudyMode({
    verse: currentVerse ?? placeholderVerse,
    onComplete: handleVerseComplete,
  });

  // Stable refs to avoid stale closures
  const studyModeStartRef = useRef(studyMode.start);
  const playVerseIntroRef = useRef(playVerseIntro);
  useEffect(() => {
    studyModeStartRef.current = studyMode.start;
    playVerseIntroRef.current = playVerseIntro;
  });

  // Start verse content when phase transitions to verse_content
  useEffect(() => {
    if (phase === "verse_content" && isActiveRef.current && !isPausedRef.current) {
      studyModeStartRef.current();
    }
  }, [phase]);

  // -------------------------------------------------------------------------
  // Sync status with inner study mode during verse_content phase
  // -------------------------------------------------------------------------

  const innerStatus = studyMode.state.status;
  const shouldBePlaying = innerStatus === "playing" || innerStatus === "gap";
  const shouldBePaused = innerStatus === "paused";

  useEffect(() => {
    if (!isActiveRef.current) return;
    if (phase !== "verse_content") return; // Only sync during verse content
    if (innerStatus === "completed") return; // Handled via onComplete

    if (shouldBePlaying && status !== "playing" && status !== "advancing") {
      setStatus("playing");
    } else if (shouldBePaused && status !== "paused") {
      setStatus("paused");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [innerStatus, phase]);

  // -------------------------------------------------------------------------
  // Auto-continue after verse navigation (play verse intro for new verse)
  // -------------------------------------------------------------------------

  const prevIndexRef = useRef(currentIndex);

  useEffect(() => {
    if (prevIndexRef.current !== currentIndex && isActiveRef.current) {
      prevIndexRef.current = currentIndex;

      // After navigating to a new verse, play the verse intro
      if (phase === "advancing" || phase === "verse_content") {
        const timer = setTimeout(() => {
          if (isActiveRef.current && !isPausedRef.current) {
            playVerseIntroRef.current();
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, phase]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Public Controls
  // -------------------------------------------------------------------------

  const start = useCallback(async () => {
    // Guard: Don't start if already active or no verses available
    if (isActiveRef.current || verses.length === 0 || !currentVerse) {
      return;
    }

    isActiveRef.current = true;
    isPausedRef.current = false;
    startingVerseIndexRef.current = currentIndex;

    // Start with chapter intro (if starting from first verse) or verse intro
    const isFirstVerse = currentIndex === 0;

    if (isFirstVerse && chapterMetadata) {
      playChapterIntro();
    } else {
      playVerseIntro();
    }

    if (window.umami) {
      window.umami.track("study_auto_start", {
        verse: currentVerse.canonical_id,
        chapter: currentVerse.chapter,
        total_verses: verses.length,
        with_chapter_intro: isFirstVerse && !!chapterMetadata,
      });
    }
  }, [currentVerse, verses.length, currentIndex, chapterMetadata, playChapterIntro, playVerseIntro]);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    isPausedRef.current = false;

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    // Stop all audio
    tts.stop();
    studyMode.stop();

    setStatus("idle");
    setPhase("idle");
    setCurrentNarration(null);
    onStopRef.current?.();

    if (window.umami) {
      window.umami.track("study_auto_stop", {
        verse: currentVerse?.canonical_id,
        stopped_at: currentIndex,
        total_verses: verses.length,
      });
    }
  }, [tts, studyMode, currentVerse, currentIndex, verses.length]);

  const pause = useCallback(() => {
    if (!isActiveRef.current) return;

    isPausedRef.current = true;

    // Pause based on current phase
    if (phase === "verse_content") {
      studyMode.pause();
    } else {
      // For intro/outro phases, stop TTS (can't pause TTS)
      tts.stop();
    }

    setStatus("paused");
  }, [phase, studyMode, tts]);

  const resume = useCallback(() => {
    if (!isActiveRef.current) return;

    isPausedRef.current = false;

    if (phase === "verse_content") {
      studyMode.resume();
    } else if (phase === "chapter_intro" || phase === "verse_intro" || phase === "chapter_complete") {
      // Restart the current narration
      if (currentNarration) {
        tts.speak(currentNarration, { lang: "en" }).catch(console.error);
      }
    }

    setStatus("playing");
  }, [phase, studyMode, tts, currentNarration]);

  const skipSection = useCallback(() => {
    // Skip current phase/section
    if (!isActiveRef.current) return;

    if (phase === "chapter_intro") {
      tts.stop();
      playVerseIntro();
    } else if (phase === "verse_intro") {
      tts.stop();
      startVerseContent();
    } else if (phase === "chapter_complete") {
      tts.stop();
      setPhase("finished");
      setStatus("chapter_end");
      isActiveRef.current = false;
      setCurrentNarration(null);
      onChapterEndRef.current?.();
    }
    // For verse_content, would need useStudyMode to expose skipToNextSection()
  }, [phase, tts, playVerseIntro, startVerseContent]);

  const skipVerse = useCallback(() => {
    if (!isActiveRef.current) return;

    // Stop current audio
    tts.stop();
    studyMode.stop();

    const nextIndex = currentIndex + 1;
    if (nextIndex >= verses.length) {
      playChapterComplete();
      return;
    }

    setPhase("advancing");
    onNavigateRef.current(nextIndex);
  }, [tts, studyMode, currentIndex, verses.length, playChapterComplete]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    state: {
      status,
      phase,
      currentSection: phase === "verse_content" ? studyMode.state.currentSection : null,
      availableSections: studyMode.state.availableSections,
      verseIndex: currentIndex,
      currentNarration,
    },
    verseStatus: studyMode.state.status,
    start,
    stop,
    pause,
    resume,
    skipSection,
    skipVerse,
    isActive: status !== "idle" && status !== "chapter_end" && status !== "completed",
    isPaused: status === "paused",
    isLoading: studyMode.isLoadingTranslations,
  };
}

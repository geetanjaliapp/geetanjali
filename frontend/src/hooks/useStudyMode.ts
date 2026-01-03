/**
 * useStudyMode - Sequential playback of verse sections
 *
 * Plays through a verse in order: Sanskrit → English → Hindi → Insight
 * Coordinates between:
 * - AudioPlayer context (pre-recorded Sanskrit audio)
 * - TTS context (English, Hindi, Insight via edge-tts)
 *
 * Features:
 * - 1.5s pause between sections
 * - Graceful skip for missing sections
 * - Pause/resume support
 * - Visual progress tracking
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioPlayer } from "../components/audio";
import { useTTSContext } from "../contexts/TTSContext";
import type { Verse, Translation } from "../types";

/** Section types in playback order */
export type StudySection = "sanskrit" | "english" | "hindi" | "insight";

/** Study mode states */
export type StudyModeStatus = "idle" | "playing" | "paused" | "gap" | "completed";

/** Section order for playback */
const SECTION_ORDER: StudySection[] = ["sanskrit", "english", "hindi", "insight"];

/** Gap duration between sections (ms) */
const SECTION_GAP_MS = 1500;

export interface StudyModeState {
  /** Current status */
  status: StudyModeStatus;
  /** Currently playing/paused section */
  currentSection: StudySection | null;
  /** Sections available for this verse */
  availableSections: StudySection[];
  /** Index of current section in availableSections */
  currentIndex: number;
}

export interface StudyModeConfig {
  /** Verse to study */
  verse: Verse;
  /** Translations fetched from API (for Hindi/English) */
  translations?: Translation[];
  /** Callback when study mode completes */
  onComplete?: () => void;
}

export interface StudyModeControls {
  /** Current state */
  state: StudyModeState;
  /** Start study mode */
  start: () => void;
  /** Stop study mode */
  stop: () => void;
  /** Pause current section */
  pause: () => void;
  /** Resume paused section */
  resume: () => void;
  /** Whether study mode can be started (has at least one section) */
  canStart: boolean;
}

/**
 * Get text content for a section
 */
function getSectionText(
  section: StudySection,
  verse: Verse,
  translations?: Translation[]
): string | null {
  switch (section) {
    case "sanskrit":
      return null; // Sanskrit uses audio, not TTS
    case "english": {
      const englishTranslation = translations?.find(
        (t) => t.language === "en" || t.language === "english"
      );
      return englishTranslation?.text || verse.translation_en || null;
    }
    case "hindi": {
      const hindiTranslation = translations?.find(
        (t) => t.language === "hi" || t.language === "hindi"
      );
      return hindiTranslation?.text || null;
    }
    case "insight":
      return verse.paraphrase_en || null;
    default:
      return null;
  }
}

/**
 * Determine which sections are available for a verse
 */
function getAvailableSections(
  verse: Verse,
  translations?: Translation[]
): StudySection[] {
  return SECTION_ORDER.filter((section) => {
    switch (section) {
      case "sanskrit":
        return !!verse.audio_url;
      case "english":
        return !!getSectionText("english", verse, translations);
      case "hindi":
        return !!getSectionText("hindi", verse, translations);
      case "insight":
        return !!getSectionText("insight", verse, translations);
      default:
        return false;
    }
  });
}

export function useStudyMode(config: StudyModeConfig): StudyModeControls {
  const { verse, translations, onComplete } = config;

  // External dependencies
  const audioPlayer = useAudioPlayer();
  const tts = useTTSContext();

  // Compute available sections
  const availableSections = getAvailableSections(verse, translations);

  // State
  const [state, setState] = useState<StudyModeState>({
    status: "idle",
    currentSection: null,
    availableSections,
    currentIndex: -1,
  });

  // Refs for cleanup and tracking
  const gapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);
  const isPausedRef = useRef(false);

  // Update available sections when verse/translations change
  useEffect(() => {
    const newSections = getAvailableSections(verse, translations);
    setState((prev) => ({
      ...prev,
      availableSections: newSections,
    }));
  }, [verse.canonical_id, translations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gapTimeoutRef.current) {
        clearTimeout(gapTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Play a specific section
   */
  const playSection = useCallback(
    async (section: StudySection, index: number) => {
      if (!isActiveRef.current) return;

      setState((prev) => ({
        ...prev,
        status: "playing",
        currentSection: section,
        currentIndex: index,
      }));

      try {
        if (section === "sanskrit") {
          // Play pre-recorded Sanskrit audio
          if (verse.audio_url) {
            audioPlayer.play(verse.canonical_id, verse.audio_url);
          }
        } else {
          // Use TTS for other sections
          const text = getSectionText(section, verse, translations);
          if (text) {
            const lang = section === "hindi" ? "hi" : "en";
            await tts.speak(text, { lang });
          }
        }
      } catch (error) {
        console.error(`[StudyMode] Error playing ${section}:`, error);
        // Continue to next section on error
        advanceToNextSection(index);
      }
    },
    [verse, translations, audioPlayer, tts]
  );

  /**
   * Advance to the next section (or complete)
   */
  const advanceToNextSection = useCallback(
    (currentIndex: number) => {
      if (!isActiveRef.current) return;

      const nextIndex = currentIndex + 1;

      if (nextIndex >= state.availableSections.length) {
        // Study mode complete
        isActiveRef.current = false;
        setState((prev) => ({
          ...prev,
          status: "completed",
          currentSection: null,
          currentIndex: -1,
        }));
        onComplete?.();
        return;
      }

      // Show gap state
      setState((prev) => ({
        ...prev,
        status: "gap",
      }));

      // Wait for gap, then play next section
      gapTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current && !isPausedRef.current) {
          const nextSection = state.availableSections[nextIndex];
          playSection(nextSection, nextIndex);
        }
      }, SECTION_GAP_MS);
    },
    [state.availableSections, playSection, onComplete]
  );

  // Listen for Sanskrit audio completion
  useEffect(() => {
    if (
      state.status === "playing" &&
      state.currentSection === "sanskrit" &&
      audioPlayer.state === "completed"
    ) {
      advanceToNextSection(state.currentIndex);
    }
  }, [
    audioPlayer.state,
    state.status,
    state.currentSection,
    state.currentIndex,
    advanceToNextSection,
  ]);

  // Listen for TTS completion (for non-Sanskrit sections)
  useEffect(() => {
    if (
      state.status === "playing" &&
      state.currentSection !== "sanskrit" &&
      state.currentSection !== null &&
      tts.currentText === null &&
      tts.loadingText === null
    ) {
      // TTS finished, advance to next section
      // Small delay to ensure TTS truly completed
      const timer = setTimeout(() => {
        if (isActiveRef.current && state.status === "playing") {
          advanceToNextSection(state.currentIndex);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    tts.currentText,
    tts.loadingText,
    state.status,
    state.currentSection,
    state.currentIndex,
    advanceToNextSection,
  ]);

  /**
   * Start study mode
   */
  const start = useCallback(() => {
    if (availableSections.length === 0) return;

    // Stop any existing audio
    audioPlayer.stop();
    tts.stop();

    // Clear any pending timeout
    if (gapTimeoutRef.current) {
      clearTimeout(gapTimeoutRef.current);
    }

    isActiveRef.current = true;
    isPausedRef.current = false;

    // Start with first section
    const firstSection = availableSections[0];
    playSection(firstSection, 0);

    // Track analytics
    if (window.umami) {
      window.umami.track("study_mode_start", {
        verse: verse.canonical_id,
        sections: availableSections.length,
      });
    }
  }, [availableSections, verse.canonical_id, audioPlayer, tts, playSection]);

  /**
   * Stop study mode
   */
  const stop = useCallback(() => {
    isActiveRef.current = false;
    isPausedRef.current = false;

    if (gapTimeoutRef.current) {
      clearTimeout(gapTimeoutRef.current);
    }

    audioPlayer.stop();
    tts.stop();

    setState({
      status: "idle",
      currentSection: null,
      availableSections,
      currentIndex: -1,
    });

    if (window.umami) {
      window.umami.track("study_mode_stop", { verse: verse.canonical_id });
    }
  }, [availableSections, verse.canonical_id, audioPlayer, tts]);

  /**
   * Pause study mode
   */
  const pause = useCallback(() => {
    if (state.status !== "playing") return;

    isPausedRef.current = true;

    if (state.currentSection === "sanskrit") {
      audioPlayer.pause();
    } else {
      tts.stop(); // TTS doesn't support pause, must stop and restart
    }

    setState((prev) => ({
      ...prev,
      status: "paused",
    }));
  }, [state.status, state.currentSection, audioPlayer, tts]);

  /**
   * Resume study mode
   */
  const resume = useCallback(() => {
    if (state.status !== "paused" || state.currentSection === null) return;

    isPausedRef.current = false;

    if (state.currentSection === "sanskrit") {
      audioPlayer.resume();
      setState((prev) => ({
        ...prev,
        status: "playing",
      }));
    } else {
      // For TTS, need to restart the section
      playSection(state.currentSection, state.currentIndex);
    }
  }, [state.status, state.currentSection, state.currentIndex, audioPlayer, playSection]);

  return {
    state: {
      ...state,
      availableSections, // Always return current available sections
    },
    start,
    stop,
    pause,
    resume,
    canStart: availableSections.length > 0,
  };
}

/** Human-readable section labels */
export const SECTION_LABELS: Record<StudySection, string> = {
  sanskrit: "Sanskrit",
  english: "English",
  hindi: "Hindi",
  insight: "Insight",
};

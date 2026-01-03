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

import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { useAudioPlayer } from "../components/audio";
import { useTTSContext } from "../contexts/TTSContext";
import type { Verse, Translation } from "../types";

// ============================================================================
// Types
// ============================================================================

/** Section types in playback order */
export type StudySection = "sanskrit" | "english" | "hindi" | "insight";

/** Study mode states */
export type StudyModeStatus =
  | "idle"
  | "playing"
  | "paused"
  | "gap"
  | "completed";

/** Section order for playback */
const SECTION_ORDER: StudySection[] = [
  "sanskrit",
  "english",
  "hindi",
  "insight",
];

/** Gap duration between sections (ms) */
const SECTION_GAP_MS = 1500;

export interface StudyModeState {
  status: StudyModeStatus;
  currentSection: StudySection | null;
  availableSections: StudySection[];
  currentIndex: number;
}

export interface StudyModeConfig {
  verse: Verse;
  translations?: Translation[];
  onComplete?: () => void;
}

export interface StudyModeControls {
  state: StudyModeState;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  canStart: boolean;
}

/** Human-readable section labels */
export const SECTION_LABELS: Record<StudySection, string> = {
  sanskrit: "Sanskrit",
  english: "English",
  hindi: "Hindi",
  insight: "Insight",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get text content for a section (used for TTS)
 */
function getSectionText(
  section: StudySection,
  verse: Verse,
  translations?: Translation[]
): string | null {
  switch (section) {
    case "sanskrit":
      return null; // Sanskrit uses pre-recorded audio, not TTS
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
    if (section === "sanskrit") {
      return !!verse.audio_url;
    }
    return !!getSectionText(section, verse, translations);
  });
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStudyMode(config: StudyModeConfig): StudyModeControls {
  const { verse, translations, onComplete } = config;

  // External audio dependencies
  const audioPlayer = useAudioPlayer();
  const tts = useTTSContext();

  // Compute available sections for this verse
  const availableSections = getAvailableSections(verse, translations);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [state, setState] = useState<StudyModeState>({
    status: "idle",
    currentSection: null,
    availableSections,
    currentIndex: -1,
  });

  // -------------------------------------------------------------------------
  // Refs for tracking and cleanup
  // -------------------------------------------------------------------------

  const gapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);
  const isPausedRef = useRef(false);

  // Stable refs for config and sections to avoid stale closures in callbacks
  const configRef = useRef({ verse, translations, onComplete });
  const sectionsRef = useRef(availableSections);

  // Sync refs after render (useLayoutEffect ensures callbacks see fresh values)
  useLayoutEffect(() => {
    configRef.current = { verse, translations, onComplete };
    sectionsRef.current = availableSections;
  });

  // -------------------------------------------------------------------------
  // Core Playback Logic
  // -------------------------------------------------------------------------

  /**
   * Play a specific section by index
   * Uses refs to avoid circular dependencies
   */
  const playSectionByIndex = useCallback(
    (index: number) => {
      if (!isActiveRef.current) return;

      const sections = sectionsRef.current;
      if (index < 0 || index >= sections.length) return;

      const section = sections[index];
      const { verse: currentVerse, translations: currentTranslations } =
        configRef.current;

      setState((prev) => ({
        ...prev,
        status: "playing",
        currentSection: section,
        currentIndex: index,
      }));

      // Start playback based on section type
      if (section === "sanskrit") {
        if (currentVerse.audio_url) {
          audioPlayer.play(currentVerse.canonical_id, currentVerse.audio_url);
        }
      } else {
        const text = getSectionText(section, currentVerse, currentTranslations);
        if (text) {
          const lang = section === "hindi" ? "hi" : "en";
          tts.speak(text, { lang }).catch((error) => {
            console.error(`[StudyMode] TTS error for ${section}:`, error);
            // Error handling is done via effects watching TTS state
          });
        }
      }
    },
    [audioPlayer, tts]
  );

  /**
   * Advance to the next section after current one completes
   */
  const advanceToNextSection = useCallback(() => {
    if (!isActiveRef.current) return;

    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;
      const sections = sectionsRef.current;

      if (nextIndex >= sections.length) {
        // Study mode complete
        isActiveRef.current = false;
        configRef.current.onComplete?.();
        return {
          ...prev,
          status: "completed" as const,
          currentSection: null,
          currentIndex: -1,
        };
      }

      // Enter gap state before next section
      return {
        ...prev,
        status: "gap" as const,
      };
    });
  }, []);

  // -------------------------------------------------------------------------
  // Gap Timer: Play next section after gap
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (state.status !== "gap") return;

    const nextIndex = state.currentIndex + 1;
    const sections = sectionsRef.current;

    if (nextIndex >= sections.length) return;

    gapTimeoutRef.current = setTimeout(() => {
      if (isActiveRef.current && !isPausedRef.current) {
        playSectionByIndex(nextIndex);
      }
    }, SECTION_GAP_MS);

    return () => {
      if (gapTimeoutRef.current) {
        clearTimeout(gapTimeoutRef.current);
      }
    };
  }, [state.status, state.currentIndex, playSectionByIndex]);

  // -------------------------------------------------------------------------
  // Audio Completion Detection
  // -------------------------------------------------------------------------

  // Sanskrit audio completion (via AudioPlayer)
  useEffect(() => {
    const isSanskritPlaying =
      state.status === "playing" && state.currentSection === "sanskrit";

    if (isSanskritPlaying && audioPlayer.state === "completed") {
      advanceToNextSection();
    }
  }, [
    audioPlayer.state,
    state.status,
    state.currentSection,
    advanceToNextSection,
  ]);

  // TTS completion (for English, Hindi, Insight)
  useEffect(() => {
    const isTTSSection =
      state.status === "playing" &&
      state.currentSection !== null &&
      state.currentSection !== "sanskrit";

    const isTTSIdle = tts.currentText === null && tts.loadingText === null;

    if (isTTSSection && isTTSIdle) {
      // Small delay to ensure TTS truly completed
      const timer = setTimeout(() => {
        if (isActiveRef.current && state.status === "playing") {
          advanceToNextSection();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    tts.currentText,
    tts.loadingText,
    state.status,
    state.currentSection,
    advanceToNextSection,
  ]);

  // -------------------------------------------------------------------------
  // Update available sections when verse changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    const newSections = getAvailableSections(verse, translations);
    setState((prev) => ({
      ...prev,
      availableSections: newSections,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only recompute when verse ID changes, not on every verse object reference
  }, [verse.canonical_id, translations]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (gapTimeoutRef.current) {
        clearTimeout(gapTimeoutRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Public Controls
  // -------------------------------------------------------------------------

  const start = useCallback(() => {
    if (sectionsRef.current.length === 0) return;

    // Stop any existing audio
    audioPlayer.stop();
    tts.stop();

    // Clear any pending timeout
    if (gapTimeoutRef.current) {
      clearTimeout(gapTimeoutRef.current);
    }

    // Activate study mode
    isActiveRef.current = true;
    isPausedRef.current = false;

    // Start with first section
    playSectionByIndex(0);

    // Analytics
    if (window.umami) {
      window.umami.track("study_mode_start", {
        verse: configRef.current.verse.canonical_id,
        sections: sectionsRef.current.length,
      });
    }
  }, [audioPlayer, tts, playSectionByIndex]);

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
      availableSections: sectionsRef.current,
      currentIndex: -1,
    });

    if (window.umami) {
      window.umami.track("study_mode_stop", {
        verse: configRef.current.verse.canonical_id,
      });
    }
  }, [audioPlayer, tts]);

  const pause = useCallback(() => {
    if (state.status !== "playing") return;

    isPausedRef.current = true;

    if (state.currentSection === "sanskrit") {
      audioPlayer.pause();
    } else {
      tts.stop(); // TTS doesn't support pause, must stop
    }

    setState((prev) => ({
      ...prev,
      status: "paused",
    }));
  }, [state.status, state.currentSection, audioPlayer, tts]);

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
      // TTS must restart the section
      playSectionByIndex(state.currentIndex);
    }
  }, [
    state.status,
    state.currentSection,
    state.currentIndex,
    audioPlayer,
    playSectionByIndex,
  ]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    state: {
      ...state,
      availableSections, // Always return fresh available sections
    },
    start,
    stop,
    pause,
    resume,
    canStart: availableSections.length > 0,
  };
}

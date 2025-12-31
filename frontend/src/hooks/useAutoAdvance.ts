/**
 * useAutoAdvance - Reusable hook for auto-advance modes (audio/text)
 *
 * Extracted from DhyanamPage for reuse in ReadingMode (Phase 3.7).
 *
 * Features:
 * - Audio mode: Plays audio, advances after completion + 800ms pause
 * - Text mode: Timer-based at 80% of audio duration
 * - Manual navigation stops auto-mode
 * - Pause/resume support for both modes
 * - Analytics tracking via Umami
 *
 * Usage:
 * ```tsx
 * const {
 *   mode,
 *   isPaused,
 *   progress,
 *   startAudioMode,
 *   startTextMode,
 *   pause,
 *   resume,
 *   stop,
 *   handleManualNavigation,
 * } = useAutoAdvance({
 *   currentIndex,
 *   totalCount,
 *   audioUrl,
 *   durationMs,
 *   audioId,
 *   onAdvance: (nextIndex) => setCurrentIndex(nextIndex),
 *   onComplete: () => setPageState("completed"),
 * });
 * ```
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useAudioPlayer,
  ADVANCE_DELAY_MS,
  PRELOAD_THRESHOLD,
} from "../components/audio";
import { preloadAudio } from "../lib/audioPreload";

/** Auto-advance mode */
export type AutoAdvanceMode = "off" | "audio" | "text";

/** Configuration for useAutoAdvance hook */
export interface UseAutoAdvanceConfig {
  /** Current verse/item index (0-based) */
  currentIndex: number;
  /** Total number of verses/items */
  totalCount: number;
  /** Audio URL for current verse (required for audio mode) */
  audioUrl: string | null | undefined;
  /** Audio duration in milliseconds (required for text mode timing) */
  durationMs: number | null | undefined;
  /** Unique audio ID for current verse */
  audioId: string;
  /** Callback when advancing to next verse */
  onAdvance: (nextIndex: number) => void;
  /** Callback when reaching end of sequence */
  onComplete: () => void;
  /** Optional callback when mode changes */
  onModeChange?: (mode: AutoAdvanceMode) => void;
  /** Optional delay between verses in ms (default: ADVANCE_DELAY_MS) */
  advanceDelayMs?: number;
  /** Optional text mode duration scaling (default: 0.8 = 80% of audio duration) */
  textModeScale?: number;
  /** Next verse audio URL (for preloading) */
  nextAudioUrl?: string | null | undefined;
}

/** Return value from useAutoAdvance hook */
export interface UseAutoAdvanceReturn {
  /** Current mode: "off" | "audio" | "text" */
  mode: AutoAdvanceMode;
  /** Whether currently paused (audio or text mode) */
  isPaused: boolean;
  /** Is any mode currently active? */
  isActive: boolean;
  /** Progress 0-100 for text mode, 0-1 for audio mode */
  progress: number;
  /** Text mode progress 0-100 (for display) */
  textModeProgress: number;
  /** Audio player current time in ms */
  currentTime: number;
  /** Audio player duration in ms */
  audioDuration: number;
  /** Audio player state */
  audioState: "idle" | "loading" | "playing" | "paused" | "completed" | "error";
  /** Is audio currently playing? */
  isPlaying: boolean;
  /** Start audio mode from current verse */
  startAudioMode: () => void;
  /** Start text mode from current verse */
  startTextMode: () => void;
  /** Pause current mode */
  pause: () => void;
  /** Resume current mode */
  resume: () => void;
  /** Stop and return to idle */
  stop: () => void;
  /** Call when user navigates manually (stops auto-mode) */
  handleManualNavigation: () => void;
}

/**
 * Hook for auto-advance functionality in reading modes.
 *
 * Supports two modes:
 * - Audio mode: Plays audio, advances to next verse after audio completes + delay
 * - Text mode: Timer-based advancement using 80% of audio duration
 *
 * Both modes pause on manual navigation and support pause/resume.
 */
export function useAutoAdvance(
  config: UseAutoAdvanceConfig,
): UseAutoAdvanceReturn {
  const {
    currentIndex,
    totalCount,
    audioUrl,
    durationMs,
    audioId,
    onAdvance,
    onComplete,
    onModeChange,
    advanceDelayMs = ADVANCE_DELAY_MS,
    textModeScale = 0.8,
    nextAudioUrl,
  } = config;

  // Core state
  const [mode, setMode] = useState<AutoAdvanceMode>("off");
  const [isPausedState, setIsPausedState] = useState(false);
  const [textModeProgress, setTextModeProgress] = useState(0);
  const [justAdvanced, setJustAdvanced] = useState(false);

  // Audio player
  const {
    currentlyPlaying,
    state: audioState,
    progress: audioProgress,
    currentTime,
    duration: audioDuration,
    play,
    pause: pauseAudio,
    resume: resumeAudio,
    stop: stopAudio,
  } = useAudioPlayer();

  // Refs for timers
  const textModeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textModeAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioModeAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to track elapsed time in text mode (for pause/resume)
  const textModeElapsedRef = useRef<number>(0);

  // Refs for tracking state in callbacks (avoids stale closures)
  const textModeActiveRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);
  const modeRef = useRef<AutoAdvanceMode>(mode);
  const textAdvanceScheduledForRef = useRef<number | null>(null);
  const audioAdvanceScheduledForRef = useRef<number | null>(null);
  const processedAudioCompletionRef = useRef<string | null>(null);
  const audioStartedPlayingRef = useRef<string | null>(null);

  // Update refs when values change
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    modeRef.current = mode;
    textModeActiveRef.current = mode === "text" && !isPausedState;
    onModeChange?.(mode);
  }, [mode, isPausedState, onModeChange]);

  // Reset tracking refs when index changes
  useEffect(() => {
    textAdvanceScheduledForRef.current = null;
    audioAdvanceScheduledForRef.current = null;
    processedAudioCompletionRef.current = null;
    audioStartedPlayingRef.current = null;

    // Clear pending advance timers
    if (textModeAdvanceTimerRef.current) {
      clearTimeout(textModeAdvanceTimerRef.current);
      textModeAdvanceTimerRef.current = null;
    }
    if (audioModeAdvanceTimerRef.current) {
      clearTimeout(audioModeAdvanceTimerRef.current);
      audioModeAdvanceTimerRef.current = null;
    }
  }, [currentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (textModeIntervalRef.current)
        clearInterval(textModeIntervalRef.current);
      if (textModeAdvanceTimerRef.current)
        clearTimeout(textModeAdvanceTimerRef.current);
      if (audioModeAdvanceTimerRef.current)
        clearTimeout(audioModeAdvanceTimerRef.current);
    };
  }, []);

  // Preload next audio at PRELOAD_THRESHOLD progress (audio mode only)
  const preloadTriggeredRef = useRef(false);
  useEffect(() => {
    // Only preload in audio mode when playing
    if (mode !== "audio" || !nextAudioUrl) {
      preloadTriggeredRef.current = false;
      return;
    }

    // Trigger preload at threshold progress (only once per verse)
    if (audioProgress > PRELOAD_THRESHOLD && !preloadTriggeredRef.current) {
      preloadTriggeredRef.current = true;
      preloadAudio(nextAudioUrl);
    }
  }, [mode, audioProgress, nextAudioUrl]);

  // Reset preload flag when verse changes
  useEffect(() => {
    preloadTriggeredRef.current = false;
  }, [currentIndex]);

  // Audio state derived values
  const isPlaying = currentlyPlaying === audioId && audioState === "playing";
  const isAudioPaused = currentlyPlaying === audioId && audioState === "paused";
  const isAudioCompleted =
    currentlyPlaying === audioId && audioState === "completed";

  // Combined pause state
  const isPaused = mode === "audio" ? isAudioPaused : isPausedState;
  const isActive = mode !== "off";

  // Text mode timer logic
  useEffect(() => {
    if (mode !== "text" || isPausedState || !durationMs) {
      return;
    }

    const verseDuration = durationMs * textModeScale;
    // Account for previously elapsed time (from pause/resume)
    const previouslyElapsed = textModeElapsedRef.current;
    const startTime = Date.now() - previouslyElapsed;
    const effectStartIndex = currentIndexRef.current;

    textModeIntervalRef.current = setInterval(() => {
      if (!textModeActiveRef.current) {
        if (textModeIntervalRef.current) {
          clearInterval(textModeIntervalRef.current);
          textModeIntervalRef.current = null;
        }
        return;
      }

      if (currentIndexRef.current !== effectStartIndex) {
        if (textModeIntervalRef.current) {
          clearInterval(textModeIntervalRef.current);
          textModeIntervalRef.current = null;
        }
        return;
      }

      const elapsed = Date.now() - startTime;
      // Save elapsed time for potential pause
      textModeElapsedRef.current = elapsed;
      const newProgress = (elapsed / verseDuration) * 100;

      if (newProgress >= 100) {
        if (textModeIntervalRef.current) {
          clearInterval(textModeIntervalRef.current);
          textModeIntervalRef.current = null;
        }
        setTextModeProgress(100);

        if (textAdvanceScheduledForRef.current === effectStartIndex) {
          return;
        }
        textAdvanceScheduledForRef.current = effectStartIndex;

        textModeAdvanceTimerRef.current = setTimeout(() => {
          if (!textModeActiveRef.current) return;
          if (currentIndexRef.current !== effectStartIndex) return;

          if (effectStartIndex < totalCount - 1) {
            // Reset elapsed time for next verse
            textModeElapsedRef.current = 0;
            setTextModeProgress(0);
            onAdvance(effectStartIndex + 1);
          } else {
            // Track completion (Read mode)
            if (window.umami) {
              window.umami.track("auto_advance_complete", {
                mode: "text",
                total_count: totalCount,
              });
            }
            textModeElapsedRef.current = 0;
            setMode("off");
            onComplete();
          }
        }, advanceDelayMs);
      } else {
        setTextModeProgress(newProgress);
      }
    }, 100);

    return () => {
      if (textModeIntervalRef.current) {
        clearInterval(textModeIntervalRef.current);
        textModeIntervalRef.current = null;
      }
    };
  }, [
    mode,
    isPausedState,
    durationMs,
    totalCount,
    advanceDelayMs,
    textModeScale,
    onAdvance,
    onComplete,
  ]);

  // Audio mode: Handle audio completion → auto-advance
  useEffect(() => {
    if (mode !== "audio" || !isAudioCompleted) {
      return;
    }

    // Verify audio actually played
    if (audioProgress < 0.1) {
      return;
    }

    // Only process if we started playing this audio
    if (audioStartedPlayingRef.current !== audioId) {
      return;
    }

    // Check if already processed
    if (processedAudioCompletionRef.current === audioId) {
      return;
    }

    if (audioAdvanceScheduledForRef.current === currentIndex) {
      return;
    }

    processedAudioCompletionRef.current = audioId;
    audioAdvanceScheduledForRef.current = currentIndex;

    const advanceFromIndex = currentIndex;

    audioModeAdvanceTimerRef.current = setTimeout(() => {
      if (currentIndexRef.current !== advanceFromIndex) return;
      if (modeRef.current !== "audio") return;

      if (advanceFromIndex < totalCount - 1) {
        setJustAdvanced(true);
        onAdvance(advanceFromIndex + 1);
      } else {
        // Track completion (Listen mode)
        if (window.umami) {
          window.umami.track("auto_advance_complete", {
            mode: "audio",
            total_count: totalCount,
          });
        }
        setMode("off");
        stopAudio();
        onComplete();
      }
    }, advanceDelayMs);
  }, [
    isAudioCompleted,
    mode,
    currentIndex,
    audioId,
    totalCount,
    advanceDelayMs,
    audioProgress,
    onAdvance,
    onComplete,
    stopAudio,
  ]);

  // Auto-play next verse after advancing (audio mode only)
  useEffect(() => {
    if (justAdvanced && mode === "audio" && audioUrl) {
      const timer = setTimeout(() => {
        audioStartedPlayingRef.current = audioId;
        play(audioId, audioUrl);
        setJustAdvanced(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [justAdvanced, mode, audioUrl, audioId, play]);

  // Stop all modes helper
  const stopAllModes = useCallback(
    (isCompletion = false) => {
      // Track stop event (only if mode was active and not a natural completion)
      if (modeRef.current !== "off" && !isCompletion && window.umami) {
        window.umami.track("auto_advance_stop", {
          mode: modeRef.current,
          stopped_at_index: currentIndexRef.current,
          total_count: totalCount,
          progress_percent: Math.round(
            (currentIndexRef.current / totalCount) * 100,
          ),
        });
      }

      textModeActiveRef.current = false;
      stopAudio();

      if (textModeAdvanceTimerRef.current) {
        clearTimeout(textModeAdvanceTimerRef.current);
        textModeAdvanceTimerRef.current = null;
      }
      if (textModeIntervalRef.current) {
        clearInterval(textModeIntervalRef.current);
        textModeIntervalRef.current = null;
      }
      if (audioModeAdvanceTimerRef.current) {
        clearTimeout(audioModeAdvanceTimerRef.current);
        audioModeAdvanceTimerRef.current = null;
      }

      textAdvanceScheduledForRef.current = null;
      audioAdvanceScheduledForRef.current = null;
      processedAudioCompletionRef.current = null;
      audioStartedPlayingRef.current = null;
      textModeElapsedRef.current = 0;

      setMode("off");
      setIsPausedState(false);
      setTextModeProgress(0);
      setJustAdvanced(false);
    },
    [stopAudio, totalCount],
  );

  // Public API
  const startAudioMode = useCallback(() => {
    if (!audioUrl) return;
    audioStartedPlayingRef.current = audioId;
    setMode("audio");
    setIsPausedState(false);
    play(audioId, audioUrl);

    // Track auto-advance start (Listen mode)
    if (window.umami) {
      window.umami.track("auto_advance_start", {
        mode: "audio",
        start_index: currentIndexRef.current,
        total_count: totalCount,
      });
    }
  }, [audioUrl, audioId, play, totalCount]);

  const startTextMode = useCallback(() => {
    if (!durationMs) return;
    // Reset elapsed time for fresh start
    textModeElapsedRef.current = 0;
    setMode("text");
    setIsPausedState(false);
    setTextModeProgress(0);

    // Track auto-advance start (Read mode)
    if (window.umami) {
      window.umami.track("auto_advance_start", {
        mode: "text",
        start_index: currentIndexRef.current,
        total_count: totalCount,
      });
    }
  }, [durationMs, totalCount]);

  const pause = useCallback(() => {
    if (mode === "audio") {
      pauseAudio();
    } else if (mode === "text") {
      setIsPausedState(true);
      if (textModeAdvanceTimerRef.current)
        clearTimeout(textModeAdvanceTimerRef.current);
      if (textModeIntervalRef.current)
        clearInterval(textModeIntervalRef.current);
    }
  }, [mode, pauseAudio]);

  const resume = useCallback(() => {
    if (mode === "audio") {
      resumeAudio();
    } else if (mode === "text") {
      setIsPausedState(false);
      // Timer will restart via useEffect
    }
  }, [mode, resumeAudio]);

  const stop = useCallback(() => {
    stopAllModes();
  }, [stopAllModes]);

  const handleManualNavigation = useCallback(() => {
    stopAllModes();
  }, [stopAllModes]);

  return {
    mode,
    isPaused,
    isActive,
    progress: mode === "text" ? textModeProgress : audioProgress * 100,
    textModeProgress,
    currentTime,
    audioDuration,
    audioState,
    isPlaying,
    startAudioMode,
    startTextMode,
    pause,
    resume,
    stop,
    handleManualNavigation,
  };
}

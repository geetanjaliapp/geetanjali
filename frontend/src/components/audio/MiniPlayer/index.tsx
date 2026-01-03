/**
 * MiniPlayer Component (v1.19.0)
 *
 * Compact audio player for Reading Mode.
 * Shows in bottom bar when verse has audio available.
 *
 * ## Sub-components
 * - MiniPlayerPlayButton: Reusable play/pause button
 * - MiniPlayerSinglePlay: Single verse play mode UI
 * - MiniPlayerAutoAdvance: Auto-advance active mode UI
 * - MiniPlayerModeSelector: Listen/Read mode selection
 * - MiniPlayerStandard: Original single-verse UI
 *
 * Features:
 * - Play/pause with progress bar
 * - Playback speed control
 * - Loop toggle for memorization
 * - Auto-advance modes: Listen (audio) and Read (text timer)
 * - Continuous playback across chapters
 *
 * Uses design tokens for theming support.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "../AudioPlayerContext";
import { useAudioCached } from "../../../hooks";
import type { AutoAdvanceMode } from "../../../hooks/useAutoAdvance";

// Sub-components
import { MiniPlayerSinglePlay } from "./MiniPlayerSinglePlay";
import { MiniPlayerAutoAdvance } from "./MiniPlayerAutoAdvance";
import { MiniPlayerModeSelector } from "./MiniPlayerModeSelector";
import { MiniPlayerStandard } from "./MiniPlayerStandard";

// Re-export sub-components for external use
export { MiniPlayerPlayButton } from "./MiniPlayerPlayButton";
export { MiniPlayerSinglePlay } from "./MiniPlayerSinglePlay";
export { MiniPlayerAutoAdvance } from "./MiniPlayerAutoAdvance";
export { MiniPlayerModeSelector } from "./MiniPlayerModeSelector";
export { MiniPlayerStandard } from "./MiniPlayerStandard";

/** Live region announcement for screen readers */
function useLiveAnnouncement() {
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message: string) => {
    // Clear first to ensure re-announcement of same message
    setAnnouncement("");
    setTimeout(() => setAnnouncement(message), 50);
  }, []);

  return { announcement, announce };
}

interface MiniPlayerProps {
  /** Verse canonical ID */
  verseId: string;
  /** Audio URL */
  audioUrl: string;
  /** Auto-play audio when verse changes */
  autoPlay?: boolean;
  /** Called when audio ends */
  onEnded?: () => void;
}

/** Extended props for auto-advance mode */
interface AutoAdvanceMiniPlayerProps extends MiniPlayerProps {
  /** Current auto-advance mode */
  autoAdvanceMode: AutoAdvanceMode;
  /** Whether auto-advance is paused */
  isAutoAdvancePaused: boolean;
  /** Text mode progress (0-100) */
  textModeProgress: number;
  /** Audio duration in ms (for text mode display) */
  durationMs: number | null | undefined;
  /** Current verse position in chapter */
  versePosition: { current: number; total: number };
  /** Callback to start audio mode */
  onStartAudioMode: () => void;
  /** Callback to start text mode */
  onStartTextMode: () => void;
  /** Callback to pause auto-advance */
  onPauseAutoAdvance: () => void;
  /** Callback to resume auto-advance */
  onResumeAutoAdvance: () => void;
  /** Callback to stop auto-advance */
  onStopAutoAdvance: () => void;
  /** Single-play mode - triggered by header play button */
  singlePlayMode?: boolean;
  /** Callback to exit single-play mode */
  onExitSinglePlay?: () => void;
  /** Continuous playback: auto-advance to next chapter */
  continuousPlayback?: boolean;
  /** Callback to toggle continuous playback */
  onToggleContinuousPlayback?: () => void;
}

/** Type guard to check if props include auto-advance features */
function isAutoAdvanceProps(
  props: MiniPlayerProps | AutoAdvanceMiniPlayerProps
): props is AutoAdvanceMiniPlayerProps {
  return "autoAdvanceMode" in props;
}

export function MiniPlayer(
  props: MiniPlayerProps | AutoAdvanceMiniPlayerProps
) {
  const { verseId, audioUrl, autoPlay = false, onEnded } = props;

  const {
    currentlyPlaying,
    state,
    progress,
    currentTime,
    duration,
    error,
    playbackSpeed,
    isLooping,
    play,
    pause,
    resume,
    seek,
    setPlaybackSpeed,
    toggleLoop,
    retry,
  } = useAudioPlayer();

  const isThisPlaying = currentlyPlaying === verseId;
  const isActive =
    isThisPlaying &&
    (state === "playing" ||
      state === "paused" ||
      state === "loading" ||
      state === "completed");
  const isIdle = !isThisPlaying || state === "idle";
  const prevVerseIdRef = useRef(verseId);
  const hasCalledOnEndedRef = useRef(false);

  // Check if audio is cached for offline playback
  const { isCached: isAudioCached } = useAudioCached(audioUrl);

  // Auto-advance mode detection
  const hasAutoAdvance = isAutoAdvanceProps(props);
  const autoAdvanceMode = hasAutoAdvance ? props.autoAdvanceMode : "off";
  const isAutoAdvanceActive = autoAdvanceMode !== "off";
  const isAutoAdvancePaused = hasAutoAdvance
    ? props.isAutoAdvancePaused
    : false;

  // Single-play mode
  const singlePlayMode = hasAutoAdvance
    ? props.singlePlayMode || false
    : false;
  const onExitSinglePlay = hasAutoAdvance ? props.onExitSinglePlay : undefined;

  // Live region for screen reader announcements
  const { announcement, announce } = useLiveAnnouncement();
  const prevModeRef = useRef(autoAdvanceMode);

  // Announce mode changes for screen readers
  useEffect(() => {
    if (prevModeRef.current !== autoAdvanceMode) {
      if (autoAdvanceMode === "audio" && hasAutoAdvance) {
        announce(
          `Listen mode started, verse ${props.versePosition.current} of ${props.versePosition.total}`
        );
      } else if (autoAdvanceMode === "text" && hasAutoAdvance) {
        announce(
          `Read mode started, verse ${props.versePosition.current} of ${props.versePosition.total}`
        );
      } else if (autoAdvanceMode === "off" && prevModeRef.current !== "off") {
        announce("Auto-advance stopped");
      }
      prevModeRef.current = autoAdvanceMode;
    }
  }, [autoAdvanceMode, hasAutoAdvance, announce, props]);

  // Handle play/pause for single verse mode (non-auto-advance)
  const handlePlayPause = useCallback(() => {
    if (isThisPlaying) {
      if (state === "playing") {
        pause();
      } else if (state === "paused") {
        resume();
      } else if (state === "error") {
        retry();
      }
    } else {
      play(verseId, audioUrl);
    }
  }, [isThisPlaying, state, pause, resume, retry, play, verseId, audioUrl]);

  // Auto-play when verse changes (non-auto-advance mode only)
  useEffect(() => {
    if (
      !isAutoAdvanceActive &&
      autoPlay &&
      verseId !== prevVerseIdRef.current
    ) {
      prevVerseIdRef.current = verseId;
      const timer = setTimeout(() => {
        play(verseId, audioUrl);
      }, 300);
      return () => clearTimeout(timer);
    }
    prevVerseIdRef.current = verseId;
  }, [verseId, audioUrl, autoPlay, play, isAutoAdvanceActive]);

  // Notify when audio ends
  useEffect(() => {
    if (
      isThisPlaying &&
      state === "completed" &&
      !hasCalledOnEndedRef.current
    ) {
      hasCalledOnEndedRef.current = true;
      onEnded?.();
    } else if (state === "playing") {
      hasCalledOnEndedRef.current = false;
    }
  }, [isThisPlaying, state, onEnded]);

  // Calculate display values for text mode
  const getTextModeDisplay = () => {
    if (!hasAutoAdvance || !props.durationMs) return { time: 0, total: 0 };
    const textModeDuration = props.durationMs * 0.8; // 80% scaling
    const time = Math.floor((props.textModeProgress / 100) * textModeDuration);
    return { time, total: textModeDuration };
  };

  // Render single-play mode UI
  if (singlePlayMode && isThisPlaying) {
    return (
      <MiniPlayerSinglePlay
        state={state}
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        error={error}
        playbackSpeed={playbackSpeed}
        onPlayPause={handlePlayPause}
        onSeek={seek}
        onSpeedChange={setPlaybackSpeed}
        onClose={onExitSinglePlay}
      />
    );
  }

  // Render auto-advance mode UI
  if (hasAutoAdvance && isAutoAdvanceActive) {
    const textDisplay = getTextModeDisplay();
    const displayProgress =
      autoAdvanceMode === "text" ? props.textModeProgress : progress * 100;
    const displayTime =
      autoAdvanceMode === "text" ? textDisplay.time / 1000 : currentTime;
    const displayDuration =
      autoAdvanceMode === "text" ? textDisplay.total / 1000 : duration;
    const isAudioLoading = autoAdvanceMode === "audio" && state === "loading";

    return (
      <>
        <MiniPlayerAutoAdvance
          mode={autoAdvanceMode as Exclude<AutoAdvanceMode, "off">}
          isPaused={isAutoAdvancePaused}
          isLoading={isAudioLoading}
          progress={displayProgress}
          currentTime={displayTime}
          totalDuration={displayDuration}
          versePosition={props.versePosition}
          playbackSpeed={playbackSpeed}
          onResume={props.onResumeAutoAdvance}
          onPause={props.onPauseAutoAdvance}
          onStop={props.onStopAutoAdvance}
          onSpeedChange={setPlaybackSpeed}
        />
        {/* Live region for screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </div>
      </>
    );
  }

  // Render auto-advance mode selection (idle state with Listen/Read buttons)
  if (hasAutoAdvance && !isAutoAdvanceActive && !singlePlayMode) {
    return (
      <MiniPlayerModeSelector
        versePosition={props.versePosition}
        onStartAudioMode={props.onStartAudioMode}
        onStartTextMode={props.onStartTextMode}
      />
    );
  }

  // Original single-verse mode UI (backwards compatible)
  return (
    <>
      <MiniPlayerStandard
        state={state}
        isThisPlaying={isThisPlaying}
        isIdle={isIdle}
        isActive={isActive}
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        error={error}
        playbackSpeed={playbackSpeed}
        isLooping={isLooping}
        isAudioCached={isAudioCached}
        onPlayPause={handlePlayPause}
        onSeek={seek}
        onSpeedChange={setPlaybackSpeed}
        onToggleLoop={toggleLoop}
        continuousPlayback={
          hasAutoAdvance ? props.continuousPlayback : undefined
        }
        onToggleContinuousPlayback={
          hasAutoAdvance ? props.onToggleContinuousPlayback : undefined
        }
        showContinuousPlayback={
          hasAutoAdvance &&
          props.autoAdvanceMode === "audio" &&
          !!props.onToggleContinuousPlayback
        }
      />
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </>
  );
}

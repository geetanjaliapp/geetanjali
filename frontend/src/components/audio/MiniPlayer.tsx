/**
 * MiniPlayer Component (v1.17.0)
 *
 * Compact audio player for Reading Mode.
 * Shows in bottom bar when verse has audio available.
 *
 * Features:
 * - Play/pause with progress bar
 * - Playback speed control
 * - Loop toggle for memorization
 * - Auto-advance modes: Listen (audio) and Read (text timer) [Phase 3.7]
 *
 * Uses design tokens for theming support.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "./AudioPlayerContext";
import { AudioProgress } from "./AudioProgress";
import { AudioSpeedControl } from "./AudioSpeedControl";
import { formatTime } from "./audioUtils";
import {
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
  RepeatIcon,
  AlertCircleIcon,
  CheckIcon,
  SkipForwardIcon,
} from "../icons";
import type { AutoAdvanceMode } from "../../hooks/useAutoAdvance";

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

/** Extended props for auto-advance mode (Phase 3.7) */
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
  /** Single-play mode (Phase 3.7b) - triggered by header play button */
  singlePlayMode?: boolean;
  /** Callback to exit single-play mode */
  onExitSinglePlay?: () => void;
  /** Continuous playback: auto-advance to next chapter (Phase 1.19.0) */
  continuousPlayback?: boolean;
  /** Callback to toggle continuous playback */
  onToggleContinuousPlayback?: () => void;
}

/** Type guard to check if props include auto-advance features */
function isAutoAdvanceProps(
  props: MiniPlayerProps | AutoAdvanceMiniPlayerProps,
): props is AutoAdvanceMiniPlayerProps {
  return "autoAdvanceMode" in props;
}

export function MiniPlayer(
  props: MiniPlayerProps | AutoAdvanceMiniPlayerProps,
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

  // Auto-advance mode detection
  const hasAutoAdvance = isAutoAdvanceProps(props);
  const autoAdvanceMode = hasAutoAdvance ? props.autoAdvanceMode : "off";
  const isAutoAdvanceActive = autoAdvanceMode !== "off";
  const isAutoAdvancePaused = hasAutoAdvance
    ? props.isAutoAdvancePaused
    : false;

  // Single-play mode (Phase 3.7b)
  const singlePlayMode = hasAutoAdvance ? props.singlePlayMode || false : false;
  const onExitSinglePlay = hasAutoAdvance ? props.onExitSinglePlay : undefined;

  // Ref for single-play container (for focus management)
  const singlePlayContainerRef = useRef<HTMLDivElement>(null);

  // Live region for screen reader announcements
  const { announcement, announce } = useLiveAnnouncement();
  const prevModeRef = useRef(autoAdvanceMode);

  // Announce mode changes for screen readers
  useEffect(() => {
    if (prevModeRef.current !== autoAdvanceMode) {
      if (autoAdvanceMode === "audio" && hasAutoAdvance) {
        announce(
          `Listen mode started, verse ${props.versePosition.current} of ${props.versePosition.total}`,
        );
      } else if (autoAdvanceMode === "text" && hasAutoAdvance) {
        announce(
          `Read mode started, verse ${props.versePosition.current} of ${props.versePosition.total}`,
        );
      } else if (autoAdvanceMode === "off" && prevModeRef.current !== "off") {
        announce("Auto-advance stopped");
      }
      prevModeRef.current = autoAdvanceMode;
    }
  }, [autoAdvanceMode, hasAutoAdvance, announce, props]);

  // Auto-focus single-play container when it appears (accessibility)
  useEffect(() => {
    if (singlePlayMode && isThisPlaying && singlePlayContainerRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        singlePlayContainerRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [singlePlayMode, isThisPlaying]);

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

  // Render single-play mode UI (Phase 3.7b)
  if (singlePlayMode && isThisPlaying) {
    return (
      <div
        ref={singlePlayContainerRef}
        tabIndex={-1}
        className="bg-[var(--surface-reading-header)] border-t border-[var(--border-reading)] px-4 py-2 focus:outline-none"
        role="region"
        aria-label="Single verse player. Press Space to pause, Escape to close."
        aria-live="polite"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              disabled={state === "loading"}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] hover:opacity-90 transition-[var(--transition-button)] flex items-center justify-center disabled:opacity-70"
              aria-label={
                state === "loading"
                  ? "Loading"
                  : state === "playing"
                    ? "Pause"
                    : "Play"
              }
            >
              {state === "loading" ? (
                <SpinnerIcon className="w-5 h-5" />
              ) : state === "playing" ? (
                <PauseIcon className="w-5 h-5" />
              ) : state === "completed" ? (
                <CheckIcon className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5" />
              )}
            </button>

            {/* Progress bar */}
            <div className="flex-1 min-w-0">
              {state === "error" ? (
                <span className="text-xs text-[var(--status-error)]">
                  {error}
                </span>
              ) : (
                <AudioProgress
                  progress={progress}
                  currentTime={currentTime}
                  duration={duration}
                  disabled={state === "loading"}
                  onSeek={seek}
                  showTime
                  compact
                />
              )}
            </div>

            {/* Speed Control */}
            <AudioSpeedControl
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              compact
            />

            {/* Close button */}
            <button
              onClick={onExitSinglePlay}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-[var(--radius-button)] text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)] transition-[var(--transition-button)] flex items-center justify-center"
              aria-label="Close player"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render auto-advance mode UI
  if (hasAutoAdvance && isAutoAdvanceActive) {
    const textDisplay = getTextModeDisplay();
    const displayProgress =
      autoAdvanceMode === "text" ? props.textModeProgress : progress * 100;
    // Audio mode: currentTime/duration are in seconds
    // Text mode: values are in ms, convert to seconds for formatTime
    const displayTime =
      autoAdvanceMode === "text" ? textDisplay.time / 1000 : currentTime;
    const displayDuration =
      autoAdvanceMode === "text" ? textDisplay.total / 1000 : duration;
    const isAudioLoading = autoAdvanceMode === "audio" && state === "loading";

    return (
      <div
        className="bg-[var(--surface-reading-header)] border-t border-[var(--border-reading)] px-4 py-2.5"
        role="region"
        aria-label="Auto-advance player"
      >
        <div className="max-w-4xl mx-auto">
          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-reading-tertiary)]">
              <span className="w-10 text-right font-mono">
                {formatTime(displayTime)}
              </span>
              <div className="flex-1 h-1.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--interactive-primary)] transition-all duration-100"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
              <span className="w-10 font-mono">
                {formatTime(displayDuration)}
              </span>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Pause/Play + Stop */}
            <div className="flex items-center gap-1">
              {/* Pause/Play/Loading */}
              <button
                onClick={
                  isAutoAdvancePaused
                    ? props.onResumeAutoAdvance
                    : props.onPauseAutoAdvance
                }
                disabled={isAudioLoading}
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] hover:opacity-90 transition-[var(--transition-button)] flex items-center justify-center disabled:opacity-70"
                aria-label={
                  isAudioLoading
                    ? "Loading"
                    : isAutoAdvancePaused
                      ? "Resume"
                      : "Pause"
                }
              >
                {isAudioLoading ? (
                  <SpinnerIcon className="w-5 h-5" />
                ) : isAutoAdvancePaused ? (
                  <PlayIcon className="w-5 h-5" />
                ) : (
                  <PauseIcon className="w-5 h-5" />
                )}
              </button>

              {/* Stop */}
              <button
                onClick={props.onStopAutoAdvance}
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-[var(--radius-button)] text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)] transition-[var(--transition-button)] flex items-center justify-center"
                aria-label="Stop auto-advance"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            </div>

            {/* Center: Speed control (audio mode only) */}
            {autoAdvanceMode === "audio" && (
              <AudioSpeedControl
                speed={playbackSpeed}
                onSpeedChange={setPlaybackSpeed}
                compact
              />
            )}

            {/* Right: Loop icon + Mode indicator + verse position */}
            <div className="flex items-center gap-2 text-sm text-[var(--text-reading-secondary)]">
              {/* Loop icon - indicates continuous auto-advance */}
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
              <span className="flex items-center gap-1">
                <span className="sr-only">
                  {autoAdvanceMode === "audio" ? "Listen mode" : "Read mode"},
                </span>
                {autoAdvanceMode === "audio" ? (
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                ) : (
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
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                )}
                <span className="font-medium">
                  <span className="sr-only">verse </span>
                  {props.versePosition.current}/{props.versePosition.total}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render auto-advance mode selection (idle state with Listen/Read buttons)
  if (hasAutoAdvance && !isAutoAdvanceActive && !singlePlayMode) {
    return (
      <div
        className="bg-[var(--surface-reading-header)] border-t border-[var(--border-reading)] px-4 py-3"
        role="region"
        aria-label="Auto-advance mode selection"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            {/* Auto Mode label */}
            <span className="text-sm text-[var(--text-reading-tertiary)]">
              Auto Mode
            </span>

            {/* Listen button */}
            <button
              onClick={props.onStartAudioMode}
              className="min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] bg-[var(--interactive-contextual)] text-[var(--interactive-contextual-text)] hover:bg-[var(--interactive-contextual-hover)] transition-[var(--transition-button)] flex items-center gap-2 text-sm font-medium"
              aria-label={`Listen mode: plays audio for each verse starting from verse ${props.versePosition.current}, auto-advances through all ${props.versePosition.total} verses`}
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              Listen
            </button>

            {/* Read button */}
            <button
              onClick={props.onStartTextMode}
              className="min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] border border-[var(--border-warm)] text-[var(--text-primary)] hover:bg-[var(--interactive-ghost-hover-bg)] hover:border-[var(--border-warm-hover)] transition-[var(--transition-button)] flex items-center gap-2 text-sm font-medium"
              aria-label={`Read mode: silent timed reading starting from verse ${props.versePosition.current}, auto-advances through all ${props.versePosition.total} verses`}
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Read
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Original single-verse mode UI (backwards compatible)
  return (
    <div
      className="bg-[var(--surface-reading-header)] border-t border-[var(--border-reading)] px-4 py-2"
      role="region"
      aria-label="Audio player"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button - 44px touch target on mobile */}
          <button
            onClick={handlePlayPause}
            disabled={isThisPlaying && state === "loading"}
            className={`
              flex items-center justify-center shrink-0
              transition-[var(--transition-button)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
              disabled:opacity-70 disabled:cursor-not-allowed
              ${
                isIdle
                  ? "gap-2 px-4 py-2 rounded-full bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] hover:opacity-90"
                  : "w-10 h-10 sm:w-9 sm:h-9 rounded-full"
              }
              ${
                !isIdle && isThisPlaying && state === "completed"
                  ? "bg-[var(--status-success-text)] text-white"
                  : !isIdle && isActive
                    ? "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]"
                    : !isIdle
                      ? "bg-[var(--surface-tertiary)] text-[var(--text-reading-primary)] hover:bg-[var(--interactive-reading-hover-bg)]"
                      : ""
              }
            `}
            aria-label={
              isIdle
                ? "Play Sanskrit recitation"
                : isThisPlaying && state === "completed"
                  ? "Replay"
                  : isThisPlaying && state === "playing"
                    ? "Pause"
                    : isThisPlaying && state === "loading"
                      ? "Loading"
                      : "Play"
            }
          >
            {isThisPlaying && state === "loading" ? (
              <SpinnerIcon className="w-4 h-4" />
            ) : isThisPlaying && state === "error" ? (
              <AlertCircleIcon className="w-4 h-4" />
            ) : isThisPlaying && state === "completed" ? (
              <CheckIcon className="w-4 h-4" />
            ) : isThisPlaying && state === "playing" ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            {/* Show label when idle */}
            {isIdle && <span className="text-sm font-medium">Recitation</span>}
          </button>

          {/* Progress bar - only show when active */}
          {!isIdle && (
            <div className="flex-1 min-w-0">
              {isThisPlaying && state === "error" ? (
                <span className="text-xs text-[var(--status-error)]">
                  {error}
                </span>
              ) : (
                <AudioProgress
                  progress={isThisPlaying ? progress : 0}
                  currentTime={isThisPlaying ? currentTime : 0}
                  duration={isThisPlaying ? duration : 0}
                  disabled={!isActive || state === "loading"}
                  onSeek={seek}
                  showTime
                  compact
                />
              )}
            </div>
          )}

          {/* Idle state hint */}
          {isIdle && (
            <span className="flex-1 text-sm text-[var(--text-reading-tertiary)]">
              Listen to Sanskrit verse
            </span>
          )}

          {/* Speed Control - only show when active */}
          {!isIdle && (
            <AudioSpeedControl
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              compact
            />
          )}

          {/* Loop Toggle - only show when active */}
          {!isIdle && (
            <button
              onClick={toggleLoop}
              aria-label={
                isLooping ? "Disable loop, currently looping" : "Enable loop"
              }
              aria-pressed={isLooping}
              className={`
                p-2.5 -m-1 sm:p-1.5 sm:m-0 rounded-[var(--radius-button)] transition-[var(--transition-button)]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
                ${
                  isLooping
                    ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                    : "text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)]"
                }
              `}
            >
              <RepeatIcon className="w-4 h-4" />
              <span className="sr-only">{isLooping ? "(on)" : "(off)"}</span>
            </button>
          )}

          {/* Continuous Playback Toggle - only show when in auto-advance mode */}
          {isAutoAdvanceProps(props) &&
            props.autoAdvanceMode === "audio" &&
            props.onToggleContinuousPlayback && (
              <button
                onClick={props.onToggleContinuousPlayback}
                aria-label={
                  props.continuousPlayback
                    ? "Disable continuous playback to next chapter"
                    : "Enable continuous playback to next chapter"
                }
                aria-pressed={props.continuousPlayback}
                title={
                  props.continuousPlayback
                    ? "Continuous: ON - Will auto-advance to next chapter"
                    : "Continuous: OFF - Stops at chapter end"
                }
                className={`
                  p-2.5 -m-1 sm:p-1.5 sm:m-0 rounded-[var(--radius-button)] transition-[var(--transition-button)]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
                  ${
                    props.continuousPlayback
                      ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                      : "text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)]"
                  }
                `}
              >
                <SkipForwardIcon className="w-4 h-4" />
                <span className="sr-only">
                  {props.continuousPlayback ? "(on)" : "(off)"}
                </span>
              </button>
            )}
        </div>
      </div>

      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
}

/**
 * Audio Player Component (v1.17.0)
 *
 * Reusable audio player for verse recitations.
 * Two variants:
 * - inline: Compact for verse cards (play button only, expands on play)
 * - full: Full controls for reading mode
 *
 * Uses design tokens for theming support.
 */

import { useCallback, useEffect } from "react";
import { useAudioPlayer } from "./AudioPlayerContext";
import { AudioProgress } from "./AudioProgress";
import { AudioSpeedControl } from "./AudioSpeedControl";
import {
  PlayIcon,
  PauseIcon,
  RepeatIcon,
  SpinnerIcon,
  AlertCircleIcon,
} from "../icons";
import { IconButton } from "../ui/IconButton";

interface AudioPlayerProps {
  /** Audio file URL */
  src: string;
  /** Verse canonical ID for tracking */
  verseId: string;
  /** Display variant */
  variant?: "inline" | "full";
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Callback when play starts */
  onPlay?: () => void;
  /** Callback when audio ends */
  onEnded?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export function AudioPlayer({
  src,
  verseId,
  variant = "inline",
  autoPlay = false,
  onPlay,
  onEnded,
  onError,
}: AudioPlayerProps) {
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
    (state === "playing" || state === "paused" || state === "loading");

  // Handle play/pause toggle
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
      play(verseId, src);
      onPlay?.();
    }
  }, [isThisPlaying, state, pause, resume, retry, play, verseId, src, onPlay]);

  // Keyboard shortcut (Space to play/pause when focused)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handlePlayPause();
      }
    },
    [handlePlayPause],
  );

  // Auto-play on mount
  useEffect(() => {
    if (autoPlay && !isThisPlaying) {
      play(verseId, src);
      onPlay?.();
    }
  }, [autoPlay, isThisPlaying, play, verseId, src, onPlay]);

  // Notify on audio end
  useEffect(() => {
    if (isThisPlaying && state === "idle" && progress === 0) {
      onEnded?.();
    }
  }, [isThisPlaying, state, progress, onEnded]);

  // Notify on error
  useEffect(() => {
    if (isThisPlaying && state === "error" && error) {
      onError?.(error);
    }
  }, [isThisPlaying, state, error, onError]);

  // Inline variant - compact play button, expands when active
  if (variant === "inline") {
    return (
      <div
        className="flex flex-col gap-2"
        role="region"
        aria-label={`Audio player for verse ${verseId}`}
      >
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <IconButton
            aria-label={
              isThisPlaying && state === "playing"
                ? "Pause audio"
                : isThisPlaying && state === "loading"
                  ? "Loading audio"
                  : isThisPlaying && state === "error"
                    ? "Retry audio"
                    : "Play audio"
            }
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            onKeyDown={handleKeyDown}
          >
            {isThisPlaying && state === "loading" ? (
              <SpinnerIcon className="w-5 h-5" />
            ) : isThisPlaying && state === "error" ? (
              <AlertCircleIcon className="w-5 h-5 text-[var(--status-error)]" />
            ) : isThisPlaying && state === "playing" ? (
              <PauseIcon className="w-5 h-5" />
            ) : (
              <PlayIcon className="w-5 h-5" />
            )}
          </IconButton>

          {/* Progress bar - shown when active */}
          {isActive && (
            <div className="flex-1 min-w-0">
              <AudioProgress
                progress={isThisPlaying ? progress : 0}
                currentTime={isThisPlaying ? currentTime : 0}
                duration={isThisPlaying ? duration : 0}
                disabled={state === "loading"}
                onSeek={seek}
                compact
              />
            </div>
          )}

          {/* Error message */}
          {isThisPlaying && state === "error" && (
            <span className="text-xs text-[var(--status-error)] flex-1">
              {error}
              <button
                onClick={retry}
                className="ml-2 underline hover:no-underline"
              >
                Retry
              </button>
            </span>
          )}
        </div>

        {/* Speed control - shown when active */}
        {isActive && (
          <div className="flex items-center gap-2 pl-10">
            <AudioSpeedControl
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              compact
            />
            <button
              onClick={toggleLoop}
              aria-label={isLooping ? "Disable loop" : "Enable loop"}
              aria-pressed={isLooping}
              className={`
                p-1 rounded-md transition-[var(--transition-button)]
                focus:outline-none focus-visible:ring-2
                focus-visible:ring-[var(--focus-ring)]
                ${
                  isLooping
                    ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }
              `}
            >
              <RepeatIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full variant - all controls visible
  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--surface-secondary)]"
      role="region"
      aria-label={`Audio player for verse ${verseId}`}
    >
      {/* Progress bar */}
      <AudioProgress
        progress={isThisPlaying ? progress : 0}
        currentTime={isThisPlaying ? currentTime : 0}
        duration={isThisPlaying ? duration : 0}
        disabled={!isThisPlaying || state === "loading"}
        onSeek={seek}
      />

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Speed control */}
        <AudioSpeedControl
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
        />

        {/* Play/Pause button */}
        <IconButton
          aria-label={
            isThisPlaying && state === "playing"
              ? "Pause audio"
              : isThisPlaying && state === "loading"
                ? "Loading audio"
                : isThisPlaying && state === "error"
                  ? "Retry audio"
                  : "Play audio"
          }
          variant="primary"
          size="lg"
          onClick={handlePlayPause}
          onKeyDown={handleKeyDown}
        >
          {isThisPlaying && state === "loading" ? (
            <SpinnerIcon className="w-6 h-6" />
          ) : isThisPlaying && state === "error" ? (
            <AlertCircleIcon className="w-6 h-6" />
          ) : isThisPlaying && state === "playing" ? (
            <PauseIcon className="w-6 h-6" />
          ) : (
            <PlayIcon className="w-6 h-6" />
          )}
        </IconButton>

        {/* Loop toggle */}
        <button
          onClick={toggleLoop}
          aria-label={isLooping ? "Disable loop" : "Enable loop"}
          aria-pressed={isLooping}
          className={`
            p-2 rounded-md transition-[var(--transition-button)]
            focus:outline-none focus-visible:ring-2
            focus-visible:ring-[var(--focus-ring)]
            ${
              isLooping
                ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)]"
            }
          `}
        >
          <RepeatIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Error message */}
      {isThisPlaying && state === "error" && (
        <div className="text-sm text-[var(--status-error)] text-center">
          {error}
          <button
            onClick={retry}
            className="ml-2 underline hover:no-underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

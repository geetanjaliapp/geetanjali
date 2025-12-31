/**
 * Floating Audio Bar Component (v1.17.0)
 *
 * Shows a fixed-bottom audio control bar when audio is playing.
 * Designed for browse pages (Verses, Home) where users may scroll
 * away from the verse card that initiated playback.
 *
 * Features:
 * - Pause/resume controls
 * - Stop button to end playback
 * - Shows verse reference
 * - Links to verse detail
 * - Progress bar with seeking
 * - Playback speed control (0.75x, 1x, 1.25x)
 * - Loop toggle for memorization
 *
 * Uses design tokens for theming support.
 */

import { Link } from "react-router-dom";
import { useAudioPlayer } from "./AudioPlayerContext";
import { AudioProgress } from "./AudioProgress";
import { AudioSpeedControl } from "./AudioSpeedControl";
import {
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
  StopIcon,
  AlertCircleIcon,
  RepeatIcon,
} from "../icons";
import { formatVerseId } from "./audioUtils";

export function FloatingAudioBar() {
  const {
    currentlyPlaying,
    state,
    progress,
    currentTime,
    duration,
    error,
    playbackSpeed,
    isLooping,
    pause,
    resume,
    stop,
    seek,
    retry,
    setPlaybackSpeed,
    toggleLoop,
  } = useAudioPlayer();

  // Only show when audio is active (not idle or completed)
  const isActive = currentlyPlaying && (state === "playing" || state === "paused" || state === "loading" || state === "error");

  if (!isActive) {
    return null;
  }

  const verseRef = formatVerseId(currentlyPlaying);

  const handlePlayPause = () => {
    if (state === "playing") {
      pause();
    } else if (state === "paused") {
      resume();
    } else if (state === "error") {
      retry();
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-elevated)] border-t border-[var(--border-warm)] shadow-[var(--shadow-modal)] safe-area-inset-bottom"
      role="region"
      aria-label="Now playing"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={state === "loading"}
            className={`
              flex items-center justify-center w-10 h-10 rounded-full shrink-0
              transition-[var(--transition-button)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
              disabled:opacity-70 disabled:cursor-not-allowed
              ${
                state === "error"
                  ? "bg-[var(--status-error-text)]/10 text-[var(--status-error-text)]"
                  : "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]"
              }
            `}
            aria-label={
              state === "error"
                ? "Retry"
                : state === "playing"
                  ? "Pause"
                  : state === "loading"
                    ? "Loading"
                    : "Resume"
            }
          >
            {state === "loading" ? (
              <SpinnerIcon className="w-5 h-5" />
            ) : state === "error" ? (
              <AlertCircleIcon className="w-5 h-5" />
            ) : state === "playing" ? (
              <PauseIcon className="w-5 h-5" />
            ) : (
              <PlayIcon className="w-5 h-5" />
            )}
          </button>

          {/* Verse Info + Progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                to={`/verses/${currentlyPlaying}`}
                className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--interactive-primary)] transition-[var(--transition-color)] truncate"
              >
                Verse {verseRef}
              </Link>
              {state === "error" && error && (
                <span className="text-xs text-[var(--status-error-text)] truncate">
                  {error}
                </span>
              )}
            </div>
            {state !== "error" && (
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

          {/* Speed Control - hidden on mobile, shown on sm+ */}
          <div className="hidden sm:block">
            <AudioSpeedControl
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              compact
            />
          </div>

          {/* Loop Toggle */}
          <button
            onClick={toggleLoop}
            aria-label={isLooping ? "Disable loop" : "Enable loop"}
            aria-pressed={isLooping}
            className={`
              p-2.5 -m-0.5 rounded-full transition-[var(--transition-all)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
              ${
                isLooping
                  ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              }
            `}
          >
            <RepeatIcon className="w-5 h-5" />
          </button>

          {/* Stop Button */}
          <button
            onClick={stop}
            className="p-2.5 -m-0.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-[var(--transition-all)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="Stop playback"
          >
            <StopIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

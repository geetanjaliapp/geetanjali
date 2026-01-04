/**
 * MiniPlayerStandard - Original single-verse playback UI
 *
 * The default MiniPlayer UI for playing a single verse.
 * Shows play button, progress bar, speed control, loop toggle,
 * and optional continuous playback toggle.
 */

import {
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
  CheckIcon,
  AlertCircleIcon,
  RepeatIcon,
  SkipForwardIcon,
  CloudDownloadIcon,
} from "../../icons";
import { AudioProgress } from "../AudioProgress";
import { AudioSpeedControl } from "../AudioSpeedControl";
import type { PlaybackSpeed } from "../AudioPlayerContext";
import type { PlayButtonState } from "./MiniPlayerPlayButton";

interface MiniPlayerStandardProps {
  /** Current playback state */
  state: PlayButtonState;
  /** Whether this verse is currently playing */
  isThisPlaying: boolean;
  /** Whether player is in idle state */
  isIdle: boolean;
  /** Whether player is active (not idle) */
  isActive: boolean;
  /** Playback progress (0-1) */
  progress: number;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Error message if any */
  error?: string | null;
  /** Current playback speed */
  playbackSpeed: PlaybackSpeed;
  /** Whether looping is enabled */
  isLooping: boolean;
  /** Whether audio is cached offline */
  isAudioCached: boolean;
  /** Handle play/pause toggle */
  onPlayPause: () => void;
  /** Handle seek */
  onSeek: (progress: number) => void;
  /** Handle speed change */
  onSpeedChange: (speed: PlaybackSpeed) => void;
  /** Handle loop toggle */
  onToggleLoop: () => void;
  /** Optional: continuous playback enabled */
  continuousPlayback?: boolean;
  /** Optional: toggle continuous playback */
  onToggleContinuousPlayback?: () => void;
  /** Optional: show continuous playback control */
  showContinuousPlayback?: boolean;
}

export function MiniPlayerStandard({
  state,
  isThisPlaying,
  isIdle,
  isActive,
  progress,
  currentTime,
  duration,
  error,
  playbackSpeed,
  isLooping,
  isAudioCached,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onToggleLoop,
  continuousPlayback,
  onToggleContinuousPlayback,
  showContinuousPlayback,
}: MiniPlayerStandardProps) {
  return (
    <div
      className="bg-[var(--surface-reading-header)] border-t border-[var(--border-reading-header)] px-4 py-2"
      role="region"
      aria-label="Audio player"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button - 44px touch target on mobile */}
          <button
            onClick={onPlayPause}
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
                  onSeek={onSeek}
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
              onSpeedChange={onSpeedChange}
              compact
            />
          )}

          {/* Loop Toggle - only show when active */}
          {!isIdle && (
            <button
              onClick={onToggleLoop}
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

          {/* Continuous Playback Toggle */}
          {showContinuousPlayback && onToggleContinuousPlayback && (
            <button
              onClick={onToggleContinuousPlayback}
              aria-label={
                continuousPlayback
                  ? "Disable continuous playback to next chapter"
                  : "Enable continuous playback to next chapter"
              }
              aria-pressed={continuousPlayback}
              title={
                continuousPlayback
                  ? "Continuous: ON - Will auto-advance to next chapter"
                  : "Continuous: OFF - Stops at chapter end"
              }
              className={`
                p-2.5 -m-1 sm:p-1.5 sm:m-0 rounded-[var(--radius-button)] transition-[var(--transition-button)]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
                ${
                  continuousPlayback
                    ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                    : "text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)]"
                }
              `}
            >
              <SkipForwardIcon className="w-4 h-4" />
              <span className="sr-only">
                {continuousPlayback ? "(on)" : "(off)"}
              </span>
            </button>
          )}

          {/* Cached indicator - shows when audio is available offline */}
          {!isIdle && isAudioCached && (
            <span
              className="text-[var(--status-success-text)] opacity-70"
              title="Available offline"
              aria-label="Audio cached for offline playback"
            >
              <CloudDownloadIcon className="w-4 h-4" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

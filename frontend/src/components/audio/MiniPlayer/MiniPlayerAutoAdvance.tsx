/**
 * MiniPlayerAutoAdvance - Auto-advance mode active UI
 *
 * Shows progress bar, pause/play, stop, and mode indicator when
 * auto-advancing through verses in Listen or Read mode.
 */

import { PlayIcon, PauseIcon, SpinnerIcon } from "../../icons";
import { AudioSpeedControl } from "../AudioSpeedControl";
import { formatTime } from "../audioUtils";
import type { PlaybackSpeed } from "../AudioPlayerContext";
import type { AutoAdvanceMode } from "../../../hooks/useAutoAdvance";

interface MiniPlayerAutoAdvanceProps {
  /** Current auto-advance mode */
  mode: Exclude<AutoAdvanceMode, "off">;
  /** Whether auto-advance is paused */
  isPaused: boolean;
  /** Whether audio is loading (audio mode only) */
  isLoading: boolean;
  /** Progress 0-100 */
  progress: number;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  totalDuration: number;
  /** Current verse position */
  versePosition: { current: number; total: number };
  /** Current playback speed (audio mode) */
  playbackSpeed: PlaybackSpeed;
  /** Resume auto-advance */
  onResume: () => void;
  /** Pause auto-advance */
  onPause: () => void;
  /** Stop auto-advance */
  onStop: () => void;
  /** Change playback speed */
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

export function MiniPlayerAutoAdvance({
  mode,
  isPaused,
  isLoading,
  progress,
  currentTime,
  totalDuration,
  versePosition,
  playbackSpeed,
  onResume,
  onPause,
  onStop,
  onSpeedChange,
}: MiniPlayerAutoAdvanceProps) {
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
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 h-1.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--interactive-primary)] transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-10 font-mono">{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Pause/Play + Stop */}
          <div className="flex items-center gap-1">
            {/* Pause/Play/Loading */}
            <button
              onClick={isPaused ? onResume : onPause}
              disabled={isLoading}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] hover:opacity-90 transition-[var(--transition-button)] flex items-center justify-center disabled:opacity-70"
              aria-label={isLoading ? "Loading" : isPaused ? "Resume" : "Pause"}
            >
              {isLoading ? (
                <SpinnerIcon className="w-5 h-5" />
              ) : isPaused ? (
                <PlayIcon className="w-5 h-5" />
              ) : (
                <PauseIcon className="w-5 h-5" />
              )}
            </button>

            {/* Stop */}
            <button
              onClick={onStop}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-[var(--radius-button)] text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)] transition-[var(--transition-button)] flex items-center justify-center"
              aria-label="Stop auto-advance"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          </div>

          {/* Center: Speed control (audio mode only) */}
          {mode === "audio" && (
            <AudioSpeedControl
              speed={playbackSpeed}
              onSpeedChange={onSpeedChange}
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
                {mode === "audio" ? "Listen mode" : "Read mode"},
              </span>
              {mode === "audio" ? (
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
                {versePosition.current}/{versePosition.total}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

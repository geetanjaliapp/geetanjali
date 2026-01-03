/**
 * MiniPlayerSinglePlay - Single verse playback mode UI
 *
 * Compact player for playing a single verse triggered from the header play button.
 * Features play/pause, progress bar, speed control, and close button.
 */

import { useRef, useEffect } from "react";
import { AudioProgress } from "../AudioProgress";
import { AudioSpeedControl } from "../AudioSpeedControl";
import type { PlaybackSpeed } from "../AudioPlayerContext";
import { MiniPlayerPlayButton, type PlayButtonState } from "./MiniPlayerPlayButton";

interface MiniPlayerSinglePlayProps {
  /** Current playback state */
  state: PlayButtonState;
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
  /** Handle play/pause toggle */
  onPlayPause: () => void;
  /** Handle seek */
  onSeek: (progress: number) => void;
  /** Handle speed change */
  onSpeedChange: (speed: PlaybackSpeed) => void;
  /** Handle close button click */
  onClose?: () => void;
}

export function MiniPlayerSinglePlay({
  state,
  progress,
  currentTime,
  duration,
  error,
  playbackSpeed,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onClose,
}: MiniPlayerSinglePlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus container when it appears (accessibility)
  useEffect(() => {
    const timer = setTimeout(() => {
      containerRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="bg-[var(--surface-reading-header)] border-t border-[var(--border-reading)] px-4 py-2 focus:outline-none"
      role="region"
      aria-label="Single verse player. Press Space to pause, Escape to close."
      aria-live="polite"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <MiniPlayerPlayButton
            state={state}
            onClick={onPlayPause}
            size="large"
          />

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
                onSeek={onSeek}
                showTime
                compact
              />
            )}
          </div>

          {/* Speed Control */}
          <AudioSpeedControl
            speed={playbackSpeed}
            onSpeedChange={onSpeedChange}
            compact
          />

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
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
          )}
        </div>
      </div>
    </div>
  );
}

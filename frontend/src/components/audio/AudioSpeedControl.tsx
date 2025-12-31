/**
 * Audio Speed Control Component (v1.17.0)
 *
 * Playback speed selector for audio player.
 * Uses design tokens for theming support.
 */

import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "./AudioPlayerContext";

interface AudioSpeedControlProps {
  /** Current playback speed */
  speed: PlaybackSpeed;
  /** Callback when speed changes */
  onSpeedChange: (speed: PlaybackSpeed) => void;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function AudioSpeedControl({
  speed,
  onSpeedChange,
  compact = false,
}: AudioSpeedControlProps) {
  return (
    <div
      className={`flex items-center ${compact ? "gap-0.5" : "gap-1"}`}
      role="radiogroup"
      aria-label="Playback speed"
    >
      {PLAYBACK_SPEEDS.map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={speed === s}
          aria-label={`Playback speed ${s}x`}
          onClick={() => onSpeedChange(s)}
          className={`
            rounded-md font-medium tabular-nums
            transition-[var(--transition-button)]
            focus:outline-none focus-visible:ring-2
            focus-visible:ring-[var(--focus-ring)]
            ${compact ? "px-3 py-2.5 -my-1.5 sm:px-2.5 sm:py-2 sm:-my-1.5 text-xs" : "px-3 py-2 sm:px-2 sm:py-1 text-sm"}
            ${
              speed === s
                ? "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]"
            }
          `}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

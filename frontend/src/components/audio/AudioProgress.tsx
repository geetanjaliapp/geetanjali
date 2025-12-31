/**
 * Audio Progress Bar Component (v1.17.0)
 *
 * Seekable progress bar for audio playback.
 * Uses design tokens for theming support.
 */

import {
  useCallback,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from "react";
import { formatTime } from "./audioUtils";

interface AudioProgressProps {
  /** Current progress (0-1) */
  progress: number;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Whether seeking is enabled */
  disabled?: boolean;
  /** Callback when user seeks */
  onSeek: (position: number) => void;
  /** Show time display */
  showTime?: boolean;
  /** Compact mode (smaller height) */
  compact?: boolean;
}

export function AudioProgress({
  progress,
  currentTime,
  duration,
  disabled = false,
  onSeek,
  showTime = true,
  compact = false,
}: AudioProgressProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const [seekAnnouncement, setSeekAnnouncement] = useState("");

  // Announce seek position for screen readers
  const announceSeek = useCallback(
    (newPosition: number) => {
      const newTime = newPosition * duration;
      setSeekAnnouncement("");
      setTimeout(() => {
        setSeekAnnouncement(`Seeking to ${formatTime(newTime)}`);
      }, 50);
    },
    [duration],
  );

  const handleSeek = useCallback(
    (clientX: number) => {
      if (disabled || !progressRef.current) return;

      const rect = progressRef.current.getBoundingClientRect();
      const position = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      onSeek(position);
      announceSeek(position);
    },
    [disabled, onSeek, announceSeek],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      handleSeek(e.clientX);
    },
    [handleSeek],
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleSeek(e.touches[0].clientX);
      }
    },
    [handleSeek],
  );

  const progressPercent = Math.min(100, Math.max(0, progress * 100));

  return (
    <div className={`flex items-center gap-2 ${compact ? "gap-1.5" : "gap-2"}`}>
      {showTime && (
        <span
          className={`text-[var(--text-tertiary)] tabular-nums ${compact ? "text-xs min-w-[28px]" : "text-xs min-w-[32px]"}`}
        >
          {formatTime(currentTime)}
        </span>
      )}

      <div
        ref={progressRef}
        role="slider"
        aria-label="Audio progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        tabIndex={disabled ? -1 : 0}
        className={`
          relative flex-1 rounded-full cursor-pointer
          bg-[var(--surface-secondary)]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1
          ${compact ? "h-1.5" : "h-2"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--surface-tertiary)]"}
        `}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={(e) => {
          if (disabled) return;
          let newPosition: number | null = null;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            newPosition = Math.min(1, progress + 0.05);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            newPosition = Math.max(0, progress - 0.05);
          } else if (e.key === "Home") {
            e.preventDefault();
            newPosition = 0;
          } else if (e.key === "End") {
            e.preventDefault();
            newPosition = 1;
          }
          if (newPosition !== null) {
            onSeek(newPosition);
            announceSeek(newPosition);
          }
        }}
      >
        {/* Progress fill */}
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full
            bg-[var(--interactive-primary)]
            transition-[width] duration-100
          `}
          style={{ width: `${progressPercent}%` }}
        />

        {/* Seek handle */}
        {!disabled && (
          <div
            className={`
              absolute top-1/2 -translate-y-1/2 -translate-x-1/2
              bg-[var(--interactive-primary)]
              rounded-full shadow-sm
              transition-transform duration-100
              hover:scale-125
              ${compact ? "w-2.5 h-2.5" : "w-3 h-3"}
            `}
            style={{ left: `${progressPercent}%` }}
          />
        )}
      </div>

      {showTime && (
        <span
          className={`text-[var(--text-tertiary)] tabular-nums ${compact ? "text-xs min-w-[28px]" : "text-xs min-w-[32px]"}`}
        >
          {formatTime(duration)}
        </span>
      )}

      {/* Live region for seek announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {seekAnnouncement}
      </div>
    </div>
  );
}

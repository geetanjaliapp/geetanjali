/**
 * ProgressBar - Thin animated progress indicator
 *
 * Displays a horizontal progress bar showing completion percentage.
 * Features:
 * - Thin design (2-3px height)
 * - Smooth fill animation on mount
 * - Warm amber color palette
 *
 * Used by: ChapterContextBar, Reading Mode
 */

interface ProgressBarProps {
  /** Current progress percentage (0-100) */
  percentage: number;
  /** Optional custom height in pixels (default: 3) */
  height?: number;
  /** Whether to animate the fill on mount (default: true) */
  animate?: boolean;
  /** Optional aria label for accessibility */
  ariaLabel?: string;
}

export function ProgressBar({
  percentage,
  height = 3,
  animate = true,
  ariaLabel,
}: ProgressBarProps) {
  // Clamp percentage to valid range
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div
      className="w-full bg-[var(--surface-muted)] rounded-full overflow-hidden"
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-valuenow={clampedPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `Progress: ${clampedPercentage}%`}
    >
      <div
        className={`h-full bg-[var(--interactive-primary)] rounded-full ${
          animate ? "transition-all duration-700 ease-out" : ""
        }`}
        style={{ width: `${clampedPercentage}%` }}
      />
    </div>
  );
}

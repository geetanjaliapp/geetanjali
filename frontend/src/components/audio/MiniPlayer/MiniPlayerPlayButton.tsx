/**
 * MiniPlayerPlayButton - Reusable play/pause button for MiniPlayer modes
 *
 * Renders a circular button with appropriate icon based on current state.
 * Supports loading, playing, paused, completed, and error states.
 */

import {
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
  CheckIcon,
  AlertCircleIcon,
} from "../../icons";

export type PlayButtonState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "completed"
  | "error";

interface MiniPlayerPlayButtonProps {
  /** Current playback state */
  state: PlayButtonState;
  /** Click handler */
  onClick: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "default" | "large";
  /** Optional custom aria-label override */
  ariaLabel?: string;
}

/**
 * Get the appropriate icon for the current state
 */
function getIcon(state: PlayButtonState, className: string) {
  switch (state) {
    case "loading":
      return <SpinnerIcon className={className} />;
    case "playing":
      return <PauseIcon className={className} />;
    case "completed":
      return <CheckIcon className={className} />;
    case "error":
      return <AlertCircleIcon className={className} />;
    case "paused":
    case "idle":
    default:
      return <PlayIcon className={className} />;
  }
}

/**
 * Get the default aria-label for the current state
 */
function getDefaultAriaLabel(state: PlayButtonState): string {
  switch (state) {
    case "loading":
      return "Loading";
    case "playing":
      return "Pause";
    case "completed":
      return "Replay";
    case "error":
      return "Retry";
    case "paused":
      return "Resume";
    case "idle":
    default:
      return "Play";
  }
}

export function MiniPlayerPlayButton({
  state,
  onClick,
  disabled = false,
  size = "default",
  ariaLabel,
}: MiniPlayerPlayButtonProps) {
  const sizeClasses =
    size === "large"
      ? "min-w-[44px] min-h-[44px] p-2.5"
      : "w-10 h-10 sm:w-9 sm:h-9";
  const iconClasses = size === "large" ? "w-5 h-5" : "w-4 h-4";

  const stateClasses =
    state === "completed"
      ? "bg-[var(--status-success-text)] text-white"
      : "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]";

  return (
    <button
      onClick={onClick}
      disabled={disabled || state === "loading"}
      className={`
        ${sizeClasses}
        ${stateClasses}
        rounded-full flex items-center justify-center
        hover:opacity-90 transition-[var(--transition-button)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
        disabled:opacity-70 disabled:cursor-not-allowed
      `}
      aria-label={ariaLabel ?? getDefaultAriaLabel(state)}
    >
      {getIcon(state, iconClasses)}
    </button>
  );
}

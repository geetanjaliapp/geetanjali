/**
 * SpeakButton Component - Text-to-Speech trigger button
 *
 * Reusable button for on-the-fly TTS on any text content.
 * Uses Edge TTS (primary) with Web Speech API fallback.
 *
 * @example
 * // Basic usage
 * <SpeakButton text="Welcome to Geetanjali" />
 *
 * // With Hindi
 * <SpeakButton text="नमस्ते" lang="hi" />
 *
 * // Custom size
 * <SpeakButton text="Hello" size="sm" />
 */

import { useCallback } from "react";
import { useTTSContext } from "../contexts/TTSContext";
import { IconButton, type IconButtonProps } from "./ui/IconButton";

type TTSLanguage = "en" | "hi";

interface SpeakButtonProps
  extends Omit<IconButtonProps, "aria-label" | "children" | "onClick"> {
  /** Text to speak */
  text: string;
  /** Language: 'en' for English, 'hi' for Hindi */
  lang?: TTSLanguage;
  /** Optional custom aria-label (defaults to "Listen to text") */
  "aria-label"?: string;
}

/**
 * Speaker icon (when idle)
 */
function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

/**
 * Stop icon (when speaking)
 */
function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

/**
 * Loading spinner (when fetching audio)
 */
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`animate-spin ${className || ""}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
    </svg>
  );
}

/**
 * SpeakButton component
 *
 * Icon button that triggers text-to-speech playback.
 * Shows different icons based on state: speaker (idle), spinner (loading), stop (playing).
 */
export function SpeakButton({
  text,
  lang = "en",
  size = "sm",
  variant = "ghost",
  "aria-label": ariaLabel,
  className,
  ...props
}: SpeakButtonProps) {
  const { speak, stop, currentText, loadingText } = useTTSContext();

  // This button is "speaking" if global TTS is playing this exact text
  const isSpeaking = currentText === text;
  // This button is "loading" if global TTS is loading this exact text
  const isLoading = loadingText === text;

  const handleClick = useCallback(() => {
    if (isSpeaking || isLoading) {
      stop();
    } else {
      speak(text, { lang });
    }
  }, [isSpeaking, isLoading, stop, speak, text, lang]);

  // Determine icon size based on button size
  const iconSize = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  // Determine current state for accessibility
  const stateLabel = isLoading
    ? "Loading audio..."
    : isSpeaking
      ? "Stop speaking"
      : ariaLabel || "Listen to text";

  // Mobile touch target fix: expand clickable area on mobile while keeping visual size small
  // Pattern: p-2.5 (10px) on mobile expands 32px button to 52px touch target
  // -m-1.5 offsets visual appearance, sm: removes both for desktop
  const mobileTargetClass = size === "sm" ? "p-2.5 -m-1.5 sm:p-0 sm:m-0" : "";

  return (
    <IconButton
      aria-label={stateLabel}
      onClick={handleClick}
      size={size}
      variant={variant}
      disabled={props.disabled}
      className={`${mobileTargetClass} ${className || ""}`}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner className={iconSize} />
      ) : isSpeaking ? (
        <StopIcon className={iconSize} />
      ) : (
        <SpeakerIcon className={iconSize} />
      )}
    </IconButton>
  );
}

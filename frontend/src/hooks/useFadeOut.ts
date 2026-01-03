/**
 * useFadeOut - Hook for smooth fade-out animations
 *
 * Provides state and controls for fading out transient UI elements.
 * Respects prefers-reduced-motion preference.
 *
 * @since v1.19.0
 */

import { useState, useCallback, useEffect } from "react";

interface UseFadeOutOptions {
  /** Fade animation duration in ms (default: 300) */
  duration?: number;
  /** Delay before starting fade in ms (default: 0) */
  delay?: number;
  /** Callback when fade completes */
  onComplete?: () => void;
}

interface UseFadeOutReturn {
  /** Whether the element is currently fading out */
  isFading: boolean;
  /** Whether the element should be visible (false after fade completes) */
  isVisible: boolean;
  /** Start the fade-out animation */
  startFade: () => void;
  /** Reset to visible state */
  reset: () => void;
  /** CSS class to apply for fade animation */
  fadeClassName: string;
}

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hook for smooth fade-out animations on transient elements
 *
 * @example
 * ```tsx
 * function Toast({ message, onDismiss }) {
 *   const { isFading, isVisible, startFade, fadeClassName } = useFadeOut({
 *     duration: 300,
 *     delay: 3000, // Auto-dismiss after 3s
 *     onComplete: onDismiss
 *   });
 *
 *   useEffect(() => {
 *     startFade();
 *   }, [startFade]);
 *
 *   if (!isVisible) return null;
 *
 *   return (
 *     <div className={fadeClassName}>
 *       {message}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFadeOut({
  duration = 300,
  delay = 0,
  onComplete,
}: UseFadeOutOptions = {}): UseFadeOutReturn {
  const [isFading, setIsFading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isStarted, setIsStarted] = useState(false);

  // Handle fade timing with proper cleanup via useEffect
  useEffect(() => {
    if (!isStarted) return;

    const reducedMotion = prefersReducedMotion();
    let delayTimer: ReturnType<typeof setTimeout>;
    let fadeTimer: ReturnType<typeof setTimeout>;

    if (reducedMotion) {
      // With reduced motion, skip animation and hide immediately after delay
      delayTimer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, delay);
    } else {
      // Start fade after delay
      delayTimer = setTimeout(() => {
        setIsFading(true);

        // Complete fade and hide after duration
        fadeTimer = setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, duration);
      }, delay);
    }

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(fadeTimer);
    };
  }, [isStarted, duration, delay, onComplete]);

  const startFade = useCallback(() => {
    setIsStarted(true);
  }, []);

  const reset = useCallback(() => {
    setIsFading(false);
    setIsVisible(true);
    setIsStarted(false);
  }, []);

  // Generate CSS class based on state
  const fadeClassName = isFading ? "animate-fadeOut" : "";

  return {
    isFading,
    isVisible,
    startFade,
    reset,
    fadeClassName,
  };
}

/**
 * CSS for fade animation (add to your styles):
 *
 * @keyframes fadeOut {
 *   from { opacity: 1; }
 *   to { opacity: 0; }
 * }
 *
 * .animate-fadeOut {
 *   animation: fadeOut 300ms ease-out forwards;
 * }
 *
 * @media (prefers-reduced-motion: reduce) {
 *   .animate-fadeOut {
 *     animation: none;
 *     opacity: 0;
 *   }
 * }
 */

/**
 * Hook for auto-dismissing elements with fade
 *
 * Automatically starts the fade after mount.
 */
export function useAutoFadeOut(options: UseFadeOutOptions = {}): UseFadeOutReturn {
  const fadeOut = useFadeOut(options);

  useEffect(() => {
    fadeOut.startFade();
  }, [fadeOut.startFade]); // eslint-disable-line react-hooks/exhaustive-deps -- Only run on mount

  return fadeOut;
}

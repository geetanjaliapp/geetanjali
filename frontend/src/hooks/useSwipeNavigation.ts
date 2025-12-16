/**
 * useSwipeNavigation - Native touch swipe detection for navigation
 *
 * Features:
 * - Swipe left → next (onNext callback)
 * - Swipe right → previous (onPrev callback)
 * - Configurable threshold and velocity
 * - Prevents vertical scroll interference
 * - Returns ref to attach to swipeable element
 *
 * Used by: ReadingMode
 */

import { useRef, useEffect, useCallback } from "react";

interface SwipeNavigationOptions {
  /** Callback when user swipes left (next) */
  onNext?: () => void;
  /** Callback when user swipes right (previous) */
  onPrev?: () => void;
  /** Minimum distance in pixels to trigger swipe (default: 50) */
  threshold?: number;
  /** Minimum velocity in px/ms to trigger swipe (default: 0.3) */
  minVelocity?: number;
  /** Whether swipe is enabled (default: true) */
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isTracking: boolean;
}

/**
 * Hook for detecting horizontal swipe gestures
 *
 * @example
 * const swipeRef = useSwipeNavigation({
 *   onNext: () => goToNextVerse(),
 *   onPrev: () => goToPrevVerse(),
 * });
 *
 * return <div ref={swipeRef}>Swipeable content</div>;
 */
export function useSwipeNavigation<T extends HTMLElement = HTMLDivElement>({
  onNext,
  onPrev,
  threshold = 50,
  minVelocity = 0.3,
  enabled = true,
}: SwipeNavigationOptions = {}) {
  const elementRef = useRef<T>(null);
  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isTracking: false,
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isTracking: true,
      };
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchState.current.isTracking) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchState.current.startX;
      const deltaY = touch.clientY - touchState.current.startY;

      // If vertical movement is greater than horizontal, stop tracking
      // This allows normal scrolling to work
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        touchState.current.isTracking = false;
        return;
      }

      // If horizontal movement is significant, prevent default to avoid
      // browser back/forward gestures
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }
    },
    [enabled],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchState.current.isTracking) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.current.startX;
      const deltaTime = Date.now() - touchState.current.startTime;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Reset tracking
      touchState.current.isTracking = false;

      // Check if swipe meets threshold and velocity requirements
      if (Math.abs(deltaX) < threshold) return;
      if (velocity < minVelocity) return;

      // Determine direction and call appropriate callback
      if (deltaX < 0 && onNext) {
        // Swipe left → next
        onNext();
      } else if (deltaX > 0 && onPrev) {
        // Swipe right → previous
        onPrev();
      }
    },
    [enabled, threshold, minVelocity, onNext, onPrev],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    // Add touch event listeners with passive: false for touchmove
    // to allow preventDefault() for horizontal swipes
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return elementRef;
}

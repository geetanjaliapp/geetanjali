/**
 * Toast - A subtle, non-intrusive notification component
 *
 * Used for transient messages that auto-dismiss without requiring user action.
 * Designed to be unobtrusive while still being noticeable.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";

interface ToastProps {
  message: string;
  linkText?: string;
  linkTo?: string;
  duration?: number; // ms, default 5000
  onDismiss: () => void;
}

export function Toast({
  message,
  linkText,
  linkTo,
  duration = 5000,
  onDismiss,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Track mounted state to prevent updates after unmount
  const isMountedRef = useRef(true);
  // Track timers for proper cleanup
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store latest onDismiss to avoid stale closures
  const onDismissRef = useRef(onDismiss);

  // Track unmount and keep onDismiss ref updated
  useEffect(() => {
    isMountedRef.current = true;
    onDismissRef.current = onDismiss;
    return () => {
      isMountedRef.current = false;
    };
  }, [onDismiss]);

  // Stable dismiss function that properly cleans up
  const triggerDismiss = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsLeaving(true);
    // Clear any existing exit timer
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onDismissRef.current();
      }
    }, 300);
  }, []);

  // Entrance animation
  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(showTimer);
  }, []);

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(triggerDismiss, duration);

    return () => {
      clearTimeout(timer);
      // Also clean up the exit animation timer
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [duration, triggerDismiss]);

  const handleDismiss = () => {
    triggerDismiss();
  };

  return (
    <div
      className={`fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50
                  max-w-sm mx-auto sm:mx-0 transition-all duration-300 ease-out
                  ${isVisible && !isLeaving ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="bg-[var(--text-primary)] text-[var(--surface-elevated)]
                   rounded-xl shadow-lg px-4 py-3 flex items-center gap-3"
      >
        {/* Message */}
        <p className="flex-1 text-base sm:text-sm">{message}</p>

        {/* Optional link */}
        {linkText && linkTo && (
          <Link
            to={linkTo}
            className="text-[var(--text-accent)] font-medium text-base sm:text-sm
                       hover:text-[var(--text-accent-hover)] transition-colors whitespace-nowrap"
            onClick={handleDismiss}
          >
            {linkText}
          </Link>
        )}

        {/* Dismiss button - 44px touch target for mobile */}
        <button
          onClick={handleDismiss}
          className="min-w-11 min-h-11 flex items-center justify-center -m-2
                     text-[var(--text-muted)]
                     hover:text-[var(--surface-elevated)]
                     focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]
                     rounded-lg transition-colors"
          aria-label="Dismiss notification"
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
      </div>
    </div>
  );
}

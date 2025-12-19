/**
 * Toast - A subtle, non-intrusive notification component
 *
 * Used for transient messages that auto-dismiss without requiring user action.
 * Designed to be unobtrusive while still being noticeable.
 */

import { useEffect, useState } from "react";
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

  // Entrance animation
  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(showTimer);
  }, []);

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(onDismiss, 300);
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
        className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900
                   rounded-xl shadow-lg px-4 py-3 flex items-center gap-3"
      >
        {/* Message */}
        <p className="flex-1 text-sm">{message}</p>

        {/* Optional link */}
        {linkText && linkTo && (
          <Link
            to={linkTo}
            className="text-amber-400 dark:text-amber-600 font-medium text-sm hover:text-amber-300 dark:hover:text-amber-700 transition-colors whitespace-nowrap"
            onClick={handleDismiss}
          >
            {linkText}
          </Link>
        )}

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-900 transition-colors"
          aria-label="Dismiss notification"
        >
          <svg
            className="w-4 h-4"
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

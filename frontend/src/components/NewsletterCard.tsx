/**
 * NewsletterCard - Discovery touchpoint for daily verse newsletter
 *
 * Shows on Home page to introduce the daily wisdom newsletter.
 * Features:
 * - Dismissable with X button (returns after 7 days)
 * - Hidden if user is already subscribed
 * - Links to Settings page for signup
 */

import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { isNewsletterSubscribed } from "../lib/newsletterStorage";

/**
 * Safely write to localStorage, handling quota exceeded errors
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // QuotaExceededError or SecurityError (private browsing)
    return false;
  }
}

// localStorage key for dismissal tracking
const NEWSLETTER_DISMISSED_KEY = "geetanjali:newsletterCardDismissed";

// 7 days in milliseconds
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if the card should be shown (used for lazy initialization)
 */
function shouldShowCard(): boolean {
  try {
    // Don't show if user is subscribed
    if (isNewsletterSubscribed()) return false;

    // Don't show if dismissed within last 7 days
    const dismissed = localStorage.getItem(NEWSLETTER_DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DURATION) {
        return false;
      }
    }

    return true;
  } catch {
    // localStorage unavailable
    return false;
  }
}

export function NewsletterCard() {
  // Use lazy initializer to avoid useEffect lint warning
  const [isVisible, setIsVisible] = useState(shouldShowCard);
  // Prevent rapid clicks from causing issues
  const isDismissingRef = useRef(false);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Debounce: ignore if already dismissing
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    // Try to persist dismissal, but hide card either way
    safeSetItem(NEWSLETTER_DISMISSED_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="mb-8 sm:mb-10 max-w-4xl mx-auto">
      <Link
        to="/settings#newsletter"
        className="block p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-800/80 dark:to-gray-800/80 rounded-xl border border-amber-200/60 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 transition-all group relative"
      >
        {/* Dismiss button - 44px touch target */}
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 p-2.5 text-amber-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-amber-100 dark:hover:bg-gray-700"
          aria-label="Dismiss newsletter card"
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

        <div className="flex items-center gap-4 pr-8">
          {/* Sun icon */}
          <div className="flex-shrink-0 p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
              Daily Wisdom
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Start each day with a verse chosen for your journey
            </p>
          </div>
          {/* Arrow */}
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Link>
    </div>
  );
}

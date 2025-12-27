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
        className="block p-4 sm:p-5 bg-[var(--surface-card)] rounded-[var(--radius-card)] border border-[var(--border-warm)] hover:border-[var(--border-accent)] transition-[var(--transition-all)] group relative"
      >
        {/* Dismiss button - 44px touch target */}
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 p-2.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-[var(--transition-color)] rounded-[var(--radius-avatar)] hover:bg-[var(--interactive-ghost-hover-bg)]"
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
          <div className="shrink-0 p-2.5 rounded-[var(--radius-button)] bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)]">
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
            <h3 className="font-semibold text-[var(--text-primary)] text-sm sm:text-base group-hover:text-[var(--text-accent)] transition-[var(--transition-color)]">
              Daily Wisdom
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Start each day with a verse chosen for your journey
            </p>
          </div>
          {/* Arrow */}
          <svg
            className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-accent)] transition-[var(--transition-color)] shrink-0"
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

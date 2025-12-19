/**
 * Newsletter localStorage utilities
 *
 * Shared functions for managing newsletter subscription state in localStorage.
 */

// localStorage key for newsletter subscription
export const NEWSLETTER_SUBSCRIBED_KEY = "geetanjali:newsletterSubscribed";

/**
 * Mark the user as subscribed (call this after successful subscription)
 * Returns true if the write succeeded, false otherwise (quota exceeded, private browsing, etc.)
 */
export function markNewsletterSubscribed(): boolean {
  try {
    localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, "true");
    return true;
  } catch (e) {
    // QuotaExceededError or SecurityError (private browsing)
    console.warn("Failed to mark newsletter subscribed:", e);
    return false;
  }
}

/**
 * Clear subscription status (for testing or after unsubscribe)
 */
export function clearNewsletterSubscribed(): void {
  try {
    localStorage.removeItem(NEWSLETTER_SUBSCRIBED_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if user is subscribed
 */
export function isNewsletterSubscribed(): boolean {
  try {
    return localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY) === "true";
  } catch {
    return false;
  }
}

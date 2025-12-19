/**
 * Newsletter localStorage utilities
 *
 * Shared functions for managing newsletter subscription state in localStorage.
 */

// localStorage key for newsletter subscription
export const NEWSLETTER_SUBSCRIBED_KEY = "geetanjali:newsletterSubscribed";

/**
 * Mark the user as subscribed (call this after successful subscription)
 */
export function markNewsletterSubscribed(): void {
  try {
    localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, "true");
  } catch {
    // Ignore storage errors
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

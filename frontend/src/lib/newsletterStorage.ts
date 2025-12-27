/**
 * Newsletter localStorage utilities
 *
 * Shared functions for managing newsletter subscription state in localStorage.
 */

import { setStorageItemRaw, STORAGE_KEYS } from "./storage";

/**
 * Mark the user as subscribed (call this after successful subscription)
 * Returns true if the write succeeded, false otherwise (quota exceeded, private browsing, etc.)
 */
export function markNewsletterSubscribed(): boolean {
  return setStorageItemRaw(STORAGE_KEYS.newsletterSubscribed, "true");
}

/**
 * Clear subscription status (for testing or after unsubscribe)
 */
export function clearNewsletterSubscribed(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.newsletterSubscribed);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if user is subscribed
 */
export function isNewsletterSubscribed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.newsletterSubscribed) === "true";
  } catch {
    return false;
  }
}

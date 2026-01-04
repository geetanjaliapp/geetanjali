/**
 * Verse Prefetch Utility
 *
 * Prefetches verse data on hover/focus to improve LCP on verse detail pages.
 * Uses browser-native link prefetching for optimal caching behavior.
 *
 * Strategy:
 * - On hover/focus of verse card, prefetch verse data and translations
 * - Browser handles caching and deduplication
 * - No impact if user doesn't navigate (prefetch is low priority)
 *
 * @since v1.21.0
 */

import { API_V1_PREFIX } from "./config";

/**
 * Tracks which verses have been prefetched to avoid duplicate requests.
 * Uses a Set for O(1) lookup.
 */
const prefetchedVerses = new Set<string>();

/**
 * Prefetch verse data and translations for faster navigation.
 *
 * @param canonicalId - Verse identifier (e.g., "BG_2_47")
 *
 * @example
 * ```tsx
 * <Link
 *   to={`/verses/${verse.canonical_id}`}
 *   onMouseEnter={() => prefetchVerse(verse.canonical_id)}
 *   onFocus={() => prefetchVerse(verse.canonical_id)}
 * >
 * ```
 */
export function prefetchVerse(canonicalId: string): void {
  // Skip if already prefetched
  if (prefetchedVerses.has(canonicalId)) {
    return;
  }

  // Mark as prefetched immediately to prevent duplicate calls
  prefetchedVerses.add(canonicalId);

  // Create prefetch links for verse data and translations
  const versePath = `${API_V1_PREFIX}/verses/${canonicalId}`;
  const translationsPath = `${API_V1_PREFIX}/verses/${canonicalId}/translations`;

  // Use link prefetch for browser-native caching
  // The browser handles priority and caching automatically
  createPrefetchLink(versePath);
  createPrefetchLink(translationsPath);
}

/**
 * Creates a <link rel="prefetch"> element for browser-native prefetching.
 * The browser will fetch this resource at low priority and cache it.
 *
 * Note: Deduplication is handled by the Set in prefetchVerse(), so we don't
 * need to check for existing links here.
 */
function createPrefetchLink(href: string): void {
  // Skip on server-side (SSR safety)
  if (typeof document === "undefined") {
    return;
  }

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "fetch";
  link.href = href;
  link.crossOrigin = "anonymous";

  // Remove link after prefetch completes or fails (cleanup)
  link.onload = () => link.remove();
  link.onerror = () => link.remove();

  document.head.appendChild(link);
}

/**
 * Clear prefetch cache (useful for testing or memory management).
 */
export function clearPrefetchCache(): void {
  prefetchedVerses.clear();
}

/**
 * Check if a verse has been prefetched.
 * Useful for debugging.
 */
export function isPrefetched(canonicalId: string): boolean {
  return prefetchedVerses.has(canonicalId);
}

/**
 * Text Truncation Utility
 *
 * Provides consistent text truncation with ellipsis across the app.
 * Replaces ad-hoc .slice() + "..." patterns.
 *
 * Part of v1.20.0 code hygiene improvements.
 */

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length of the result (including ellipsis)
 * @param ellipsis - The ellipsis string to append (default: "...")
 * @returns The original text if shorter than maxLength, otherwise truncated with ellipsis
 *
 * @example
 * truncateText("Hello World", 8) // "Hello..."
 * truncateText("Hi", 10) // "Hi"
 * truncateText("Hello World", 8, "…") // "Hello W…"
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis = "..."
): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Ensure we have room for the ellipsis
  const truncateAt = maxLength - ellipsis.length;
  if (truncateAt <= 0) {
    return ellipsis.slice(0, maxLength);
  }

  return text.slice(0, truncateAt).trimEnd() + ellipsis;
}

/**
 * Truncate text for SEO meta descriptions.
 * Uses 150 characters as the standard limit.
 *
 * @param text - The text to truncate
 * @returns Truncated text suitable for meta description
 */
export function truncateForSEO(text: string): string {
  return truncateText(text, 150);
}

/**
 * Truncate text for compact UI displays (cards, lists).
 * Uses 80 characters as the limit.
 *
 * @param text - The text to truncate
 * @returns Truncated text suitable for compact display
 */
export function truncateForDisplay(text: string): string {
  return truncateText(text, 80);
}

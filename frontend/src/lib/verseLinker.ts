/**
 * Verse Reference Linker
 *
 * Parses BG_X_Y patterns in text and provides utilities for
 * verse reference detection and formatting.
 *
 * Used by GuidanceMarkdown to create clickable verse references.
 */

/**
 * Parsed verse reference
 */
export interface VerseRef {
  /** Full match including optional parentheses, e.g., "(BG_2_47)" or "BG_2_47" */
  match: string;
  /** Canonical ID, e.g., "BG_2_47" */
  canonicalId: string;
  /** Chapter number */
  chapter: number;
  /** Verse number */
  verse: number;
  /** Whether the reference was wrapped in parentheses */
  hasParens: boolean;
  /** Start index in original text */
  startIndex: number;
  /** End index in original text */
  endIndex: number;
}

/**
 * Regex pattern to match verse references in various formats
 *
 * Supported formats:
 * - BG_2_47 (canonical)
 * - BG 2.47
 * - BG 2_47
 * - BG2.47
 * - (BG_2_47) with parentheses
 * - BG_2.47 (mixed)
 *
 * Captures: full match, chapter number, verse number
 */
const VERSE_REF_PATTERN = /\(?BG[_\s]?(\d{1,2})[._](\d{1,2})\)?/g;

/**
 * Extract all verse references from text
 *
 * @param text - Text to parse
 * @returns Array of parsed verse references
 */
export function extractVerseRefs(text: string): VerseRef[] {
  const refs: VerseRef[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  VERSE_REF_PATTERN.lastIndex = 0;

  while ((match = VERSE_REF_PATTERN.exec(text)) !== null) {
    const fullMatch = match[0];
    const chapter = parseInt(match[1], 10);
    const verse = parseInt(match[2], 10);

    // Normalize to canonical format: BG_X_Y
    const canonicalId = `BG_${chapter}_${verse}`;

    refs.push({
      match: fullMatch,
      canonicalId,
      chapter,
      verse,
      hasParens: fullMatch.startsWith("("),
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    });
  }

  return refs;
}

/**
 * Format verse reference for display
 * Converts BG_2_47 to "BG 2.47"
 *
 * @param canonicalId - Canonical ID like "BG_2_47"
 * @returns Formatted display string like "BG 2.47"
 */
export function formatVerseRef(canonicalId: string): string {
  const match = canonicalId.match(/BG_(\d+)_(\d+)/);
  if (!match) return canonicalId;
  return `BG ${match[1]}.${match[2]}`;
}

/**
 * Parse a canonical ID into chapter and verse
 *
 * @param canonicalId - Canonical ID like "BG_2_47"
 * @returns Object with chapter and verse, or null if invalid
 */
export function parseCanonicalId(
  canonicalId: string
): { chapter: number; verse: number } | null {
  const match = canonicalId.match(/BG_(\d+)_(\d+)/);
  if (!match) return null;
  return {
    chapter: parseInt(match[1], 10),
    verse: parseInt(match[2], 10),
  };
}

/**
 * Check if text contains any verse references
 *
 * @param text - Text to check
 * @returns True if text contains at least one verse reference
 */
export function hasVerseRefs(text: string): boolean {
  VERSE_REF_PATTERN.lastIndex = 0;
  return VERSE_REF_PATTERN.test(text);
}

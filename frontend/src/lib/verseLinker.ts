/**
 * Verse Reference Linker
 *
 * Parses BG_X_Y patterns in text and provides utilities for
 * verse reference detection and formatting.
 *
 * Standardized formats:
 * - Canonical (URLs):    BG_2_47
 * - Prose (text):        BG 2.47
 * - Ornamental (cards):  2.47 (used within ॥ ॥ markers)
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
 * - BG 2.47 (prose)
 * - BG 2 47 (space-separated, from LLM)
 * - BG 2_47
 * - BG2.47
 * - (BG_2_47) with parentheses
 * - BG_2.47 (mixed)
 *
 * Captures: full match, chapter number, verse number
 */
const VERSE_REF_PATTERN = /\(?BG[_\s]?(\d{1,2})[._\s](\d{1,3})\)?/g;

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
  canonicalId: string,
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

/**
 * Format verse reference for ornamental display
 * Converts BG_2_47 to "2.47" (without BG prefix)
 * Used within ॥ ॥ markers on verse cards
 *
 * @param canonicalId - Canonical ID like "BG_2_47"
 * @returns Formatted display string like "2.47"
 */
export function formatVerseDisplay(canonicalId: string): string {
  const match = canonicalId.match(/BG_(\d+)_(\d+)/);
  if (!match) return canonicalId;
  return `${match[1]}.${match[2]}`;
}

/**
 * Format verse from chapter and verse numbers for ornamental display
 * Converts (2, 47) to "2.47"
 *
 * @param chapter - Chapter number
 * @param verse - Verse number
 * @returns Formatted display string like "2.47"
 */
export function formatChapterVerse(chapter: number, verse: number): string {
  return `${chapter}.${verse}`;
}

/**
 * Normalize verse references in text to canonical format
 * Converts various formats (BG 2 47, BG 2.47, etc.) to BG_2_47
 * Useful for post-processing LLM output
 *
 * @param text - Text containing verse references
 * @returns Text with normalized verse references
 */
export function normalizeVerseRefs(text: string): string {
  VERSE_REF_PATTERN.lastIndex = 0;
  return text.replace(VERSE_REF_PATTERN, (match, chapter, verse) => {
    const hasParens = match.startsWith("(");
    const canonical = `BG_${chapter}_${verse}`;
    return hasParens ? `(${canonical})` : canonical;
  });
}

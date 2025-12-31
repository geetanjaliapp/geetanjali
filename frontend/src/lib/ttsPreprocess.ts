/**
 * TTS Text Preprocessing Utilities
 *
 * Prepares translation text for natural speech synthesis by:
 * - Cleaning non-readable constructs (quotes, brackets, etc.)
 * - Expanding verse references for natural reading
 * - Adding contextual prefixes for both Hindi and English
 */

/**
 * Clean text for TTS by removing/replacing non-readable constructs
 */
function cleanTextForTTS(text: string | null | undefined): string {
  if (!text) return "";
  return (
    text
      // Remove surrounding quotes
      .replace(/^["'"']|["'"']$/g, "")
      // Replace parenthetical verse refs like (BG 2.47) or (2.47)
      .replace(/\s*\([^)]*\d+\.\d+[^)]*\)\s*/g, " ")
      // Remove inline verse refs like "BG 2.47" or "Geeta 2.47"
      .replace(/\b(?:BG|Geeta|Gita|Bhagavad Geeta|Bhagavad Gita)\s*\d+\.\d+\b/gi, "")
      // Remove standalone verse refs like "2.47" (chapter.verse pattern)
      .replace(/\b\d{1,2}\.\d{1,3}\b/g, "")
      // Replace em-dashes and en-dashes with commas for natural pause
      .replace(/[—–]/g, ",")
      // Remove asterisks and other markup
      .replace(/[*_~`]/g, "")
      // Normalize multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Expand verse reference for Hindi TTS
 * Returns: "अध्याय 2, श्लोक 47। "
 */
function getHindiVersePrefix(chapter: number, verse: number): string {
  return `अध्याय ${chapter}, श्लोक ${verse}। `;
}

/**
 * Expand verse reference for English TTS
 * Returns: "Chapter 2, verse 47. "
 */
function getEnglishVersePrefix(chapter: number, verse: number): string {
  return `Chapter ${chapter}, verse ${verse}. `;
}

/**
 * Prepare Hindi translation for TTS
 * Adds verse reference prefix and cleans text
 * Returns empty string if text is null/undefined/empty
 */
export function prepareHindiTTS(
  text: string | null | undefined,
  chapter: number,
  verse: number
): string {
  const cleaned = cleanTextForTTS(text);
  if (!cleaned) return "";
  const prefix = getHindiVersePrefix(chapter, verse);
  return prefix + cleaned;
}

/**
 * Prepare English translation for TTS
 * Adds verse reference prefix and cleans text
 * Returns empty string if text is null/undefined/empty
 */
export function prepareEnglishTTS(
  text: string | null | undefined,
  chapter: number,
  verse: number
): string {
  const cleaned = cleanTextForTTS(text);
  if (!cleaned) return "";
  const prefix = getEnglishVersePrefix(chapter, verse);
  return prefix + cleaned;
}

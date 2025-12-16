/**
 * Sanskrit text formatting utilities for displaying Devanagari verses
 */

export interface SanskritFormatterOptions {
  /**
   * Mode of formatting
   * - 'detail': Full formatting with speaker intros included (for VerseDetail, NotFound)
   * - 'compact': Compact formatting skipping speaker intros, using | for internal separators (for VerseCard, FeaturedVerse)
   * @default 'detail'
   */
  mode?: "detail" | "compact";

  /**
   * Whether to include speaker intro lines
   * @default true for 'detail' mode, false for 'compact' mode
   */
  includeSpeakerIntro?: boolean;
}

/**
 * Format Sanskrit text to display with proper line breaks
 * - Removes verse number at the end
 * - Splits verse on danda marks and formats appropriately
 * - Handles speaker intros based on options
 *
 * @param text - Raw Sanskrit text in Devanagari script
 * @param options - Formatting options (mode, includeSpeakerIntro)
 * @returns Array of formatted lines, each representing a clause or line of verse
 *
 * @example Detail mode (with speaker intros):
 * const lines = formatSanskritLines(verse.sanskrit_devanagari, { mode: 'detail' });
 * // "श्रीभगवानुवाच"
 * // "हतो वा प्राप्यसि स्वर्गं जित्वा वा भोक्ष्यसे महीम् ।"
 *
 * @example Compact mode (skips speaker intros):
 * const lines = formatSanskritLines(verse.sanskrit_devanagari, { mode: 'compact' });
 * // "हतो वा प्राप्यसि स्वर्गं |"
 * // "जित्वा वा भोक्ष्यसे महीम् ॥"
 */
export function formatSanskritLines(
  text: string,
  options: SanskritFormatterOptions = {},
): string[] {
  if (!text) return [];

  const { mode = "detail", includeSpeakerIntro } = options;

  // Determine if we include speaker intros
  const shouldIncludeSpeaker = includeSpeakerIntro ?? mode === "detail";

  // Remove the verse number at the end (e.g., ।।2.52।। or ॥2.52॥)
  const withoutVerseNum = text.replace(/[।॥]+\d+\.\d+[।॥]+\s*$/, "");

  // Break line after speaker intros (वाच = "said/spoke")
  // This handles cases where speaker intro is inline with verse content
  // e.g., "श्रीभगवानुवाचऊर्ध्वमूलम्..." → "श्रीभगवानुवाच\nऊर्ध्वमूलम्..."
  //
  // IMPORTANT: Only match वाच at the START of the verse (before first danda)
  // वाच appearing later in the verse is regular word content, not speaker cue
  // Using lookahead to ensure वाच is followed by non-danda content (the actual verse)
  const withSpeakerBreaks = withoutVerseNum.replace(
    /^([^।]*वाच)\s*(?=[^।])/,
    "$1\n",
  );

  // Split by newlines to detect speaker intro lines
  const lines = withSpeakerBreaks
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);

  const result: string[] = [];
  let verseLineIndex = 0;

  // Process each line
  for (const line of lines) {
    // Check if this line is a speaker intro (ends with वाच - said/spoke)
    // e.g., "सञ्जय उवाच", "श्रीभगवानुवाच"
    if (/वाच\s*$/.test(line)) {
      if (shouldIncludeSpeaker) {
        // Include speaker intro as-is
        result.push(line);
      }
      // Otherwise skip it
      continue;
    }

    if (mode === "detail") {
      // Detail mode: full formatting with alternating दण्ड
      const parts = line.split(/।(?=[^।])/);
      const isEvenLine = (verseLineIndex + 1) % 2 === 0;
      const endDanda = isEvenLine ? " ॥" : " ।";

      if (parts.length >= 2) {
        // Multiple clauses in this line
        for (let i = 0; i < parts.length - 1; i++) {
          result.push(parts[i].trim() + " ।");
        }
        result.push(
          parts[parts.length - 1].replace(/।+\s*$/, "").trim() + endDanda,
        );
      } else {
        // Single clause
        result.push(line.replace(/।+\s*$/, "").trim() + endDanda);
      }
    } else {
      // Compact mode: split on danda, use | for internal separators
      const parts = line.split(/।/).filter((p) => p.trim());

      if (parts.length === 0) continue;

      const isEvenLine = (verseLineIndex + 1) % 2 === 0;

      for (let i = 0; i < parts.length; i++) {
        let formattedPart = parts[i].trim();

        // Add appropriate danda
        if (i < parts.length - 1) {
          formattedPart += " |";
        } else {
          formattedPart += isEvenLine ? " ॥" : " ।";
        }

        result.push(formattedPart);
      }
    }

    verseLineIndex++;
  }

  return result.length > 0 ? result : [text.trim()];
}

/**
 * Check if a verse line is a speaker introduction
 * Speaker intros end with वाच (said/spoke) - e.g., "सञ्जय उवाच", "श्रीभगवानुवाच"
 * @param line - The verse line to check
 * @returns True if line is a speaker introduction (ends with वाच)
 */
export function isSpeakerIntro(line: string): boolean {
  // Speaker intro lines end with वाच (possibly with trailing whitespace)
  return /वाच\s*$/.test(line);
}

/**
 * Convert a human-readable verse reference to canonical URL path
 * @param ref - Human-readable reference (e.g., "BG 2.47")
 * @returns URL-safe canonical ID (e.g., "BG_2_47")
 *
 * @example
 * verseRefToCanonicalId("BG 2.47") // "BG_2_47"
 * verseRefToCanonicalId("BG 18.63") // "BG_18_63"
 */
export function verseRefToCanonicalId(ref: string): string {
  return ref.replace(/\s/g, "_").replace(/\./g, "_");
}

/**
 * Get the URL path for a verse from its human-readable reference
 * @param ref - Human-readable reference (e.g., "BG 2.47")
 * @returns URL path (e.g., "/verses/BG_2_47")
 */
export function getVersePath(ref: string): string {
  return `/verses/${verseRefToCanonicalId(ref)}`;
}

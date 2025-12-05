/**
 * Sanskrit text formatting utilities for displaying Devanagari verses
 */

/**
 * Format Sanskrit text to display with proper line breaks
 * - Removes verse number at the end
 * - Splits verse on danda marks and formats with alternating | and ||
 * - Separates speaker intros on their own line with special styling
 *
 * @param text - Raw Sanskrit text in Devanagari script
 * @returns Array of formatted lines, each representing a clause or line of verse
 *
 * @example
 * const lines = formatSanskritLines(verse.sanskrit_devanagari);
 * lines.forEach(line => console.log(line));
 * // Output:
 * // "श्रीभगवानुवाच"
 * // "हतो वा प्राप्यसि स्वर्गं जित्वा वा भोक्ष्यसे महीम् ।"
 * // "तस्मादुत्तिष्ठ कौन्तेय युद्धाय कृतनिश्चयः ॥"
 */
export function formatSanskritLines(text: string): string[] {
  if (!text) return [];

  // Remove the verse number at the end (e.g., ।।2.52।। or ॥2.52॥)
  const withoutVerseNum = text.replace(/[।॥]+\d+\.\d+[।॥]+\s*$/, '');

  // Split by newlines to detect speaker intro lines
  const lines = withoutVerseNum.split('\n').map(l => l.trim()).filter(l => l);

  const result: string[] = [];

  let verseLineIndex = 0;

  // Process each line
  for (const line of lines) {
    // Check if this line contains speaker intro (contains वाच - said/spoke)
    if (line.includes('वाच')) {
      // This is a speaker intro line, add it as-is
      result.push(line);
    } else {
      // This is verse content, split on danda
      const parts = line.split(/।(?=[^।])/);

      // Alternate between single (।) and double (॥) danda for each verse line
      // Odd verse lines (1st, 3rd, etc.) get single danda
      // Even verse lines (2nd, 4th, etc.) get double danda
      const isEvenLine = (verseLineIndex + 1) % 2 === 0;
      const endDanda = isEvenLine ? ' ॥' : ' ।';

      if (parts.length >= 2) {
        // Multiple clauses in this line
        for (let i = 0; i < parts.length - 1; i++) {
          result.push(parts[i].trim() + ' ।');
        }
        result.push(parts[parts.length - 1].replace(/।+\s*$/, '').trim() + endDanda);
      } else {
        // Single clause
        result.push(line.replace(/।+\s*$/, '').trim() + endDanda);
      }

      verseLineIndex++;
    }
  }

  return result.length > 0 ? result : [text.trim()];
}

/**
 * Check if a verse line is a speaker introduction
 * @param line - The verse line to check
 * @returns True if line contains speaker introduction (contains वाच)
 */
export function isSpeakerIntro(line: string): boolean {
  return line.includes('वाच');
}

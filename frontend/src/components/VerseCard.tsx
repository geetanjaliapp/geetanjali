import { Link } from 'react-router-dom';
import type { Verse } from '../types';

interface VerseCardProps {
  verse: Verse;
}

function formatVerseRef(verse: Verse): string {
  return `${verse.chapter}.${verse.verse}`;
}

function getVerseLink(verse: Verse): string {
  return `/verses/${verse.canonical_id}`;
}

/**
 * Format Sanskrit text to display with proper line breaks
 * - Separates speaker intros (श्री भगवानुवाच, धृतराष्ट्र उवाच, etc.) on their own line
 * - Splits verse content on single danda (।) and adds proper spacing
 * - Uses alternating danda pattern: single (।), double (॥), single (।), double (॥)
 */
function formatSanskritLines(text: string): string[] {
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

export function VerseCard({ verse }: VerseCardProps) {
  const sanskritLines = formatSanskritLines(verse.sanskrit_devanagari || '');

  return (
    <div className="relative">
      {/* Main Card */}
      <div className="bg-gradient-to-b from-orange-50 to-amber-50 rounded-xl p-8 border-2 border-amber-200/50 shadow-inner">
        {/* Decorative Om - centered */}
        <div className="text-center text-amber-400/50 text-3xl font-light mb-4">ॐ</div>

        {/* Verses centered */}
        <div>
          {/* Sanskrit Text */}
          {sanskritLines.length > 0 && (
            <div className="text-xl md:text-2xl text-amber-800/60 font-serif text-center leading-relaxed tracking-wide mb-6">
              {sanskritLines.map((line, idx) => {
                // Check if this is a speaker intro line (contains वाच)
                const isSpeakerIntro = line.includes('वाच');

                return (
                  <p key={idx} className={`${isSpeakerIntro ? 'text-lg text-amber-600/60 mb-2' : 'mb-1'}`}>
                    {line}
                  </p>
                );
              })}
            </div>
          )}

          {/* English Translation (prefer translation_en, fallback to paraphrase_en) */}
          {(verse.translation_en || verse.paraphrase_en) && (
            <p className="text-lg text-gray-700 text-center leading-relaxed italic">
              "{verse.translation_en || verse.paraphrase_en}"
            </p>
          )}
        </div>

        {/* Citation Link - centered */}
        <div className="text-center pt-6">
          <Link
            to={getVerseLink(verse)}
            className="inline-block text-amber-600/70 hover:text-amber-700 transition-colors text-sm font-medium"
          >
            ॥ {formatVerseRef(verse)} ॥
          </Link>
        </div>
      </div>
    </div>
  );
}

export default VerseCard;

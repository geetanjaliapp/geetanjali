import { Link } from 'react-router-dom';
import type { Verse } from '../types';

interface VerseCardProps {
  verse: Verse;
}

function formatVerseRef(verse: Verse): string {
  return `${verse.chapter}.${verse.verse}`;
}

function getVerseLink(verse: Verse): string {
  return `/verses?highlight=${verse.id}`;
}

/**
 * Format Sanskrit text to display on two lines
 * Splits on single danda (।) and adds proper spacing
 */
function formatSanskritLines(text: string): string[] {
  if (!text) return [];

  // Remove the verse number at the end (e.g., ।।2.52।। or ॥2.52॥)
  const withoutVerseNum = text.replace(/[।॥]+\d+\.\d+[।॥]+\s*$/, '');

  // Split on single danda followed by content (but not double danda)
  const parts = withoutVerseNum.split(/।(?=[^।])/);

  if (parts.length >= 2) {
    // Format: first line ends with ।, second line ends with ॥
    return [
      parts[0].trim() + ' ।',
      parts.slice(1).join('।').replace(/।+\s*$/, '').trim() + ' ॥'
    ];
  }

  // If can't split, return as single line
  return [text.trim()];
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
          {/* Sanskrit Text - two lines */}
          {sanskritLines.length > 0 && (
            <div className="text-xl md:text-2xl text-amber-800/60 font-serif text-center leading-relaxed tracking-wide mb-6">
              {sanskritLines.map((line, idx) => (
                <p key={idx} className="mb-1">{line}</p>
              ))}
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

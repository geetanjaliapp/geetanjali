import { Link } from 'react-router-dom';
import type { Verse } from '../types';

export interface VerseCardProps {
  verse: Verse;
  displayMode?: 'detail' | 'compact';
  showSpeaker?: boolean;
  showCitation?: boolean;
  showTranslation?: boolean;
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
 * - For compact mode: normalize spacing and preserve full text
 */
function formatSanskritLines(text: string, compactMode: boolean = false): string[] {
  if (!text) return [];

  // Remove the verse number at the end (e.g., ।।2.52।। or ॥2.52॥)
  const withoutVerseNum = text.replace(/[।॥]+\d+\.\d+[।॥]+\s*$/, '');

  // Split by newlines to detect speaker intro lines
  const lines = withoutVerseNum.split('\n').map(l => l.trim()).filter(l => l);

  if (compactMode) {
    // For compact mode: normalize whitespace, keep full text, split on danda for cleaner display
    const result: string[] = [];
    let verseLineIndex = 0;

    for (const line of lines) {
      if (line.includes('वाच')) {
        result.push(line);
      } else {
        // Split on danda but keep full text in each line
        const parts = line.split(/।/).filter(p => p.trim());
        if (parts.length > 0) {
          // Join parts with proper spacing
          const cleanedLine = parts.map(p => p.trim()).join(' | ');
          result.push(cleanedLine);
        }
        verseLineIndex++;
      }
    }
    return result.length > 0 ? result : [text.trim()];
  }

  // Detail mode: original formatting logic
  const result: string[] = [];
  let verseLineIndex = 0;

  for (const line of lines) {
    if (line.includes('वाच')) {
      result.push(line);
    } else {
      const parts = line.split(/।(?=[^।])/);

      const isEvenLine = (verseLineIndex + 1) % 2 === 0;
      const endDanda = isEvenLine ? ' ॥' : ' ।';

      if (parts.length >= 2) {
        for (let i = 0; i < parts.length - 1; i++) {
          result.push(parts[i].trim() + ' ।');
        }
        result.push(parts[parts.length - 1].replace(/।+\s*$/, '').trim() + endDanda);
      } else {
        result.push(line.replace(/।+\s*$/, '').trim() + endDanda);
      }

      verseLineIndex++;
    }
  }

  return result.length > 0 ? result : [text.trim()];
}

export function VerseCard({
  verse,
  displayMode = 'detail',
  showSpeaker = true,
  showCitation = true,
  showTranslation = true,
}: VerseCardProps) {
  const isCompact = displayMode === 'compact';
  const sanskritLines = formatSanskritLines(verse.sanskrit_devanagari || '', isCompact);

  // Compact mode: filter out speaker intros for cleaner display
  const displayLines = showSpeaker ? sanskritLines : sanskritLines.filter(line => !line.includes('वाच'));

  return (
    <div className="relative">
      {/* Main Card */}
      <div className={`${isCompact
        ? 'bg-white rounded-lg p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow'
        : 'bg-gradient-to-b from-orange-50 to-amber-50 rounded-xl p-8 border-2 border-amber-200/50 shadow-inner'
      }`}>
        {/* Decorative Om - centered (both modes for visual consistency) */}
        <div className={`text-center mb-4 ${isCompact
          ? 'text-xl text-gray-300/60'
          : 'text-3xl text-amber-400/50 font-light'
        }`}>
          ॐ
        </div>

        {/* Verses centered */}
        <div>
          {/* Sanskrit Text */}
          {displayLines.length > 0 && (
            <div className={`${isCompact
              ? 'text-sm text-gray-700 font-serif text-center leading-relaxed mb-3'
              : 'text-xl md:text-2xl text-amber-800/60 font-serif text-center leading-relaxed tracking-wide mb-6'
            }`}>
              {displayLines.map((line, idx) => {
                const isSpeakerIntro = line.includes('वाच');

                return (
                  <p
                    key={idx}
                    className={`${isCompact
                      ? 'mb-1'
                      : isSpeakerIntro ? 'text-lg text-amber-600/60 mb-2' : 'mb-1'
                    }`}
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          )}

          {/* English Translation - only in detail mode */}
          {!isCompact && showTranslation && (verse.translation_en || verse.paraphrase_en) && (
            <p className="text-lg text-gray-700 text-center leading-relaxed italic">
              "{verse.translation_en || verse.paraphrase_en}"
            </p>
          )}
        </div>

        {/* Citation Link - centered */}
        {showCitation && (
          <div className={`text-center ${isCompact ? 'pt-2' : 'pt-6'}`}>
            <Link
              to={getVerseLink(verse)}
              className={`inline-block transition-colors ${isCompact
                ? 'text-gray-400 hover:text-gray-600 text-xs font-medium'
                : 'text-amber-600/70 hover:text-amber-700 text-sm font-medium'
              }`}
            >
              ॥ {formatVerseRef(verse)} ॥
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerseCard;

import { Link } from 'react-router-dom';
import { formatSanskritLines, isSpeakerIntro } from '../lib/sanskritFormatter';
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

export function VerseCard({
  verse,
  displayMode = 'detail',
  showSpeaker = true,
  showCitation = true,
  showTranslation = true,
}: VerseCardProps) {
  const isCompact = displayMode === 'compact';
  const sanskritLines = formatSanskritLines(verse.sanskrit_devanagari || '', {
    mode: isCompact ? 'compact' : 'detail',
    includeSpeakerIntro: showSpeaker,
  });

  // Compact mode: filter out speaker intros for cleaner display
  let displayLines = showSpeaker ? sanskritLines : sanskritLines.filter(line => !line.includes('वाच'));

  // For compact mode, ensure all cards have same height by padding to 4 lines
  if (isCompact) {
    // Count only non-empty lines to determine padding
    const nonEmptyLines = displayLines.filter(line => line.trim() !== '');
    const targetLines = 4;

    if (nonEmptyLines.length < targetLines) {
      const spacersNeeded = targetLines - nonEmptyLines.length;
      const spacersPerSide = Math.floor(spacersNeeded / 2);
      const remainingSpacer = spacersNeeded % 2;

      // Add spacer lines above and below
      displayLines = [
        ...Array(spacersPerSide).fill(''),
        ...nonEmptyLines,
        ...Array(spacersPerSide + remainingSpacer).fill('')
      ];
    } else if (nonEmptyLines.length > targetLines) {
      // If verse has more than 4 lines, use those lines as is
      displayLines = nonEmptyLines;
    } else {
      // If exactly 4 lines, use them
      displayLines = nonEmptyLines;
    }
  }

  return (
    <div className="relative">
      {/* Main Card */}
      <div className={`${isCompact
        ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-xl p-6 border border-amber-200/50 shadow-md hover:shadow-lg hover:border-amber-300 transition-all h-full flex flex-col'
        : 'bg-gradient-to-b from-orange-50 to-amber-50 rounded-xl p-8 border-2 border-amber-200/50 shadow-inner'
      }`}>
        {/* Decorative Om - centered */}
        <div className={`text-center mb-4 ${isCompact
          ? 'text-2xl text-amber-400/50 font-light'
          : 'text-3xl text-amber-400/50 font-light'
        }`}>
          ॐ
        </div>

        {/* Verses centered - flex-grow to ensure consistent heights */}
        <div className={`flex-grow flex flex-col ${isCompact ? 'justify-between' : 'justify-center'}`}>
          {/* Sanskrit Text */}
          {displayLines.length > 0 && (
            <div className={`${isCompact
              ? 'text-sm text-amber-900 font-serif text-center leading-relaxed'
              : 'text-xl md:text-2xl text-amber-800/60 font-serif text-center leading-relaxed tracking-wide mb-6'
            }`}>
              {displayLines.map((line, idx) => {
                const isEmpty = line === '';

                return (
                  <p
                    key={idx}
                    className={`${isCompact
                      ? isEmpty ? 'h-4' : 'mb-1'
                      : isSpeakerIntro(line) ? 'text-lg text-amber-600/60 mb-2' : 'mb-1'
                    }`}
                  >
                    {!isEmpty && line}
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
          <div className={`text-center ${isCompact ? 'pt-3' : 'pt-6'}`}>
            <Link
              to={getVerseLink(verse)}
              className={`inline-block transition-colors ${isCompact
                ? 'text-amber-700/70 hover:text-amber-900 text-xs font-medium'
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

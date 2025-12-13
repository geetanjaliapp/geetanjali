import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { getPrincipleShortLabel } from "../constants/principles";
import type { Verse } from "../types";

export interface VerseCardProps {
  verse: Verse;
  displayMode?: "detail" | "compact";
  showSpeaker?: boolean;
  showCitation?: boolean;
  showTranslation?: boolean;
  showTranslationPreview?: boolean; // For compact mode: truncated translation_en
  onPrincipleClick?: (principle: string) => void; // Callback when a principle tag is clicked
}

function formatVerseRef(verse: Verse): string {
  return `${verse.chapter}.${verse.verse}`;
}

function getVerseLink(verse: Verse): string {
  return `/verses/${verse.canonical_id}`;
}

/**
 * P1.5 FIX: Memoized verse card component to prevent unnecessary re-renders.
 * Uses React.memo and useMemo for formatSanskritLines computation.
 */
export const VerseCard = memo(function VerseCard({
  verse,
  displayMode = "detail",
  showSpeaker = true,
  showCitation = true,
  showTranslation = true,
  showTranslationPreview = false,
  onPrincipleClick,
}: VerseCardProps) {
  const isCompact = displayMode === "compact";

  // P1.5 FIX: Memoize expensive formatSanskritLines computation
  const sanskritLines = useMemo(
    () =>
      formatSanskritLines(verse.sanskrit_devanagari || "", {
        mode: isCompact ? "compact" : "detail",
        includeSpeakerIntro: isCompact ? false : showSpeaker,
      }),
    [verse.sanskrit_devanagari, isCompact, showSpeaker],
  );

  // Compact mode: Sanskrit-only display for verse browsing
  if (isCompact) {
    // Use translation_en for grid (literal), paraphrase_en reserved for detail page (curated)
    const translationText = showTranslationPreview ? (verse.translation_en || "") : "";

    return (
      <div className="relative bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-150">
        {/* Featured Badge */}
        {verse.is_featured && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] sm:text-xs font-medium">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          </div>
        )}

        {/* Verse Reference */}
        <div className="text-amber-600 font-serif font-medium text-xs sm:text-sm mb-2 sm:mb-3">
          ॥ {formatVerseRef(verse)} ॥
        </div>

        {/* Full Sanskrit Verse */}
        <div lang="sa" className="text-amber-900 font-serif text-sm sm:text-base leading-relaxed text-center">
          {sanskritLines.map((line, idx) => (
            <p key={idx} className="mb-0.5">
              {line}
            </p>
          ))}
        </div>

        {/* Translation preview (if enabled and available) */}
        {showTranslationPreview && translationText && (
          <>
            {/* Subtle divider */}
            <div className="my-2 sm:my-3 border-t border-amber-200/50" />
            {/* Translation with CSS line-clamp */}
            <p className="text-xs sm:text-sm text-gray-600 text-center leading-relaxed line-clamp-3">
              "{translationText}"
            </p>
          </>
        )}

        {/* Principle Tags (max 2 + overflow indicator) */}
        {verse.consulting_principles && verse.consulting_principles.length > 0 && (
          <div className="mt-2 sm:mt-3 flex flex-wrap justify-center gap-1">
            {verse.consulting_principles.slice(0, 2).map((principle) => (
              <button
                key={principle}
                onClick={(e) => {
                  if (onPrincipleClick) {
                    e.preventDefault();
                    e.stopPropagation();
                    onPrincipleClick(principle);
                  }
                }}
                className={`px-2 py-0.5 rounded-full bg-amber-100/70 text-amber-800 text-[10px] sm:text-xs font-medium ${
                  onPrincipleClick ? "hover:bg-amber-200 cursor-pointer transition-colors" : ""
                }`}
              >
                {getPrincipleShortLabel(principle)}
              </button>
            ))}
            {verse.consulting_principles.length > 2 && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] sm:text-xs font-medium">
                +{verse.consulting_principles.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Detail mode: keep speaker intro filtering logic
  const displayLines = showSpeaker
    ? sanskritLines
    : sanskritLines.filter((line) => !isSpeakerIntro(line));

  // Detail mode: original layout
  return (
    <div className="relative">
      <div className="bg-gradient-to-b from-orange-50 to-amber-50 rounded-xl p-5 sm:p-6 lg:p-8 border-2 border-amber-200/50 shadow-inner">
        {/* Decorative Om */}
        <div className="text-center mb-3 sm:mb-4 text-2xl sm:text-3xl text-amber-400/50 font-light">
          ॐ
        </div>

        {/* Verses centered */}
        <div className="flex-grow flex flex-col justify-center">
          {/* Sanskrit Text */}
          {displayLines.length > 0 && (
            <div lang="sa" className="text-base sm:text-xl md:text-2xl text-amber-800/60 font-serif text-center leading-relaxed tracking-wide mb-4 sm:mb-6">
              {displayLines.map((line, idx) => (
                <p
                  key={idx}
                  className={
                    isSpeakerIntro(line)
                      ? "text-lg text-amber-600/60 mb-2"
                      : "mb-1"
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* English Translation */}
          {showTranslation && (verse.translation_en || verse.paraphrase_en) && (
            <p className="text-sm sm:text-base lg:text-lg text-gray-700 text-center leading-relaxed italic">
              "{verse.translation_en || verse.paraphrase_en}"
            </p>
          )}
        </div>

        {/* Citation Link */}
        {showCitation && (
          <div className="text-center pt-4 sm:pt-6">
            <Link
              to={getVerseLink(verse)}
              className="inline-block transition-colors text-amber-600/70 hover:text-amber-700 text-xs sm:text-sm font-medium"
            >
              ॥ {formatVerseRef(verse)} ॥
            </Link>
          </div>
        )}
      </div>
    </div>
  );
});

export default VerseCard;

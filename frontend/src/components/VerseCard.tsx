import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { getPrincipleShortLabel } from "../constants/principles";
import { StarIcon, HeartIcon } from "./icons";
import type { Verse } from "../types";

/**
 * Skeleton loading state for VerseCard.
 * Matches compact card layout for smooth transition.
 */
export function VerseCardSkeleton() {
  return (
    <div className="bg-amber-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-amber-200 dark:border-gray-700 shadow-xs animate-pulse">
      {/* Verse Reference skeleton */}
      <div className="flex justify-center mb-2 sm:mb-3">
        <div className="h-4 w-16 bg-amber-200/60 dark:bg-gray-700 rounded-sm" />
      </div>

      {/* Sanskrit lines skeleton */}
      <div className="space-y-2 flex flex-col items-center">
        <div className="h-4 w-4/5 bg-amber-200/50 dark:bg-gray-700 rounded-sm" />
        <div className="h-4 w-3/4 bg-amber-200/50 dark:bg-gray-700 rounded-sm" />
        <div className="h-4 w-4/5 bg-amber-200/50 dark:bg-gray-700 rounded-sm" />
        <div className="h-4 w-2/3 bg-amber-200/50 dark:bg-gray-700 rounded-sm" />
      </div>

      {/* Divider skeleton */}
      <div className="my-2 sm:my-3 border-t border-amber-200/30 dark:border-gray-700" />

      {/* Translation skeleton */}
      <div className="space-y-1.5 flex flex-col items-center">
        <div className="h-3 w-11/12 bg-gray-200/60 dark:bg-gray-700 rounded-sm" />
        <div className="h-3 w-4/5 bg-gray-200/60 dark:bg-gray-700 rounded-sm" />
        <div className="h-3 w-3/4 bg-gray-200/60 dark:bg-gray-700 rounded-sm" />
      </div>

      {/* Tags skeleton */}
      <div className="mt-2 sm:mt-3 flex justify-center gap-1">
        <div className="h-5 w-14 bg-amber-100 dark:bg-gray-700 rounded-full" />
        <div className="h-5 w-12 bg-amber-100 dark:bg-gray-700 rounded-full" />
      </div>
    </div>
  );
}

/** Match type labels for search results */
const MATCH_TYPE_LABELS: Record<string, string> = {
  exact_canonical: "Verse Reference",
  exact_sanskrit: "Sanskrit",
  keyword_translation: "Translation",
  keyword_paraphrase: "Leadership Insight",
  principle: "Topic",
  semantic: "Meaning",
};

/** Search match info for displaying highlighted results */
export interface VerseMatch {
  type:
    | "exact_canonical"
    | "exact_sanskrit"
    | "keyword_translation"
    | "keyword_paraphrase"
    | "principle"
    | "semantic";
  highlight?: string; // Pre-highlighted text with <mark> tags from API
  field?: string; // Which field matched (e.g., "translation", "sanskrit")
}

export interface VerseCardProps {
  verse: Verse;
  displayMode?: "detail" | "compact";
  showSpeaker?: boolean;
  showCitation?: boolean;
  showTranslation?: boolean;
  showTranslationPreview?: boolean; // For compact mode: truncated translation_en
  onPrincipleClick?: (principle: string) => void; // Callback when a principle tag is clicked
  linkTo?: string; // For compact mode: stretched link pattern (card navigates here, tags remain clickable)
  isFavorite?: boolean;
  onToggleFavorite?: (verseId: string) => void;
  /** Search match info - when provided, displays match type badge and highlighted text */
  match?: VerseMatch;
}

function formatVerseRef(verse: Verse): string {
  return `${verse.chapter}.${verse.verse}`;
}

/**
 * Render highlighted text with <mark> tags as React elements.
 * Used for search result highlighting.
 */
function HighlightedText({ text }: { text: string }) {
  if (!text) return null;

  const parts = text.split(/(<mark>.*?<\/mark>)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("<mark>") && part.endsWith("</mark>")) {
          const content = part.slice(6, -7);
          return (
            <mark
              key={i}
              className="bg-amber-200 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200 px-0.5 rounded-sm"
            >
              {content}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
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
  linkTo,
  isFavorite = false,
  onToggleFavorite,
  match,
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
    const translationText = showTranslationPreview
      ? verse.translation_en || ""
      : "";

    return (
      <div className="relative bg-amber-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-amber-200 dark:border-gray-700 shadow-xs hover:shadow-md hover:border-amber-300 dark:hover:border-gray-600 hover:-translate-y-0.5 transition-all duration-150">
        {/* Stretched link - covers entire card for navigation (accessibility pattern) */}
        {linkTo && (
          <Link
            to={linkTo}
            className="absolute inset-0 z-0 rounded-xl focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            aria-label={`View verse ${formatVerseRef(verse)}`}
          />
        )}

        {/* Featured Badge - top LEFT corner (moved from right to make room for match badge) */}
        {verse.is_featured && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
              <StarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </span>
          </div>
        )}

        {/* Top-right: Match badge + Heart (flex row, heart always rightmost) */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex items-center gap-1.5">
          {match && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-[10px] sm:text-xs font-medium">
              {MATCH_TYPE_LABELS[match.type] || match.type}
            </span>
          )}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(verse.canonical_id);
              }}
              className={`p-2.5 sm:p-1 -m-1.5 sm:m-0 rounded-full transition-all duration-150 pointer-events-auto focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${
                isFavorite
                  ? "text-red-500 dark:text-red-400"
                  : "text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 hover:scale-110"
              }`}
              aria-label={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              <HeartIcon
                className="w-4 h-4"
                filled={isFavorite}
              />
            </button>
          )}
        </div>

        {/* Card content - pointer-events-none so clicks pass through to stretched link */}
        <div className={linkTo ? "relative z-10 pointer-events-none" : ""}>
          {/* Verse Reference - centered, mt-6 clears space for absolute badges */}
          <div className="flex items-center justify-center mt-6 sm:mt-5 mb-2 sm:mb-3">
            <span className="text-amber-600 dark:text-amber-400 font-serif font-medium text-xs sm:text-sm">
              ॥ {formatVerseRef(verse)} ॥
            </span>
          </div>

          {/* Full Sanskrit Verse */}
          <div
            lang="sa"
            className="text-amber-900 dark:text-amber-200 font-sanskrit text-sm sm:text-base leading-relaxed text-center"
          >
            {sanskritLines.map((line, idx) => (
              <p key={idx} className="mb-0.5">
                {line}
              </p>
            ))}
          </div>

          {/* Translation preview - with match highlighting when available */}
          {(match?.highlight ||
            (showTranslationPreview && translationText)) && (
            <>
              {/* Subtle divider */}
              <div className="my-2 sm:my-3 border-t border-amber-200/50 dark:border-gray-700" />
              {/* Translation with highlighting or line-clamp */}
              {match?.highlight ? (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                  {'"'}
                  <HighlightedText text={match.highlight} />
                  {'"'}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed line-clamp-2 sm:line-clamp-3">
                  "{translationText}"
                </p>
              )}
              {/* "Matched in" indicator for search results */}
              {match?.field && (
                <p className="mt-1 text-center text-[10px] text-gray-400 dark:text-gray-500">
                  Matched in: {match.field}
                </p>
              )}
            </>
          )}
        </div>

        {/* Principle Tags - pointer-events-auto so they're clickable above the stretched link */}
        {verse.consulting_principles &&
          verse.consulting_principles.length > 0 && (
            <div
              className={`mt-2 sm:mt-3 flex flex-wrap justify-center gap-1 ${linkTo ? "relative z-10" : ""}`}
            >
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
                  className={`px-2 py-0.5 rounded-full bg-amber-100/70 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] sm:text-xs font-medium pointer-events-auto focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${
                    onPrincipleClick
                      ? "hover:bg-amber-200 dark:hover:bg-amber-800/40 cursor-pointer transition-colors"
                      : ""
                  }`}
                >
                  {getPrincipleShortLabel(principle)}
                </button>
              ))}
              {verse.consulting_principles.length > 2 && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-medium">
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
      <div className="bg-linear-to-b from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-5 sm:p-6 lg:p-8 border-2 border-amber-200/50 dark:border-gray-700 shadow-inner">
        {/* Decorative Om */}
        <div className="text-center mb-3 sm:mb-4 text-2xl sm:text-3xl text-amber-400/50 dark:text-amber-500/40 font-light">
          ॐ
        </div>

        {/* Verses centered */}
        <div className="grow flex flex-col justify-center">
          {/* Sanskrit Text */}
          {displayLines.length > 0 && (
            <div
              lang="sa"
              className="text-base sm:text-xl lg:text-2xl text-amber-800/60 dark:text-amber-300/80 font-sanskrit text-center leading-relaxed tracking-wide mb-4 sm:mb-6"
            >
              {displayLines.map((line, idx) => (
                <p
                  key={idx}
                  className={
                    isSpeakerIntro(line)
                      ? "text-lg text-amber-600/60 dark:text-amber-400/60 mb-2"
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
            <p className="text-sm sm:text-base lg:text-lg text-gray-700 dark:text-gray-300 text-center leading-relaxed italic">
              "{verse.translation_en || verse.paraphrase_en}"
            </p>
          )}
        </div>

        {/* Citation Link */}
        {showCitation && (
          <div className="text-center pt-4 sm:pt-6">
            <Link
              to={`/verses/${verse.canonical_id}`}
              className="inline-block transition-colors text-amber-600/70 dark:text-amber-400/70 hover:text-amber-700 dark:hover:text-amber-300 text-xs sm:text-sm font-medium"
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

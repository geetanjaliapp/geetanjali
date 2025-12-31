import { memo, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { getPrincipleShortLabel } from "../constants/principles";
import {
  StarIcon,
  HeartIcon,
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
  CheckIcon,
  AlertCircleIcon,
} from "./icons";
import { useAudioPlayer } from "./audio";
import type { Verse } from "../types";

/**
 * Skeleton loading state for VerseCard.
 * Matches compact card layout for smooth transition.
 */
export function VerseCardSkeleton() {
  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] p-3 sm:p-4 border border-[var(--border-warm)] shadow-[var(--shadow-card)] animate-pulse">
      {/* Verse Reference skeleton */}
      <div className="flex justify-center mb-2 sm:mb-3">
        <div className="h-4 w-16 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
      </div>

      {/* Sanskrit lines skeleton */}
      <div className="space-y-2 flex flex-col items-center">
        <div className="h-4 w-4/5 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
        <div className="h-4 w-3/4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
        <div className="h-4 w-4/5 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
        <div className="h-4 w-2/3 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
      </div>

      {/* Divider skeleton */}
      <div className="my-2 sm:my-3 border-t border-[var(--border-warm-subtle)]" />

      {/* Translation skeleton */}
      <div className="space-y-1.5 flex flex-col items-center">
        <div className="h-3 w-11/12 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
        <div className="h-3 w-4/5 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
        <div className="h-3 w-3/4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
      </div>

      {/* Tags skeleton */}
      <div className="mt-2 sm:mt-3 flex justify-center gap-1">
        <div className="h-5 w-14 bg-[var(--skeleton-bg)] rounded-[var(--radius-badge)]" />
        <div className="h-5 w-12 bg-[var(--skeleton-bg)] rounded-[var(--radius-badge)]" />
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
              className="bg-[var(--badge-match-bg)] text-[var(--badge-match-text)] px-0.5 rounded-[var(--radius-skeleton)]"
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

  // Audio player state
  const {
    currentlyPlaying,
    state: audioState,
    error: audioError,
    play: audioPlay,
    pause: audioPause,
    resume: audioResume,
    retry: audioRetry,
  } = useAudioPlayer();

  // Check if this verse is currently playing
  const isThisPlaying = currentlyPlaying === verse.canonical_id;
  const hasAudio = Boolean(verse.audio_url);

  // Handle audio play/pause
  const handleAudioClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!verse.audio_url) return;

      if (isThisPlaying) {
        if (audioState === "error") {
          audioRetry();
        } else if (audioState === "playing") {
          audioPause();
        } else if (audioState === "paused") {
          audioResume();
        } else {
          // completed or idle - restart
          audioPlay(verse.canonical_id, verse.audio_url);
        }
      } else {
        audioPlay(verse.canonical_id, verse.audio_url);
      }
    },
    [
      verse.audio_url,
      verse.canonical_id,
      isThisPlaying,
      audioState,
      audioPlay,
      audioPause,
      audioResume,
      audioRetry,
    ],
  );

  // Check if audio is actively playing (for visual indicator)
  const isAudioPlaying = isThisPlaying && audioState === "playing";

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
      <div
        className={`relative bg-[var(--surface-card)] rounded-[var(--radius-card)] p-3 sm:p-4 border hover:-translate-y-0.5 transition-[var(--transition-card)] ${
          isAudioPlaying
            ? "border-[var(--interactive-primary)] shadow-[var(--shadow-card-hover)]"
            : "border-[var(--border-warm)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--border-warm-hover)]"
        }`}
      >
        {/* Stretched link - covers entire card for navigation (accessibility pattern) */}
        {linkTo && (
          <Link
            to={linkTo}
            className="absolute inset-0 z-0 rounded-[var(--radius-card)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
            aria-label={`View verse ${formatVerseRef(verse)}`}
          />
        )}

        {/* Featured Badge - top LEFT corner (moved from right to make room for match badge) */}
        {verse.is_featured && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-badge)] bg-[var(--badge-featured-bg)] text-[var(--badge-featured-text)]">
              <StarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </span>
          </div>
        )}

        {/* Top-right: Match badge + Heart + Audio (play button furthest right for consistency) */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex items-center gap-1.5">
          {match && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-badge)] bg-[var(--badge-match-bg)] text-[var(--badge-match-text)] text-[10px] sm:text-xs font-medium">
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
              className={`p-2 sm:p-1 -m-1 sm:m-0 rounded-[var(--radius-badge)] transition-[var(--transition-card)] pointer-events-auto focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                isFavorite
                  ? "text-[var(--icon-favorite)]"
                  : "text-[var(--text-muted)] hover:text-[var(--icon-favorite)] hover:scale-110"
              }`}
              aria-label={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              <HeartIcon
                className="w-5 h-5 sm:w-4 sm:h-4"
                filled={isFavorite}
              />
            </button>
          )}
          {/* Audio play button - furthest right for consistent placement */}
          {hasAudio && (
            <div className="flex flex-col items-end gap-0.5">
              <button
                onClick={handleAudioClick}
                disabled={isThisPlaying && audioState === "loading"}
                className={`p-3 sm:p-1 -m-1 sm:m-0 rounded-full transition-[var(--transition-all)] pointer-events-auto focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                  isThisPlaying && audioState === "error"
                    ? "text-[var(--status-error-text)] bg-[var(--status-error-text)]/10"
                    : isThisPlaying && audioState === "completed"
                      ? "text-[var(--status-success-text)] bg-[var(--status-success-text)]/10"
                      : isThisPlaying && audioState === "playing"
                        ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                        : "text-[var(--text-muted)] hover:text-[var(--interactive-primary)] hover:bg-[var(--surface-muted)]"
                } ${isThisPlaying && audioState === "loading" ? "opacity-50" : ""}`}
                aria-label={
                  isThisPlaying && audioState === "error"
                    ? `Retry verse ${formatVerseRef(verse)} audio`
                    : isThisPlaying && audioState === "completed"
                      ? `Replay verse ${formatVerseRef(verse)} audio`
                      : isThisPlaying && audioState === "playing"
                        ? `Pause verse ${formatVerseRef(verse)} audio`
                        : isThisPlaying && audioState === "loading"
                          ? `Loading verse ${formatVerseRef(verse)} audio`
                          : `Play verse ${formatVerseRef(verse)} audio`
                }
              >
                {isThisPlaying && audioState === "loading" ? (
                  <SpinnerIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                ) : isThisPlaying && audioState === "error" ? (
                  <AlertCircleIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                ) : isThisPlaying && audioState === "completed" ? (
                  <CheckIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                ) : isThisPlaying && audioState === "playing" ? (
                  <PauseIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                ) : (
                  <PlayIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                )}
              </button>
              {/* Error message tooltip */}
              {isThisPlaying && audioState === "error" && audioError && (
                <span className="text-[10px] text-[var(--status-error-text)] bg-[var(--surface-elevated)] px-1.5 py-0.5 rounded-[var(--radius-badge)] shadow-sm max-w-24 text-right truncate pointer-events-auto">
                  {audioError}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card content - pointer-events-none so clicks pass through to stretched link */}
        <div className={linkTo ? "relative z-10 pointer-events-none" : ""}>
          {/* Verse Reference - centered, mt-6 clears space for absolute badges */}
          <div className="flex items-center justify-center mt-6 sm:mt-5 mb-2 sm:mb-3">
            <span className="text-[var(--text-accent)] font-serif font-medium text-xs sm:text-sm">
              ॥ {formatVerseRef(verse)} ॥
            </span>
          </div>

          {/* Full Sanskrit Verse */}
          <div
            lang="sa"
            className="text-[var(--text-sanskrit)] font-sanskrit text-sm sm:text-base leading-relaxed text-center"
          >
            {sanskritLines.map((line, idx) => (
              <p key={idx} className="mb-0.5">
                {line}
              </p>
            ))}
          </div>

          {/* Translation preview - always visible (audio controls moved to FloatingAudioBar) */}
          {match?.highlight || (showTranslationPreview && translationText) ? (
            <>
              {/* Subtle divider */}
              <div className="my-2 sm:my-3 border-t border-[var(--border-warm-subtle)]" />
              {/* Content area */}
              <div className="min-h-[2.5rem] sm:min-h-[3.5rem]">
                {match?.highlight ? (
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] text-center leading-relaxed">
                    {'"'}
                    <HighlightedText text={match.highlight} />
                    {'"'}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] text-center leading-relaxed line-clamp-2 sm:line-clamp-3">
                    "{translationText}"
                  </p>
                )}
              </div>
              {/* "Matched in" indicator for search results */}
              {match?.field && (
                <p className="mt-1 text-center text-[10px] text-[var(--text-muted)]">
                  Matched in: {match.field}
                </p>
              )}
            </>
          ) : null}
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
                  className={`px-2 py-0.5 rounded-[var(--radius-badge)] bg-[var(--badge-principle-bg)] text-[var(--badge-principle-text)] text-[10px] sm:text-xs font-medium pointer-events-auto focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                    onPrincipleClick
                      ? "hover:bg-[var(--badge-warm-hover)] cursor-pointer transition-[var(--transition-color)]"
                      : ""
                  }`}
                >
                  {getPrincipleShortLabel(principle)}
                </button>
              ))}
              {verse.consulting_principles.length > 2 && (
                <span className="px-2 py-0.5 rounded-[var(--radius-badge)] bg-[var(--badge-default-bg)] text-[var(--badge-default-text)] text-[10px] sm:text-xs font-medium">
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
      <div className="bg-linear-to-b from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] rounded-[var(--radius-card)] p-5 sm:p-6 lg:p-8 border-2 border-[var(--border-warm-subtle)] shadow-[var(--shadow-button-active)]">
        {/* Decorative Om */}
        <div className="text-center mb-3 sm:mb-4 text-2xl sm:text-3xl text-[var(--decorative-om)] font-light">
          ॐ
        </div>

        {/* Verses centered */}
        <div className="grow flex flex-col justify-center">
          {/* Sanskrit Text */}
          {displayLines.length > 0 && (
            <div
              lang="sa"
              className="text-base sm:text-xl lg:text-2xl text-[var(--text-sanskrit-secondary)] font-sanskrit text-center leading-relaxed tracking-wide mb-4 sm:mb-6"
            >
              {displayLines.map((line, idx) => (
                <p
                  key={idx}
                  className={
                    isSpeakerIntro(line)
                      ? "text-lg text-[var(--text-accent-muted)] mb-2"
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
            <p className="text-sm sm:text-base lg:text-lg text-[var(--text-secondary)] text-center leading-relaxed italic">
              "{verse.translation_en || verse.paraphrase_en}"
            </p>
          )}
        </div>

        {/* Citation Link */}
        {showCitation && (
          <div className="text-center pt-4 sm:pt-6">
            <Link
              to={`/verses/${verse.canonical_id}`}
              className="inline-block transition-[var(--transition-color)] text-[var(--text-accent-muted)] hover:text-[var(--text-accent)] text-xs sm:text-sm font-medium"
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

import { useCallback } from "react";
import { Link } from "react-router-dom";
import { formatSanskritLines } from "../lib/sanskritFormatter";
import { useAudioPlayer } from "./audio";
import { PlayIcon, PauseIcon, SpinnerIcon, CheckIcon, AlertCircleIcon } from "./icons";
import type { Verse } from "../types";

interface FeaturedVerseProps {
  verse: Verse | null;
  loading?: boolean;
  error?: boolean;
}

export function FeaturedVerse({
  verse,
  loading = false,
  error = false,
}: FeaturedVerseProps) {
  // Audio player state - hooks must be called unconditionally (Rules of Hooks)
  const {
    currentlyPlaying,
    state: audioState,
    play: audioPlay,
    pause: audioPause,
    resume: audioResume,
    retry: audioRetry,
  } = useAudioPlayer();

  // Check if this verse is currently playing
  const isThisPlaying = verse ? currentlyPlaying === verse.canonical_id : false;
  const hasAudio = Boolean(verse?.audio_url);

  // Handle audio play/pause
  const handleAudioClick = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- verse prop is stable, decomposed deps are intentional
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!verse?.audio_url) return;

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
    [verse?.audio_url, verse?.canonical_id, isThisPlaying, audioState, audioPlay, audioPause, audioResume, audioRetry],
  );

  // Format verse reference for aria-labels
  const verseRef = verse ? `${verse.chapter}.${verse.verse}` : "";

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 lg:p-12 border border-[var(--border-warm)] shadow-[var(--shadow-modal)]">
          <div className="text-center space-y-4">
            <div className="h-6 sm:h-8 bg-[var(--surface-muted)] rounded-[var(--radius-skeleton)] animate-pulse w-20 sm:w-24 mx-auto" />
            <div className="h-24 sm:h-32 bg-[var(--surface-muted)] rounded-[var(--radius-skeleton)] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 lg:p-12 border border-[var(--border-warm)] shadow-[var(--shadow-card-elevated)]">
          <div className="text-center space-y-3">
            <div className="text-3xl text-[var(--badge-warm-text)]/50">ॐ</div>
            <p className="text-[var(--text-tertiary)] text-sm">
              Unable to load today's verse
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!verse) {
    return null;
  }

  // verseRef already computed above (line 61) for use in aria-labels and display
  const sanskritLines = formatSanskritLines(verse.sanskrit_devanagari || "", {
    mode: "compact",
  });

  return (
    <Link
      to={`/verses/${verse.canonical_id}`}
      className="block max-w-4xl mx-auto"
    >
      {/* Main Featured Verse Container - Clickable */}
      <div className="relative bg-[var(--surface-card)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 lg:p-12 border border-[var(--border-warm)] shadow-[var(--shadow-modal)] hover:shadow-[var(--shadow-modal)] hover:border-[var(--border-warm-hover)] transition-[var(--transition-card)] cursor-pointer">
        {/* Audio play button - absolute positioned to avoid layout shift */}
        {hasAudio && (
          <button
            onClick={handleAudioClick}
            disabled={audioState === "loading" && isThisPlaying}
            className={`absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-3 sm:p-2 rounded-full transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] disabled:opacity-70 disabled:cursor-not-allowed ${
              isThisPlaying && audioState === "error"
                ? "text-[var(--status-error-text)] bg-[var(--status-error-text)]/10"
                : isThisPlaying && audioState === "completed"
                  ? "text-[var(--status-success-text)] bg-[var(--status-success-text)]/10"
                  : isThisPlaying && audioState === "playing"
                    ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                    : "text-[var(--text-muted)] hover:text-[var(--interactive-primary)] hover:bg-[var(--surface-muted)]"
            }`}
            aria-label={
              isThisPlaying && audioState === "error"
                ? `Retry verse ${verseRef} audio`
                : isThisPlaying && audioState === "completed"
                  ? `Replay verse ${verseRef} audio`
                  : isThisPlaying && audioState === "playing"
                    ? `Pause verse ${verseRef} audio`
                    : isThisPlaying && audioState === "loading"
                      ? `Loading verse ${verseRef} audio`
                      : `Play verse ${verseRef} audio`
            }
          >
            {isThisPlaying && audioState === "loading" ? (
              <SpinnerIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : isThisPlaying && audioState === "error" ? (
              <AlertCircleIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : isThisPlaying && audioState === "completed" ? (
              <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : isThisPlaying && audioState === "playing" ? (
              <PauseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>
        )}

        {/* Sanskrit Devanagari - Spotlight */}
        {verse.sanskrit_devanagari && (
          <div className="text-center mb-4 sm:mb-6 lg:mb-8">
            <div className="text-3xl sm:text-4xl text-[var(--badge-warm-text)]/50 mb-3 sm:mb-4 lg:mb-6 font-light">
              ॐ
            </div>
            <div
              lang="sa"
              className="text-lg sm:text-2xl lg:text-3xl font-sanskrit text-[var(--text-primary)] leading-relaxed tracking-wide mb-3 sm:mb-4 lg:mb-6 space-y-1"
            >
              {sanskritLines.map((line, idx) => (
                <p key={idx} className="mb-0">
                  {line}
                </p>
              ))}
            </div>
            <span className="text-[var(--badge-warm-text)]/70 font-serif text-lg">
              ॥ {verseRef} ॥
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default FeaturedVerse;

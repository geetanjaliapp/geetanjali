/**
 * IntroCard - Book cover and chapter intro display for Reading Mode
 *
 * Styled like VerseFocus but displays intro content instead of verses.
 * Used for:
 * - Book cover (shown when entering /read)
 * - Chapter intros (shown when entering a new chapter)
 *
 * Features:
 * - Sanskrit title/name as hero text
 * - Tap to reveal more details (like translation reveal in VerseFocus)
 * - Consistent styling with the verse reading experience
 */

import { useState, useCallback, useEffect } from "react";
import type { BookMetadata, ChapterMetadata } from "../types";
import type { FontSize } from "./VerseFocus";

// Font size classes matching VerseFocus - dramatic steps for noticeable difference
const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-base sm:text-lg lg:text-xl",
  medium: "text-xl sm:text-2xl lg:text-3xl",
  large: "text-3xl sm:text-4xl lg:text-5xl",
};

interface BookIntroProps {
  type: "book";
  book: BookMetadata;
  chapter?: never;
  fontSize?: FontSize;
  onBegin?: () => void;
}

interface ChapterIntroProps {
  type: "chapter";
  chapter: ChapterMetadata;
  book?: never;
  fontSize?: FontSize;
  onBegin?: () => void;
  resumeVerse?: number | null; // If set, shows "Resume at verse X" instead of "Begin"
}

type IntroCardProps = BookIntroProps | ChapterIntroProps;

export function IntroCard(props: IntroCardProps) {
  const { type, fontSize = "medium" } = props;
  // Start with details expanded for better UX
  // Note: When content changes, ReadingMode provides a new `key` prop which
  // causes React to remount the component, resetting state to initial value
  const [showDetails, setShowDetails] = useState(true);

  const handleToggle = useCallback(() => {
    setShowDetails((prev) => !prev);
  }, []);

  // Space key to toggle details (desktop)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        handleToggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleToggle]);

  if (type === "book") {
    const { book, onBegin } = props;
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col">
        <div className="flex-shrink-0">
          <button
            onClick={handleToggle}
            className="w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-stone-900 rounded-xl transition-transform active:scale-[0.99]"
            aria-expanded={showDetails}
            aria-label={showDetails ? "Hide details" : "Show details"}
          >
            {/* Om symbol */}
            <div className="text-3xl sm:text-4xl text-amber-400/50 mb-2 sm:mb-3 font-light">
              ॐ
            </div>

            {/* Sanskrit title - hero display */}
            <div
              lang="sa"
              className={`${FONT_SIZE_CLASSES[fontSize]} font-sanskrit text-amber-900 dark:text-amber-200 leading-relaxed tracking-wide mb-2 sm:mb-3`}
            >
              <p>{book.sanskrit_title}</p>
            </div>

            {/* Transliteration */}
            <div className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-serif italic mb-2">
              {book.transliteration}
            </div>

            {/* English title with stats */}
            <div className="text-gray-700 dark:text-gray-300 text-base sm:text-lg font-serif mb-1">
              ॥ {book.english_title} ॥
            </div>

            {/* Stats - moved up for visibility */}
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {book.chapter_count} Chapters · {book.verse_count} Verses
            </div>

            {/* Hints (only show when details hidden) */}
            {!showDetails && (
              <div className="space-y-2">
                <div className="text-sm text-amber-600/70 dark:text-amber-400/70 italic animate-pulse">
                  Tap to begin
                </div>
                <div className="sm:hidden text-xs text-amber-600/60 dark:text-amber-400/60">
                  ← swipe →
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Details panel - expands downward */}
        <div
          className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
            showDetails
              ? "max-h-[1000px] opacity-100 mt-4"
              : "max-h-0 opacity-0 mt-0"
          }`}
        >
          <div className="border-t border-amber-200/50 dark:border-stone-700 pt-4 space-y-3">
            {/* Tagline */}
            <div className="bg-amber-100/30 dark:bg-stone-800/50 rounded-xl p-3 border border-amber-200/30 dark:border-stone-700">
              <p className="text-sm sm:text-base text-amber-800/80 dark:text-amber-300/90 leading-relaxed italic font-serif text-center">
                "{book.tagline}"
              </p>
            </div>

            {/* Begin Journey CTA */}
            {onBegin && (
              <div className="text-center">
                <button
                  onClick={onBegin}
                  className="px-8 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 dark:bg-amber-700 dark:hover:bg-amber-600 dark:active:bg-amber-500 text-white font-medium rounded-xl transition-colors shadow-md hover:shadow-lg"
                >
                  Begin Journey
                </button>
              </div>
            )}

            {/* Intro text */}
            <div className="bg-white/70 dark:bg-stone-800/60 rounded-xl p-3 border border-amber-200/50 dark:border-stone-700">
              <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                {book.intro_text}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chapter intro
  const { chapter, onBegin, resumeVerse } = props;
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col">
      <div className="flex-shrink-0">
        <button
          onClick={handleToggle}
          className="w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-stone-900 rounded-xl transition-transform active:scale-[0.99]"
          aria-expanded={showDetails}
          aria-label={showDetails ? "Hide details" : "Show details"}
        >
          {/* Om symbol */}
          <div className="text-3xl sm:text-4xl text-amber-400/50 mb-2 sm:mb-3 font-light">
            ॐ
          </div>

          {/* Chapter badge */}
          <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Chapter {chapter.chapter_number}
          </div>

          {/* Sanskrit name - hero display */}
          <div
            lang="sa"
            className={`${FONT_SIZE_CLASSES[fontSize]} font-sanskrit text-amber-900 dark:text-amber-200 leading-relaxed tracking-wide mb-2 sm:mb-3`}
          >
            <p>{chapter.sanskrit_name}</p>
          </div>

          {/* Transliteration */}
          <div className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-serif italic mb-2">
            {chapter.transliteration}
          </div>

          {/* English title */}
          <div className="text-gray-700 dark:text-gray-300 text-base sm:text-lg font-serif mb-1">
            ॥ {chapter.english_title} ॥
          </div>

          {/* Verse count - moved up for visibility */}
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {chapter.verse_count} verses
          </div>

          {/* Hints (only show when details hidden) */}
          {!showDetails && (
            <div className="space-y-2">
              <div className="text-sm text-amber-600/70 dark:text-amber-400/70 italic animate-pulse">
                Tap for summary
              </div>
              <div className="sm:hidden text-xs text-amber-600/60 dark:text-amber-400/60">
                ← swipe →
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Details panel - expands downward */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          showDetails
            ? "max-h-[1000px] opacity-100 mt-4"
            : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="border-t border-amber-200/50 dark:border-stone-700 pt-4 space-y-3">
          {/* Subtitle if present */}
          {chapter.subtitle && (
            <div className="bg-amber-100/30 dark:bg-stone-800/50 rounded-xl p-3 border border-amber-200/30 dark:border-stone-700">
              <p className="text-sm sm:text-base text-amber-800/80 dark:text-amber-300/90 leading-relaxed italic font-serif text-center">
                "{chapter.subtitle}"
              </p>
            </div>
          )}

          {/* Begin/Resume CTA - subdued style */}
          {onBegin && (
            <div className="text-center">
              <button
                onClick={onBegin}
                className="px-6 py-2 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium border border-amber-300 dark:border-amber-600 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-stone-800 rounded-lg transition-colors"
              >
                {resumeVerse && resumeVerse > 1
                  ? `Continue from ${chapter.chapter_number}.${resumeVerse}`
                  : "Begin Chapter"}
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white/70 dark:bg-stone-800/60 rounded-xl p-3 border border-amber-200/50 dark:border-stone-700">
            <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed">
              {chapter.summary}
            </p>
          </div>

          {/* Key themes */}
          {chapter.key_themes && chapter.key_themes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {chapter.key_themes.map((theme, index) => (
                <span
                  key={index}
                  className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IntroCard;

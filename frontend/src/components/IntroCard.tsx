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

// Font size classes matching VerseFocus
const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-lg sm:text-xl md:text-2xl",
  medium: "text-xl sm:text-2xl md:text-3xl",
  large: "text-2xl sm:text-3xl md:text-4xl",
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
}

type IntroCardProps = BookIntroProps | ChapterIntroProps;

export function IntroCard(props: IntroCardProps) {
  const { type, fontSize = "medium" } = props;
  // Start with details expanded for better UX
  const [showDetails, setShowDetails] = useState(true);

  // Keep details expanded when content changes (intro cards should show content by default)
  useEffect(() => {
    setShowDetails(true);
  }, [type, props.type === "book" ? props.book?.book_key : props.chapter?.chapter_number]);

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
            className="w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 rounded-xl transition-transform active:scale-[0.99]"
            aria-expanded={showDetails}
            aria-label={showDetails ? "Hide details" : "Show details"}
          >
            {/* Om symbol */}
            <div className="text-3xl sm:text-4xl text-amber-400/50 mb-3 sm:mb-4 lg:mb-6 font-light">
              ॐ
            </div>

            {/* Sanskrit title - hero display */}
            <div
              lang="sa"
              className={`${FONT_SIZE_CLASSES[fontSize]} font-serif text-amber-900/70 leading-relaxed tracking-wide mb-3 sm:mb-4`}
            >
              <p className="mb-1 sm:mb-2">{book.sanskrit_title}</p>
            </div>

            {/* Transliteration */}
            <div className="text-amber-700/60 text-base sm:text-lg font-serif italic mb-4">
              {book.transliteration}
            </div>

            {/* English title with stats */}
            <div className="text-amber-600/70 text-base sm:text-lg font-serif mb-4">
              ॥ {book.english_title} ॥
            </div>

            {/* Hints (only show when details hidden) */}
            {!showDetails && (
              <div className="space-y-2">
                <div className="text-sm text-amber-500/60 italic animate-pulse">
                  Tap to begin
                </div>
                <div className="sm:hidden text-xs text-amber-400/50">
                  ← swipe →
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Details panel - expands downward */}
        <div
          className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
            showDetails ? "max-h-[1000px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
          }`}
        >
          <div className="border-t border-amber-200/50 pt-6 space-y-4">
            {/* Tagline */}
            <div className="bg-amber-100/30 rounded-xl p-4 border border-amber-200/30">
              <p className="text-base text-amber-800/80 leading-relaxed italic font-serif text-center">
                "{book.tagline}"
              </p>
            </div>

            {/* Begin Journey CTA */}
            {onBegin && (
              <div className="text-center pt-2">
                <button
                  onClick={onBegin}
                  className="px-8 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium rounded-xl transition-colors shadow-md hover:shadow-lg"
                >
                  Begin Journey
                </button>
              </div>
            )}

            {/* Intro text */}
            <div className="bg-white/70 rounded-xl p-4 border border-amber-200/50">
              <p className="text-base text-gray-800 leading-relaxed">
                {book.intro_text}
              </p>
            </div>

            {/* Stats */}
            <div className="text-center text-sm text-amber-600/70">
              {book.chapter_count} Chapters · {book.verse_count} Verses
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chapter intro
  const chapter = props.chapter;
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col">
      <div className="flex-shrink-0">
        <button
          onClick={handleToggle}
          className="w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 rounded-xl transition-transform active:scale-[0.99]"
          aria-expanded={showDetails}
          aria-label={showDetails ? "Hide details" : "Show details"}
        >
          {/* Om symbol */}
          <div className="text-3xl sm:text-4xl text-amber-400/50 mb-3 sm:mb-4 lg:mb-6 font-light">
            ॐ
          </div>

          {/* Chapter badge */}
          <div className="text-sm text-amber-600/60 uppercase tracking-widest mb-3">
            Chapter {chapter.chapter_number}
          </div>

          {/* Sanskrit name - hero display */}
          <div
            lang="sa"
            className={`${FONT_SIZE_CLASSES[fontSize]} font-serif text-amber-900/70 leading-relaxed tracking-wide mb-3 sm:mb-4`}
          >
            <p className="mb-1 sm:mb-2">{chapter.sanskrit_name}</p>
          </div>

          {/* Transliteration */}
          <div className="text-amber-700/60 text-base sm:text-lg font-serif italic mb-4">
            {chapter.transliteration}
          </div>

          {/* English title */}
          <div className="text-amber-600/70 text-base sm:text-lg font-serif mb-4">
            ॥ {chapter.english_title} ॥
          </div>

          {/* Hints (only show when details hidden) */}
          {!showDetails && (
            <div className="space-y-2">
              <div className="text-sm text-amber-500/60 italic animate-pulse">
                Tap for summary
              </div>
              <div className="sm:hidden text-xs text-amber-400/50">
                ← swipe →
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Details panel - expands downward */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          showDetails ? "max-h-[1000px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="border-t border-amber-200/50 pt-6 space-y-4">
          {/* Subtitle if present */}
          {chapter.subtitle && (
            <div className="bg-amber-100/30 rounded-xl p-4 border border-amber-200/30">
              <p className="text-base text-amber-800/80 leading-relaxed italic font-serif text-center">
                "{chapter.subtitle}"
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white/70 rounded-xl p-4 border border-amber-200/50">
            <p className="text-base text-gray-800 leading-relaxed">
              {chapter.summary}
            </p>
          </div>

          {/* Key themes */}
          {chapter.key_themes && chapter.key_themes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {chapter.key_themes.map((theme, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}

          {/* Verse count */}
          <div className="text-center text-sm text-amber-600/70">
            {chapter.verse_count} verses
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntroCard;

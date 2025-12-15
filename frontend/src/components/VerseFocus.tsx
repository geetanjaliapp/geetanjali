/**
 * VerseFocus - Single verse display for Reading Mode
 *
 * Features:
 * - Sanskrit hero text (large, centered, fixed position)
 * - Tap/click to reveal translations (Hindi + English)
 * - Translation panel expands downward only (no layout shift)
 * - Lazy loading of translations
 * - Styling matches VerseDetail page
 *
 * Used by: ReadingMode
 */

import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { versesApi } from "../lib/api";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { getTranslatorPriority } from "../constants/translators";
import type { Verse, Translation } from "../types";

/** Font size options for Sanskrit text */
export type FontSize = "small" | "medium" | "large";

interface VerseFocusProps {
  /** The verse to display */
  verse: Verse;
  /** Font size for Sanskrit text */
  fontSize?: FontSize;
  /** Controlled mode: whether translation is shown */
  showTranslation?: boolean;
  /** Controlled mode: callback to toggle translation */
  onToggleTranslation?: () => void;
  /** Callback when user taps the verse (deprecated, use onToggleTranslation) */
  onTap?: () => void;
}

/**
 * Sort translations by priority (lower number = higher priority)
 */
function sortTranslations(translations: Translation[]): Translation[] {
  return [...translations].sort((a, b) => {
    const priorityA = getTranslatorPriority(a.translator);
    const priorityB = getTranslatorPriority(b.translator);
    return priorityA - priorityB;
  });
}

// Font size classes mapping
const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-lg sm:text-xl md:text-2xl",
  medium: "text-xl sm:text-2xl md:text-3xl",
  large: "text-2xl sm:text-3xl md:text-4xl",
};

const SPEAKER_FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-sm sm:text-base",
  medium: "text-base sm:text-lg",
  large: "text-lg sm:text-xl",
};

export function VerseFocus({
  verse,
  fontSize = "medium",
  showTranslation: controlledShowTranslation,
  onToggleTranslation,
  onTap,
}: VerseFocusProps) {
  // Support both controlled and uncontrolled modes
  const isControlled = controlledShowTranslation !== undefined;
  const [internalShowTranslation, setInternalShowTranslation] = useState(false);
  const showTranslation = isControlled ? controlledShowTranslation : internalShowTranslation;

  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // Reset internal state when verse changes (uncontrolled mode only)
  useEffect(() => {
    if (!isControlled) {
      setInternalShowTranslation(false);
    }
    // Always reset translations cache for new verse
    setTranslations([]);
    setTranslationError(null);
  }, [verse.canonical_id, isControlled]);

  // Get primary translations (first Hindi and first English)
  const hindiTranslation = translations.find((t) => t.language === "hi" || t.language === "hindi");
  const englishTranslation = translations.find((t) => t.language === "en" || t.language === "english");

  // Fetch translations lazily when user first reveals
  const loadTranslations = useCallback(async () => {
    if (translations.length > 0 || loadingTranslations) return;

    setLoadingTranslations(true);
    setTranslationError(null);

    try {
      const data = await versesApi.getTranslations(verse.canonical_id);
      setTranslations(sortTranslations(data));
    } catch {
      setTranslationError("Failed to load translations");
    } finally {
      setLoadingTranslations(false);
    }
  }, [verse.canonical_id, translations.length, loadingTranslations]);

  // Handle tap/click to toggle translation
  const handleToggle = useCallback(() => {
    const newState = !showTranslation;

    // Use controlled callback if available, otherwise update internal state
    if (onToggleTranslation) {
      onToggleTranslation();
    } else {
      setInternalShowTranslation(newState);
    }

    // Load translations when revealing for the first time
    if (newState && translations.length === 0) {
      loadTranslations();
    }

    onTap?.();
  }, [showTranslation, translations.length, loadTranslations, onToggleTranslation, onTap]);

  // Space key to toggle translation (desktop)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Space key toggles translation
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        handleToggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleToggle]);

  // Format Sanskrit text using the shared helper (detail mode with speaker intros)
  const sanskritLines = formatSanskritLines(
    verse.sanskrit_devanagari || verse.sanskrit_iast || "",
    { mode: "detail" }
  );

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col">
      {/* Fixed Sanskrit area - stays in place */}
      <div className="flex-shrink-0">
        <button
          onClick={handleToggle}
          className="w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 rounded-xl transition-transform active:scale-[0.99]"
          aria-expanded={showTranslation}
          aria-label={showTranslation ? "Hide translation" : "Show translation"}
        >
          {/* Om symbol - matching VerseDetail styling */}
          <div className="text-3xl sm:text-4xl text-amber-400/50 mb-3 sm:mb-4 lg:mb-6 font-light">
            ॐ
          </div>

          {/* Sanskrit verse - hero display with formatSanskritLines */}
          <div
            lang="sa"
            className={`${FONT_SIZE_CLASSES[fontSize]} font-serif text-amber-900/70 leading-relaxed tracking-wide mb-3 sm:mb-4`}
          >
            {sanskritLines.map((line, idx) => (
              <p
                key={idx}
                className={
                  isSpeakerIntro(line)
                    ? `${SPEAKER_FONT_SIZE_CLASSES[fontSize]} text-amber-700/60 mb-2 sm:mb-3 italic`
                    : "mb-1 sm:mb-2"
                }
              >
                {line}
              </p>
            ))}
          </div>

          {/* Verse reference with devanagari marks */}
          <div className="text-amber-600/70 text-base sm:text-lg font-serif mb-4">
            ॥ {verse.chapter}.{verse.verse} ॥
          </div>

          {/* Hints (only show when translation is hidden) */}
          {!showTranslation && (
            <div className="space-y-2">
              <div className="text-sm text-amber-500/60 italic animate-pulse">
                Tap for translation
              </div>
              {/* Swipe hint - mobile only */}
              <div className="sm:hidden text-xs text-amber-400/50">
                ← swipe →
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Translation panel - expands downward only */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          showTranslation ? "max-h-[1000px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="border-t border-amber-200/50 pt-6">
          {loadingTranslations ? (
            // Loading state
            <div className="text-center py-4">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-amber-600/70">Loading translations...</p>
            </div>
          ) : translationError ? (
            // Error state
            <div className="text-center py-4">
              <p className="text-sm text-red-600">{translationError}</p>
              <button
                onClick={loadTranslations}
                className="mt-2 text-sm text-amber-600 hover:text-amber-800 underline"
              >
                Try again
              </button>
            </div>
          ) : (
            // Translations display
            <div className="space-y-4">
              {/* IAST (Romanized Sanskrit) - shown first if available */}
              {verse.sanskrit_iast && (
                <div className="bg-amber-100/30 rounded-xl p-4 border border-amber-200/30">
                  <div className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-2">
                    IAST
                  </div>
                  <p className="text-base text-amber-800/80 leading-relaxed italic font-serif">
                    {verse.sanskrit_iast}
                  </p>
                </div>
              )}

              {/* Hindi translation */}
              {hindiTranslation && (
                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/50">
                  <div className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-2">
                    Hindi
                    {hindiTranslation.translator && (
                      <span className="font-normal normal-case tracking-normal ml-2 text-amber-600/60">
                        — {hindiTranslation.translator}
                      </span>
                    )}
                  </div>
                  <p className="text-base text-gray-800 leading-relaxed" lang="hi">
                    {hindiTranslation.text}
                  </p>
                </div>
              )}

              {/* English translation */}
              {englishTranslation && (
                <div className="bg-white/70 rounded-xl p-4 border border-amber-200/50">
                  <div className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-2">
                    English
                    {englishTranslation.translator && (
                      <span className="font-normal normal-case tracking-normal ml-2 text-amber-600/60">
                        — {englishTranslation.translator}
                      </span>
                    )}
                  </div>
                  <p className="text-base text-gray-800 leading-relaxed">
                    {englishTranslation.text}
                  </p>
                </div>
              )}

              {/* Fallback: Use verse's built-in translation if no translations fetched */}
              {!hindiTranslation && !englishTranslation && verse.translation_en && (
                <div className="bg-white/70 rounded-xl p-4 border border-amber-200/50">
                  <div className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-2">
                    English
                  </div>
                  <p className="text-base text-gray-800 leading-relaxed">
                    {verse.translation_en}
                  </p>
                </div>
              )}

              {/* No translations available */}
              {!hindiTranslation && !englishTranslation && !verse.translation_en && (
                <div className="text-center py-4 text-amber-600/60 text-sm">
                  No translations available
                </div>
              )}

              {/* View full details link - adds from=read param */}
              <div className="text-center pt-2">
                <Link
                  to={`/verses/${verse.canonical_id}?from=read`}
                  className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 transition-colors"
                >
                  View full details
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

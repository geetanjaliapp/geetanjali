/**
 * VerseFocus - Single verse display for Reading Mode
 *
 * Features:
 * - Sanskrit hero text (large, centered, fixed position)
 * - Tap/click to reveal translations (Hindi + English)
 * - Translation panel expands downward only (no layout shift)
 * - Lazy loading of translations
 * - Collapsible sections with persistent preferences
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

/** Section identifiers for collapsible content */
type SectionId = "iast" | "insight" | "hindi" | "english";

/** Section expansion preferences */
type SectionPrefs = Record<SectionId, boolean>;

/** localStorage key for section preferences */
const SECTION_PREFS_KEY = "geetanjali:readingSectionPrefs";

/** Default: all sections expanded */
const DEFAULT_SECTION_PREFS: SectionPrefs = {
  iast: true,
  insight: true,
  hindi: true,
  english: true,
};

/** Load section preferences from localStorage */
function loadSectionPrefs(): SectionPrefs {
  try {
    const stored = localStorage.getItem(SECTION_PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new sections
      return { ...DEFAULT_SECTION_PREFS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SECTION_PREFS;
}

/** Save section preferences to localStorage */
function saveSectionPrefs(prefs: SectionPrefs): void {
  try {
    localStorage.setItem(SECTION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

/** Collapsible section with tappable header */
interface CollapsibleSectionProps {
  /** Section identifier */
  id: SectionId;
  /** Display label */
  label: string;
  /** Optional subtitle (e.g., translator name) */
  subtitle?: string;
  /** Whether section is expanded */
  isExpanded: boolean;
  /** Toggle callback */
  onToggle: (id: SectionId) => void;
  /** Background styling class */
  bgClass: string;
  /** Content to render when expanded */
  children: React.ReactNode;
}

function CollapsibleSection({
  id,
  label,
  subtitle,
  isExpanded,
  onToggle,
  bgClass,
  children,
}: CollapsibleSectionProps) {
  return (
    <div
      className={`${bgClass} rounded-xl border border-amber-200/50 overflow-hidden`}
    >
      {/* Tappable header */}
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-100/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
        aria-expanded={isExpanded}
        aria-controls={`section-${id}`}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest">
            {label}
          </span>
          {subtitle && (
            <span className="text-xs font-normal normal-case tracking-normal text-amber-600/60">
              — {subtitle}
            </span>
          )}
        </div>
        {/* Chevron indicator */}
        <svg
          className={`w-4 h-4 text-amber-600/50 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {/* Collapsible content */}
      <div
        id={`section-${id}`}
        className={`transition-all duration-200 ease-in-out ${
          isExpanded
            ? "max-h-[500px] opacity-100"
            : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}

interface VerseFocusProps {
  /** The verse to display */
  verse: Verse;
  /** Font size for Sanskrit text */
  fontSize?: FontSize;
  /** Controlled mode: whether translation is shown */
  showTranslation?: boolean;
  /** Controlled mode: callback to toggle translation */
  onToggleTranslation?: () => void;
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
  small: "text-lg sm:text-xl lg:text-2xl",
  medium: "text-xl sm:text-2xl lg:text-3xl",
  large: "text-2xl sm:text-3xl lg:text-4xl",
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
}: VerseFocusProps) {
  // Support both controlled and uncontrolled modes
  const isControlled = controlledShowTranslation !== undefined;
  const [internalShowTranslation, setInternalShowTranslation] = useState(false);
  const showTranslation = isControlled
    ? controlledShowTranslation
    : internalShowTranslation;

  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // Section expansion preferences (persisted across verses and chapters)
  const [sectionPrefs, setSectionPrefs] =
    useState<SectionPrefs>(loadSectionPrefs);

  // Toggle a section's expanded state and persist
  const toggleSection = useCallback((id: SectionId) => {
    setSectionPrefs((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      saveSectionPrefs(updated);
      return updated;
    });
  }, []);

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
  const hindiTranslation = translations.find(
    (t) => t.language === "hi" || t.language === "hindi",
  );
  const englishTranslation = translations.find(
    (t) => t.language === "en" || t.language === "english",
  );

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

  // Auto-fetch translations when verse changes and translation is visible (controlled mode)
  // This ensures Hindi translation persists when navigating with translation panel open
  useEffect(() => {
    if (
      isControlled &&
      controlledShowTranslation &&
      translations.length === 0 &&
      !loadingTranslations
    ) {
      loadTranslations();
    }
  }, [
    verse.canonical_id,
    isControlled,
    controlledShowTranslation,
    translations.length,
    loadingTranslations,
    loadTranslations,
  ]);

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
  }, [
    showTranslation,
    translations.length,
    loadTranslations,
    onToggleTranslation,
  ]);

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
    { mode: "detail" },
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
            className={`${FONT_SIZE_CLASSES[fontSize]} font-sanskrit text-amber-900/70 leading-relaxed tracking-wide mb-3 sm:mb-4`}
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
          showTranslation
            ? "max-h-[1000px] opacity-100 mt-6"
            : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="border-t border-amber-200/50 pt-6">
          {loadingTranslations ? (
            // Loading state
            <div className="text-center py-4">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-amber-600/70">
                Loading translations...
              </p>
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
            // Translations display with collapsible sections
            <div className="space-y-3">
              {/* IAST (Romanized Sanskrit) */}
              {verse.sanskrit_iast && (
                <CollapsibleSection
                  id="iast"
                  label="IAST"
                  isExpanded={sectionPrefs.iast}
                  onToggle={toggleSection}
                  bgClass="bg-amber-100/30"
                >
                  <p className="text-base text-amber-800/80 leading-relaxed italic font-serif">
                    {verse.sanskrit_iast}
                  </p>
                </CollapsibleSection>
              )}

              {/* Leadership Insight (Paraphrase) */}
              {verse.paraphrase_en && (
                <CollapsibleSection
                  id="insight"
                  label="Leadership Insight"
                  isExpanded={sectionPrefs.insight}
                  onToggle={toggleSection}
                  bgClass="bg-gradient-to-br from-amber-50 to-orange-50/50"
                >
                  <p className="text-base text-gray-800 leading-relaxed">
                    {verse.paraphrase_en}
                  </p>
                </CollapsibleSection>
              )}

              {/* Hindi translation */}
              {hindiTranslation && (
                <CollapsibleSection
                  id="hindi"
                  label="Hindi"
                  subtitle={hindiTranslation.translator}
                  isExpanded={sectionPrefs.hindi}
                  onToggle={toggleSection}
                  bgClass="bg-amber-50/50"
                >
                  <p
                    className="text-base text-gray-800 leading-relaxed"
                    lang="hi"
                  >
                    {hindiTranslation.text}
                  </p>
                </CollapsibleSection>
              )}

              {/* English translation */}
              {englishTranslation && (
                <CollapsibleSection
                  id="english"
                  label="English"
                  subtitle={englishTranslation.translator}
                  isExpanded={sectionPrefs.english}
                  onToggle={toggleSection}
                  bgClass="bg-amber-50/50"
                >
                  <p className="text-base text-gray-800 leading-relaxed">
                    {englishTranslation.text}
                  </p>
                </CollapsibleSection>
              )}

              {/* Fallback: Use verse's built-in translation if no translations fetched */}
              {!hindiTranslation &&
                !englishTranslation &&
                verse.translation_en && (
                  <CollapsibleSection
                    id="english"
                    label="English"
                    isExpanded={sectionPrefs.english}
                    onToggle={toggleSection}
                    bgClass="bg-amber-50/50"
                  >
                    <p className="text-base text-gray-800 leading-relaxed">
                      {verse.translation_en}
                    </p>
                  </CollapsibleSection>
                )}

              {/* No translations available */}
              {!hindiTranslation &&
                !englishTranslation &&
                !verse.translation_en &&
                !verse.paraphrase_en &&
                !verse.sanskrit_iast && (
                  <div className="text-center py-4 text-amber-600/60 text-sm">
                    No translations available
                  </div>
                )}

              {/* Link to verse detail page - adds from=read param for back navigation */}
              <div className="text-center pt-2">
                <Link
                  to={`/verses/${verse.canonical_id}?from=read`}
                  className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 transition-colors"
                >
                  Explore this verse
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

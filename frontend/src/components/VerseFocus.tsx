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
import { versesApi } from "../lib/api";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { getTranslatorPriority } from "../constants/translators";
import {
  HeartIcon,
  ShareIcon,
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
} from "./icons";
import { useFavoritesPrefs } from "../hooks";
import { SpeakButton } from "./SpeakButton";
import { ShareModal } from "./verse/ShareModal";
import { StudyModePlayer } from "./audio/StudyModePlayer";
import { useAudioPlayer } from "./audio/AudioPlayerContext";
import { setStorageItem, STORAGE_KEYS } from "../lib/storage";
import { prepareHindiTTS, prepareEnglishTTS } from "../lib/ttsPreprocess";
import type { Verse, Translation, FontSize } from "../types";

// Re-export for backward compatibility (IntroCard imports from here)
export type { FontSize };

/** Section identifiers for collapsible content */
type SectionId = "iast" | "insight" | "hindi" | "english";

/** Section expansion preferences */
type SectionPrefs = Record<SectionId, boolean>;

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
    const stored = localStorage.getItem(STORAGE_KEYS.readingSectionPrefs);
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
  setStorageItem(STORAGE_KEYS.readingSectionPrefs, prefs);
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
  /** Optional text for TTS (shows speak button when provided) */
  speakText?: string;
  /** Language for TTS ('en' or 'hi') */
  speakLang?: "en" | "hi";
}

function CollapsibleSection({
  id,
  label,
  subtitle,
  isExpanded,
  onToggle,
  bgClass,
  children,
  speakText,
  speakLang = "en",
}: CollapsibleSectionProps) {
  return (
    <div
      className={`${bgClass} rounded-[var(--radius-card)] border border-[var(--border-warm-subtle)] overflow-hidden`}
    >
      {/* Tappable header */}
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--surface-warm-hover)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        aria-expanded={isExpanded}
        aria-controls={`section-${id}`}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">
            {label}
          </span>
          {subtitle && (
            <span className="text-xs font-normal normal-case tracking-normal text-[var(--text-muted)]">
              — {subtitle}
            </span>
          )}
        </div>
        {/* Chevron indicator */}
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${
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
        <div className="px-4 pb-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">{children}</div>
            {speakText && (
              <SpeakButton
                text={speakText}
                lang={speakLang}
                size="sm"
                aria-label={`Listen to ${label.toLowerCase()}`}
              />
            )}
          </div>
        </div>
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

// Font size classes mapping - dramatic steps for noticeable difference
const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-base sm:text-lg lg:text-xl",
  regular: "text-xl sm:text-2xl lg:text-3xl",
  large: "text-3xl sm:text-4xl lg:text-5xl",
};

/** Line height scales with font size for readability */
const LINE_HEIGHT_CLASSES: Record<FontSize, string> = {
  small: "leading-normal", // 1.5
  regular: "leading-relaxed", // 1.625
  large: "leading-loose", // 2.0
};

const SPEAKER_FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-xs sm:text-sm",
  regular: "text-sm sm:text-base",
  large: "text-base sm:text-lg",
};

export function VerseFocus({
  verse,
  fontSize = "regular",
  showTranslation: controlledShowTranslation,
  onToggleTranslation,
}: VerseFocusProps) {
  // Support both controlled and uncontrolled modes
  const isControlled = controlledShowTranslation !== undefined;
  const [internalShowTranslation, setInternalShowTranslation] = useState(false);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);

  // Audio player for verse playback
  const audioPlayer = useAudioPlayer();
  const isThisVersePlaying = audioPlayer.currentlyPlaying === verse.canonical_id;
  const isPlaying = isThisVersePlaying && audioPlayer.state === "playing";
  const isLoading = isThisVersePlaying && audioPlayer.state === "loading";

  // Favorites (synced across devices for logged-in users)
  const { isFavorite, toggleFavorite } = useFavoritesPrefs();

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

  // Get primary translations - match VerseDetail priority:
  // Hindi: Swami Tejomayananda preferred
  // English: Swami Gambirananda preferred
  const hindiTranslations = translations.filter(
    (t) => t.language === "hi" || t.language === "hindi" || t.translator === "Swami Tejomayananda",
  );
  const hindiTranslation =
    hindiTranslations.find((t) => t.translator === "Swami Tejomayananda") ||
    hindiTranslations[0];

  const englishTranslations = translations.filter(
    (t) => t.language === "en" || t.language === "english",
  );
  const englishTranslation =
    englishTranslations.find((t) => t.translator === "Swami Gambirananda") ||
    englishTranslations[0];

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
  }, [showTranslation, translations.length, loadTranslations, onToggleTranslation]);

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

  // Handle play button click
  const handlePlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Don't trigger translation toggle
      if (!verse.audio_url) return;

      if (isPlaying) {
        audioPlayer.pause();
      } else if (isThisVersePlaying && audioPlayer.state === "paused") {
        audioPlayer.resume();
      } else {
        audioPlayer.play(verse.canonical_id, verse.audio_url);
      }
    },
    [verse, isPlaying, isThisVersePlaying, audioPlayer],
  );

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col">
      {/* Fixed Sanskrit area - stays in place */}
      <div className="shrink-0 relative">
        {/* Absolute-positioned action buttons (top-right) - matches VerseDetail */}
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1">
          {/* Play button - p-3 on mobile for 44px touch target (20px icon + 24px padding) */}
          {verse.audio_url && (
            <button
              onClick={handlePlayClick}
              className={`p-3 sm:p-2 rounded-full transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isPlaying
                  ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                  : "text-[var(--text-muted)] hover:text-[var(--interactive-primary)] hover:bg-[var(--surface-muted)]"
              }`}
              aria-label={isPlaying ? "Pause recitation" : "Play recitation"}
            >
              {isLoading ? (
                <SpinnerIcon className="w-5 h-5" />
              ) : isPlaying ? (
                <PauseIcon className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5" />
              )}
            </button>
          )}
          {/* Study Mode button */}
          <div onClick={(e) => e.stopPropagation()}>
            <StudyModePlayer verse={verse} translations={translations} />
          </div>
        </div>

        <button
          onClick={handleToggle}
          className="w-full text-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded-[var(--radius-card)] transition-[var(--transition-transform)] active:scale-[0.99]"
          aria-expanded={showTranslation}
          aria-label={showTranslation ? "Hide translation" : "Show translation"}
        >
          {/* Om symbol - matching VerseDetail styling */}
          <div className="text-3xl sm:text-4xl text-[var(--decorative-om)] mb-3 sm:mb-4 lg:mb-6 font-light">
            ॐ
          </div>

          {/* Sanskrit verse - hero display with formatSanskritLines */}
          {/* v1.22.0: Added reading-sanskrit class for enhanced dark mode glow */}
          <div
            lang="sa"
            className={`reading-sanskrit ${FONT_SIZE_CLASSES[fontSize]} ${LINE_HEIGHT_CLASSES[fontSize]} tracking-wide mb-3 sm:mb-4`}
          >
            {sanskritLines.map((line, idx) => (
              <p
                key={idx}
                className={
                  isSpeakerIntro(line)
                    ? `${SPEAKER_FONT_SIZE_CLASSES[fontSize]} text-[var(--text-muted)] mb-2 sm:mb-3 italic`
                    : "reading-pada"
                }
              >
                {line}
              </p>
            ))}
          </div>

          {/* Verse reference with Heart + Share flanking - matches VerseDetail */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-2">
            {/* Favorite button - p-3 on mobile for 44px touch target */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(verse.canonical_id);
              }}
              className={`p-3 sm:p-2 rounded-[var(--radius-avatar)] transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isFavorite(verse.canonical_id)
                  ? "text-[var(--icon-favorite)]"
                  : "text-[var(--text-muted)] hover:text-[var(--icon-favorite)] hover:scale-110"
              }`}
              aria-label={
                isFavorite(verse.canonical_id)
                  ? "Remove from favorites"
                  : "Add to favorites"
              }
            >
              <HeartIcon
                className="w-5 h-5"
                filled={isFavorite(verse.canonical_id)}
              />
            </button>

            {/* Verse reference - matches VerseDetail styling */}
            <span className="text-[var(--text-accent-muted)] text-base sm:text-lg font-serif">
              ॥ {verse.chapter}.{verse.verse} ॥
            </span>

            {/* Share button - p-3 on mobile for 44px touch target */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowShareModal(true);
              }}
              className="p-3 sm:p-2 rounded-[var(--radius-avatar)] transition-[var(--transition-all)] text-[var(--text-muted)] hover:text-[var(--text-accent)] hover:scale-110 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-label="Share verse"
            >
              <ShareIcon className="w-5 h-5" />
            </button>
          </div>
        </button>

      </div>

      {/* Translation panel - expands downward only */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          showTranslation
            ? "max-h-[1000px] opacity-100 mt-6"
            : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div>
          {loadingTranslations ? (
            // Loading state
            <div className="text-center py-4">
              <div className="w-5 h-5 border-2 border-[var(--interactive-primary)] border-t-transparent rounded-[var(--radius-progress)] animate-spin mx-auto mb-2" />
              <p className="text-sm text-[var(--text-accent-muted)]">
                Loading translations...
              </p>
            </div>
          ) : translationError ? (
            // Error state
            <div className="text-center py-4">
              <p className="text-sm text-[var(--status-error-text)]">
                {translationError}
              </p>
              <button
                onClick={loadTranslations}
                className="mt-2 text-sm text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] underline"
              >
                Try again
              </button>
            </div>
          ) : (
            // Translations display with collapsible sections
            <div className="space-y-3">
              {/* IAST (Romanized Sanskrit) - stays with Sanskrit content */}
              {verse.sanskrit_iast && (
                <CollapsibleSection
                  id="iast"
                  label="IAST"
                  isExpanded={sectionPrefs.iast}
                  onToggle={toggleSection}
                  bgClass="bg-[var(--surface-warm-subtle)]"
                >
                  <p className="text-base text-[var(--text-secondary)] leading-relaxed italic font-serif">
                    {verse.sanskrit_iast}
                  </p>
                </CollapsibleSection>
              )}

              {/* Order below matches Study Mode: English → Hindi → Insight */}

              {/* English translation */}
              {englishTranslation && (
                <CollapsibleSection
                  id="english"
                  label="English"
                  subtitle={englishTranslation.translator}
                  isExpanded={sectionPrefs.english}
                  onToggle={toggleSection}
                  bgClass="bg-[var(--surface-warm-subtle)]"
                  speakText={prepareEnglishTTS(
                    englishTranslation.text,
                    verse.chapter,
                    verse.verse,
                  )}
                  speakLang="en"
                >
                  <p className="text-base text-[var(--text-primary)] leading-relaxed">
                    {englishTranslation.text}
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
                  bgClass="bg-[var(--surface-warm-subtle)]"
                  speakText={prepareHindiTTS(
                    hindiTranslation.text,
                    verse.chapter,
                    verse.verse,
                  )}
                  speakLang="hi"
                >
                  <p
                    className="text-base text-[var(--text-primary)] leading-relaxed"
                    lang="hi"
                  >
                    {hindiTranslation.text}
                  </p>
                </CollapsibleSection>
              )}

              {/* Leadership Insight (Paraphrase) - culmination */}
              {verse.paraphrase_en && (
                <CollapsibleSection
                  id="insight"
                  label="Leadership Insight"
                  isExpanded={sectionPrefs.insight}
                  onToggle={toggleSection}
                  bgClass="bg-linear-to-br from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)]"
                  speakText={prepareEnglishTTS(
                    verse.paraphrase_en,
                    verse.chapter,
                    verse.verse,
                  )}
                  speakLang="en"
                >
                  <p className="text-base text-[var(--text-primary)] leading-relaxed">
                    {verse.paraphrase_en}
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
                    bgClass="bg-[var(--surface-warm-subtle)]"
                    speakText={prepareEnglishTTS(
                      verse.translation_en,
                      verse.chapter,
                      verse.verse,
                    )}
                    speakLang="en"
                  >
                    <p className="text-base text-[var(--text-primary)] leading-relaxed">
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
                  <div className="text-center py-4 text-[var(--text-accent-muted)] text-sm">
                    No translations available
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        verse={verse}
        hindiTranslation={hindiTranslation}
      />
    </div>
  );
}

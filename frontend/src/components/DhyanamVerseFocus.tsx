/**
 * DhyanamVerseFocus - Single Dhyanam verse display
 *
 * Visual design: Option 1C (Minimal Sacred)
 * - ॐ श्री ॐ header (sacred triple Om)
 * - Warm gradient background for Sanskrit card
 * - Theme badge below verse reference
 * - Tap to reveal translations (IAST, English, Hindi)
 * - SpeakButton for English/Hindi TTS
 *
 * Used by: DhyanamPage
 */

import { useState, useCallback, useEffect } from "react";
import { SpeakButton } from "./SpeakButton";
import type { GeetaDhyanamVerse } from "../types";

/** Font size options for Sanskrit text */
export type FontSize = "small" | "medium" | "large";

/** Section identifiers for collapsible content */
type SectionId = "iast" | "english" | "hindi";

/** Section expansion preferences */
type SectionPrefs = Record<SectionId, boolean>;

/** Default: all sections collapsed for Dhyanam (focus on Sanskrit) */
const DEFAULT_SECTION_PREFS: SectionPrefs = {
  iast: false,
  english: false,
  hindi: false,
};

// Font size classes - dramatic steps for noticeable difference
const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-base sm:text-lg lg:text-xl",
  medium: "text-lg sm:text-xl lg:text-2xl",
  large: "text-xl sm:text-2xl lg:text-3xl",
};

/** Line height scales with font size for readability */
const LINE_HEIGHT_CLASSES: Record<FontSize, string> = {
  small: "leading-normal",
  medium: "leading-relaxed",
  large: "leading-loose",
};

/** Collapsible section with tappable header */
interface CollapsibleSectionProps {
  id: SectionId;
  label: string;
  isExpanded: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
  speakText?: string;
  speakLang?: "en" | "hi";
}

function CollapsibleSection({
  id,
  label,
  isExpanded,
  onToggle,
  children,
  speakText,
  speakLang = "en",
}: CollapsibleSectionProps) {
  return (
    <div className="bg-[var(--surface-warm-subtle)] rounded-[var(--radius-card)] border border-[var(--border-warm-subtle)] overflow-hidden">
      {/* Tappable header */}
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--surface-warm-hover)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        aria-expanded={isExpanded}
        aria-controls={`dhyanam-section-${id}`}
      >
        <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">
          {label}
        </span>
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
        id={`dhyanam-section-${id}`}
        className={`transition-all duration-200 ease-in-out ${
          isExpanded
            ? "max-h-[300px] opacity-100"
            : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="px-3 pb-3">
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

interface DhyanamVerseFocusProps {
  /** The Dhyanam verse to display */
  verse: GeetaDhyanamVerse;
  /** Font size for Sanskrit text */
  fontSize?: FontSize;
  /** Whether translation is shown (controlled) */
  showTranslation?: boolean;
  /** Callback to toggle translation */
  onToggleTranslation?: () => void;
}

export function DhyanamVerseFocus({
  verse,
  fontSize = "medium",
  showTranslation: controlledShowTranslation,
  onToggleTranslation,
}: DhyanamVerseFocusProps) {
  // Support both controlled and uncontrolled modes
  const isControlled = controlledShowTranslation !== undefined;
  const [internalShowTranslation, setInternalShowTranslation] = useState(false);

  const showTranslation = isControlled
    ? controlledShowTranslation
    : internalShowTranslation;

  // Section expansion preferences (local to Dhyanam, not persisted)
  const [sectionPrefs, setSectionPrefs] = useState<SectionPrefs>(
    DEFAULT_SECTION_PREFS,
  );

  // Toggle a section's expanded state
  const toggleSection = useCallback((id: SectionId) => {
    setSectionPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Reset state when verse changes
  useEffect(() => {
    if (!isControlled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync internal state with verse prop change
      setInternalShowTranslation(false);
    }
    // Reset section prefs for new verse

    setSectionPrefs(DEFAULT_SECTION_PREFS);
  }, [verse.verse_number, isControlled]);

  // Handle tap/click to toggle translation
  const handleToggle = useCallback(() => {
    if (onToggleTranslation) {
      onToggleTranslation();
    } else {
      setInternalShowTranslation((prev) => !prev);
    }
  }, [onToggleTranslation]);

  // Space key to toggle translation (desktop)
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

  // Parse Sanskrit lines
  const sanskritLines = verse.sanskrit
    .split("\n")
    .filter((line) => line.trim());

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col">
      {/* Fixed Sanskrit area */}
      <div className="shrink-0">
        <button
          onClick={handleToggle}
          className="w-full text-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded-[var(--radius-card)] transition-[var(--transition-transform)] active:scale-[0.99]"
          aria-expanded={showTranslation}
          aria-label={showTranslation ? "Hide translation" : "Show translation"}
        >
          {/* Sacred triple Om header - differentiates from VerseFocus */}
          <div className="text-2xl sm:text-3xl text-[var(--decorative-om)] mb-3 sm:mb-4 font-light tracking-widest">
            ॐ श्री ॐ
          </div>

          {/* Sanskrit verse - no background, inherits from parent card */}
          <div
            lang="sa"
            className={`${FONT_SIZE_CLASSES[fontSize]} ${LINE_HEIGHT_CLASSES[fontSize]} font-sanskrit text-[var(--text-sanskrit)] tracking-wide mb-4`}
          >
            {sanskritLines.map((line, idx) => (
              <p key={idx} className="mb-1 sm:mb-2 last:mb-0">
                {line}
              </p>
            ))}
          </div>

          {/* Verse reference */}
          <div className="text-center mb-2">
            <span className="text-[var(--text-tertiary)] text-sm sm:text-base font-serif">
              Dhyanam · {verse.verse_number} of 9
            </span>
          </div>

          {/* Theme badge */}
          <div className="flex justify-center mb-3">
            <span className="px-3 py-1 bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] text-xs sm:text-sm rounded-[var(--radius-chip)]">
              {verse.theme}
            </span>
          </div>

          {/* Hints (only show when translation is hidden) */}
          {!showTranslation && (
            <div className="space-y-1">
              <div className="text-sm text-[var(--text-accent-muted)] italic">
                Tap for translation
              </div>
              <div className="sm:hidden text-xs text-[var(--text-accent-muted)]">
                ← swipe →
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Translation panel - expands downward only */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          showTranslation
            ? "max-h-[800px] opacity-100 mt-4"
            : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="border-t border-[var(--border-warm-subtle)] pt-4">
          <div className="space-y-2">
            {/* IAST (Romanized Sanskrit) */}
            <CollapsibleSection
              id="iast"
              label="IAST"
              isExpanded={sectionPrefs.iast}
              onToggle={toggleSection}
            >
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed italic font-serif">
                {verse.iast}
              </p>
            </CollapsibleSection>

            {/* English translation */}
            <CollapsibleSection
              id="english"
              label="English"
              isExpanded={sectionPrefs.english}
              onToggle={toggleSection}
              speakText={verse.english}
              speakLang="en"
            >
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {verse.english}
              </p>
            </CollapsibleSection>

            {/* Hindi translation */}
            <CollapsibleSection
              id="hindi"
              label="हिंदी"
              isExpanded={sectionPrefs.hindi}
              onToggle={toggleSection}
              speakText={verse.hindi}
              speakLang="hi"
            >
              <p
                className="text-sm text-[var(--text-primary)] leading-relaxed"
                lang="hi"
              >
                {verse.hindi}
              </p>
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DhyanamVerseFocus;

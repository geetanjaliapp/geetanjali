/**
 * MiniPlayerStudyMode - Study mode active UI
 *
 * Consistent layout with MiniPlayerAutoAdvance:
 * - Top row: Current status | Progress bar + section dots | Verse position
 * - Bottom row: Controls | Skip | Mode indicator with visible label
 */

import { PlayIcon, PauseIcon, SpinnerIcon } from "../../icons";
import type { StudySection } from "../../../hooks/useStudyMode";
import type { StudyAutoModePhase } from "../../../hooks/useStudyAutoMode";

const SECTION_ORDER: StudySection[] = ["sanskrit", "english", "hindi", "insight"];

const SECTION_LABELS: Record<StudySection, string> = {
  sanskrit: "Sanskrit",
  english: "English",
  hindi: "Hindi",
  insight: "Insight",
};

interface MiniPlayerStudyModeProps {
  /** Current phase in the study flow */
  phase: StudyAutoModePhase;
  /** Current section being played (during verse_content phase) */
  currentSection: StudySection | null;
  /** Available sections for current verse */
  availableSections: StudySection[];
  /** Current verse position */
  versePosition: { current: number; total: number };
  /** Whether currently paused */
  isPaused: boolean;
  /** Whether loading translations */
  isLoading: boolean;
  /** Pause callback */
  onPause: () => void;
  /** Resume callback */
  onResume: () => void;
  /** Stop callback */
  onStop: () => void;
  /** Skip current section/phase callback */
  onSkipSection?: () => void;
  /** Skip to next verse callback */
  onSkipVerse?: () => void;
}

export function MiniPlayerStudyMode({
  phase,
  currentSection,
  availableSections,
  versePosition,
  isPaused,
  isLoading,
  onPause,
  onResume,
  onStop,
  onSkipSection,
  onSkipVerse,
}: MiniPlayerStudyModeProps) {
  const currentSectionIndex = currentSection
    ? SECTION_ORDER.indexOf(currentSection)
    : -1;

  // Get section display status
  const getSectionStatus = (section: StudySection): "completed" | "current" | "upcoming" | "skipped" => {
    const sectionIndex = SECTION_ORDER.indexOf(section);
    const isAvailable = availableSections.includes(section);

    if (!isAvailable) return "skipped";
    if (sectionIndex < currentSectionIndex) return "completed";
    if (section === currentSection) return "current";
    return "upcoming";
  };

  // Determine what to display based on phase
  const isIntroPhase = phase === "chapter_intro" || phase === "verse_intro" || phase === "chapter_complete";
  const isVerseContent = phase === "verse_content";

  // Get status text - what's currently playing
  const getStatusText = (): string => {
    if (isLoading) return "Loading...";
    if (isPaused) return "Paused";
    if (phase === "advancing") return "Next verse...";
    if (phase === "chapter_intro") return "Chapter intro";
    if (phase === "verse_intro") return `Verse ${versePosition.current}`;
    if (phase === "chapter_complete") return "Complete";
    if (isVerseContent && currentSection) return SECTION_LABELS[currentSection];
    return "Starting...";
  };

  // Calculate progress
  const completedSections = isVerseContent ? currentSectionIndex : (phase === "chapter_complete" ? SECTION_ORDER.length : 0);
  const totalSections = availableSections.length || SECTION_ORDER.length;
  const progressPercent = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;

  return (
    <div
      className="bg-[var(--surface-reading-header)] backdrop-blur-xs border-t border-[var(--border-reading-header)] px-4 py-2.5"
      role="region"
      aria-label="Study mode player"
    >
      <div className="max-w-4xl mx-auto">
        {/* Top row: Status | Progress + dots | Verse position */}
        <div className="mb-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-reading-tertiary)]">
            {/* Current status - what's playing now */}
            <span className="w-20 truncate text-right">
              {(isLoading || isIntroPhase) ? (
                <span className="text-[var(--interactive-primary)]">{getStatusText()}</span>
              ) : (
                getStatusText()
              )}
            </span>

            {/* Progress bar with section dots */}
            <div className="flex-1 flex items-center gap-2">
              {/* Progress bar */}
              <div className="flex-1 h-1.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--interactive-primary)] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Section dots */}
              <div className="flex items-center gap-1">
                {SECTION_ORDER.map((section) => {
                  const status = getSectionStatus(section);
                  return (
                    <div
                      key={section}
                      className={`w-2 h-2 rounded-full transition-all duration-200 ${
                        status === "completed" ? "bg-[var(--interactive-primary)]" :
                        status === "current" ? "bg-[var(--interactive-primary)] ring-2 ring-[var(--interactive-primary)] ring-opacity-40 scale-110" :
                        status === "upcoming" ? "bg-[var(--surface-tertiary)]" :
                        "bg-[var(--surface-tertiary)] opacity-30"
                      }`}
                      title={SECTION_LABELS[section]}
                    />
                  );
                })}
              </div>
            </div>

            {/* Verse position */}
            <span className="w-12 font-mono text-right">
              {versePosition.current}/{versePosition.total}
            </span>
          </div>
        </div>

        {/* Bottom row: Controls | Skip | Mode indicator */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Pause/Play + Stop */}
          <div className="flex items-center gap-1">
            {/* Pause/Play/Loading */}
            <button
              onClick={isPaused ? onResume : onPause}
              disabled={isLoading}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] hover:opacity-90 transition-[var(--transition-button)] flex items-center justify-center disabled:opacity-70"
              aria-label={isLoading ? "Loading" : isPaused ? "Resume" : "Pause"}
            >
              {isLoading ? (
                <SpinnerIcon className="w-5 h-5" />
              ) : isPaused ? (
                <PlayIcon className="w-5 h-5" />
              ) : (
                <PauseIcon className="w-5 h-5" />
              )}
            </button>

            {/* Stop */}
            <button
              onClick={onStop}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-[var(--radius-button)] text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)] transition-[var(--transition-button)] flex items-center justify-center"
              aria-label="Stop study mode"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>

            {/* Skip button */}
            {((isIntroPhase && onSkipSection) || (isVerseContent && onSkipVerse)) && (
              <button
                onClick={isIntroPhase ? onSkipSection : onSkipVerse}
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-[var(--radius-button)] text-[var(--text-reading-tertiary)] hover:text-[var(--text-reading-secondary)] hover:bg-[var(--interactive-reading-hover-bg)] transition-[var(--transition-button)] flex items-center justify-center"
                aria-label={isIntroPhase ? "Skip introduction" : "Skip to next verse"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Right: Mode indicator with visible label */}
          <div className="flex items-center gap-2 text-sm text-[var(--text-reading-secondary)]">
            {/* Loop icon - indicates continuous auto-advance */}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>

            {/* Study mode icon + visible label */}
            <span className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l9-5-9-5-9 5 9 5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                />
              </svg>
              {/* Visible mode label - always shown */}
              <span className="font-medium">Study</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

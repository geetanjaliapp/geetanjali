/**
 * StudyModePlayer - Visual UI for Study Mode
 *
 * Displays:
 * - Toggle button to start/stop study mode
 * - Section progress indicator showing current section
 * - Play/Pause controls during playback
 *
 * Used by: VerseDetail page
 */

import { useEffect, useRef, useState } from "react";
import { BookOpenIcon, StopIcon, PlayIcon, PauseIcon } from "../icons";
import {
  useStudyMode,
  SECTION_LABELS,
  type StudySection,
  type StudyModeStatus,
} from "../../hooks/useStudyMode";
import type { Verse, Translation } from "../../types";

interface StudyModePlayerProps {
  /** The verse to study */
  verse: Verse;
  /** Translations for the verse (Hindi, English) */
  translations?: Translation[];
  /** Callback when study mode completes */
  onComplete?: () => void;
  /** Callback when current section changes (for parent to expand corresponding UI section) */
  onSectionChange?: (section: StudySection | null) => void;
}

/** Section indicator dot */
function SectionDot({
  section,
  isActive,
  isCompleted,
  status,
}: {
  section: StudySection;
  isActive: boolean;
  isCompleted: boolean;
  status: StudyModeStatus;
}) {
  const isPaused = status === "paused" && isActive;
  const isGap = status === "gap" && isActive;

  return (
    <div
      className={`flex items-center gap-2 py-1.5 transition-colors duration-200 ${
        isActive
          ? "text-[var(--interactive-primary)] font-medium"
          : isCompleted
            ? "text-[var(--text-secondary)]"
            : "text-[var(--text-muted)]"
      }`}
    >
      {/* Dot indicator */}
      <span
        className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
          isActive && !isPaused && !isGap
            ? "bg-[var(--interactive-primary)] animate-pulse"
            : isActive && isGap
              ? "bg-[var(--interactive-primary)] opacity-50"
              : isActive && isPaused
                ? "bg-[var(--status-warning-text)]"
                : isCompleted
                  ? "bg-[var(--text-secondary)]"
                  : "bg-[var(--border-default)]"
        }`}
        aria-hidden="true"
      />

      {/* Section label */}
      <span className="text-sm">{SECTION_LABELS[section]}</span>

      {/* Status indicator */}
      {isActive && !isPaused && !isGap && (
        <span className="text-xs text-[var(--text-muted)]">[playing]</span>
      )}
      {isPaused && (
        <span className="text-xs text-[var(--status-warning-text)]">
          [paused]
        </span>
      )}
      {isGap && (
        <span className="text-xs text-[var(--text-muted)] animate-pulse">
          ...
        </span>
      )}
      {isCompleted && !isActive && (
        <span className="text-xs text-[var(--text-muted)]">✓</span>
      )}
    </div>
  );
}

export function StudyModePlayer({
  verse,
  translations,
  onComplete,
  onSectionChange,
}: StudyModePlayerProps) {
  const { state, start, stop, pause, resume, canStart } = useStudyMode({
    verse,
    translations,
    onComplete,
  });

  // Aria-live announcement for section changes
  const [announcement, setAnnouncement] = useState("");
  const prevSectionRef = useRef<StudySection | null>(null);

  // Notify parent and announce when section changes
  useEffect(() => {
    if (state.currentSection !== prevSectionRef.current) {
      prevSectionRef.current = state.currentSection;

      // Notify parent to expand corresponding UI section
      onSectionChange?.(state.currentSection);

      // Announce for screen readers (setState is intentional for a11y sync)
      if (state.currentSection) {
        setAnnouncement(`Now playing: ${SECTION_LABELS[state.currentSection]}`); // eslint-disable-line react-hooks/set-state-in-effect
      } else if (state.status === "completed") {
        setAnnouncement("Study mode complete");
      }
    }
  }, [state.currentSection, state.status, onSectionChange]);

  const isActive =
    state.status === "playing" ||
    state.status === "paused" ||
    state.status === "gap";
  const isPaused = state.status === "paused";
  const isCompleted = state.status === "completed";

  // Don't render if no sections available
  if (!canStart && !isActive && !isCompleted) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Control buttons */}
      <div className="flex items-center gap-2">
        {!isActive && !isCompleted && (
          <button
            onClick={start}
            disabled={!canStart}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-button)]
              bg-[var(--surface-warm)] text-[var(--text-primary)]
              hover:bg-[var(--interactive-contextual-hover)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
            aria-label="Start study mode"
          >
            <BookOpenIcon className="w-5 h-5" />
            <span className="font-medium">Study Mode</span>
          </button>
        )}

        {isActive && (
          <>
            {/* Pause/Resume button */}
            <button
              onClick={isPaused ? resume : pause}
              className="inline-flex items-center justify-center w-10 h-10 rounded-[var(--radius-button)]
                bg-[var(--surface-warm)] text-[var(--text-primary)]
                hover:bg-[var(--interactive-contextual-hover)]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
                transition-colors"
              aria-label={isPaused ? "Resume study mode" : "Pause study mode"}
            >
              {isPaused ? (
                <PlayIcon className="w-5 h-5" />
              ) : (
                <PauseIcon className="w-5 h-5" />
              )}
            </button>

            {/* Stop button */}
            <button
              onClick={stop}
              className="inline-flex items-center justify-center w-10 h-10 rounded-[var(--radius-button)]
                bg-[var(--surface-warm)] text-[var(--text-primary)]
                hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error-text)]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
                transition-colors"
              aria-label="Stop study mode"
            >
              <StopIcon className="w-5 h-5" />
            </button>

            {/* Active label */}
            <span className="text-sm text-[var(--text-muted)] ml-2">
              Study Mode
            </span>
          </>
        )}

        {isCompleted && (
          <button
            onClick={start}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-button)]
              bg-[var(--surface-warm)] text-[var(--text-primary)]
              hover:bg-[var(--interactive-contextual-hover)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
              transition-colors"
            aria-label="Restart study mode"
          >
            <BookOpenIcon className="w-5 h-5" />
            <span className="font-medium">Study Again</span>
          </button>
        )}
      </div>

      {/* Section progress indicator */}
      {(isActive || isCompleted) && (
        <div
          className="flex flex-col gap-0.5 p-3 rounded-[var(--radius-card)] bg-[var(--surface-card)] border border-[var(--border-warm-subtle)]"
          role="region"
          aria-label="Study mode progress"
        >
          {state.availableSections.map((section, idx) => {
            const isCurrentSection = section === state.currentSection;
            const isCompletedSection =
              state.currentIndex > idx ||
              (isCompleted && state.currentIndex === -1);

            return (
              <SectionDot
                key={section}
                section={section}
                isActive={isCurrentSection}
                isCompleted={isCompletedSection}
                status={state.status}
              />
            );
          })}
        </div>
      )}

      {/* Completion message */}
      {isCompleted && (
        <div
          className="text-sm text-[var(--text-secondary)] text-center py-2"
          role="status"
        >
          Study complete
        </div>
      )}

      {/* Aria-live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
}

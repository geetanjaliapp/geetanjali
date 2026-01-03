/**
 * StudyModePlayer - Compact icon-button UI for Study Mode
 *
 * Designed to sit next to the verse play button:
 * - Idle: Book icon button (matches play button style)
 * - Active: Pulsing icon + popover showing progress
 * - Completed: Green tick, auto-fades back to idle
 *
 * Used by: VerseDetail page (top-right corner)
 */

import { useEffect, useRef, useState } from "react";
import {
  StudyModeIcon,
  PlayIcon,
  CheckIcon,
  CloseIcon,
} from "../icons";
import {
  useStudyMode,
  SECTION_LABELS,
  type StudySection,
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

  // Show completion tick briefly then fade
  const [showCompleteTick, setShowCompleteTick] = useState(false);

  // Notify parent and announce when section changes
  useEffect(() => {
    if (state.currentSection !== prevSectionRef.current) {
      prevSectionRef.current = state.currentSection;
      onSectionChange?.(state.currentSection);

      if (state.currentSection) {
        setAnnouncement(`Now playing: ${SECTION_LABELS[state.currentSection]}`); // eslint-disable-line react-hooks/set-state-in-effect
      } else if (state.status === "completed") {
        setAnnouncement("Study mode complete");
      }
    }
  }, [state.currentSection, state.status, onSectionChange]);

  // Handle completion: show tick briefly then fade
  useEffect(() => {
    if (state.status === "completed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: trigger completion animation on status change
      setShowCompleteTick(true);
      const timer = setTimeout(() => {
        setShowCompleteTick(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.status]);

  const isActive =
    state.status === "playing" ||
    state.status === "paused" ||
    state.status === "gap";
  const isPaused = state.status === "paused";

  // Don't render if no sections available
  if (!canStart && !isActive && state.status !== "completed") {
    return null;
  }

  // Idle or completion-faded state: show study button
  if (!isActive && !showCompleteTick) {
    return (
      <>
        <button
          onClick={start}
          disabled={!canStart}
          className="p-3 sm:p-2 rounded-full transition-all
            text-[var(--text-muted)] hover:text-[var(--interactive-primary)] hover:bg-[var(--surface-muted)]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]
            disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Start study mode - plays Sanskrit, English, Hindi, and Insight"
          title="Study Mode"
        >
          <StudyModeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        {/* Aria-live region */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
      </>
    );
  }

  // Completion tick state
  if (showCompleteTick) {
    return (
      <div className="p-3 sm:p-2 text-[var(--status-success-text)] animate-fade-in">
        <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
    );
  }

  // Active state: show controls with popover
  return (
    <div className="relative">
      {/* Main control button (pause/resume) */}
      <button
        onClick={isPaused ? resume : pause}
        className={`p-3 sm:p-2 rounded-full transition-all
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]
          ${isPaused
            ? "text-[var(--status-warning-text)] bg-[var(--status-warning-text)]/10"
            : "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10 animate-pulse"
          }`}
        aria-label={isPaused ? "Resume study mode" : "Pause study mode"}
      >
        {isPaused ? (
          <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <StudyModeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
      </button>

      {/* Progress popover - appears below */}
      <div className="absolute top-full right-0 mt-1 z-20 animate-fade-in">
        <div className="bg-[var(--surface-elevated)] rounded-[var(--radius-button)] shadow-[var(--shadow-dropdown)] border border-[var(--border-subtle)] px-2.5 py-1.5 flex items-center gap-2 whitespace-nowrap">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {state.availableSections.map((section, idx) => {
              const isCurrentSection = section === state.currentSection;
              const isCompletedSection = state.currentIndex > idx;
              const isGap = state.status === "gap" && isCurrentSection;

              return (
                <span
                  key={section}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                    isCurrentSection && !isPaused && !isGap
                      ? "bg-[var(--interactive-primary)] scale-125"
                      : isCurrentSection && isGap
                        ? "bg-[var(--interactive-primary)] opacity-50"
                        : isCurrentSection && isPaused
                          ? "bg-[var(--status-warning-text)]"
                          : isCompletedSection
                            ? "bg-[var(--text-tertiary)]"
                            : "bg-[var(--border-default)]"
                  }`}
                  aria-hidden="true"
                />
              );
            })}
          </div>

          {/* Current section label */}
          <span className="text-xs text-[var(--text-secondary)]">
            {state.currentSection ? SECTION_LABELS[state.currentSection] : "..."}
          </span>

          {/* Stop button */}
          <button
            onClick={stop}
            className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)] transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="Stop study mode"
          >
            <CloseIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Aria-live region */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

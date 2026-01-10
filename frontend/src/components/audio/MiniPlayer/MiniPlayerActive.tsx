/**
 * MiniPlayerActive - Unified active player for all modes
 *
 * Consolidates Listen, Read, Study, and Single-play into one component.
 * Study mode uses expanded SectionTrack layout (Proposal C).
 *
 * Study Mode Layout:
 * ┌────────────────────────────────────────────────────────────────┐
 * │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
 * │  Sanskrit ● ── English ○ ── Hindi ○ ── Insight ○              │
 * ├────────────────────────────────────────────────────────────────┤
 * │  [▶] [■]           Verse 12 of 72                       [>>]  │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Other Modes Layout (Listen/Read/Single):
 * ┌────────────────────────────────────────────────────────────────┐
 * │  [Status]  │  [Progress]  [Time]  │  [Position]               │
 * ├────────────────────────────────────────────────────────────────┤
 * │  [▶][■]        [Speed]                    🔄 Mode             │
 * └────────────────────────────────────────────────────────────────┘
 */

import { PlayIcon, PauseIcon, SpinnerIcon, StopIcon, CloseIcon } from "../../icons";
import { AudioSpeedControl } from "../AudioSpeedControl";
import { formatTime } from "../audioUtils";
import type { PlaybackSpeed } from "../AudioPlayerContext";

// ============================================================================
// Local Icons (not in shared icons.tsx)
// ============================================================================

/** Double chevron skip icon */
function SkipIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

export type PlayerMode = "listen" | "read" | "study" | "single";

export interface StudySectionInfo {
  id: string;
  label: string;
  status: "completed" | "current" | "upcoming" | "skipped";
}

export interface MiniPlayerActiveProps {
  /** Current playback mode */
  mode: PlayerMode;
  /** What's currently playing - shown on left */
  statusText: string;
  /** Whether status should be highlighted (e.g., during intro phases) */
  statusHighlight?: boolean;
  /** Progress value (0-100) */
  progress: number;
  /** Time display (for listen/read/single modes) */
  currentTime?: number;
  /** Total duration (for listen/read/single modes) */
  totalDuration?: number;
  /** Section indicators (for study mode) */
  sections?: StudySectionInfo[];
  /** Verse position (for auto-advance modes) */
  versePosition?: { current: number; total: number };
  /** Whether paused */
  isPaused: boolean;
  /** Whether loading */
  isLoading: boolean;
  /** Play/Pause callback */
  onPlayPause: () => void;
  /** Stop callback */
  onStop: () => void;
  /** Skip callback (study mode: skip section/verse, single: not used) */
  onSkip?: () => void;
  /** Label for skip button (for accessibility) */
  skipLabel?: string;
  /** Speed change callback (listen/single modes) */
  onSpeedChange?: (speed: PlaybackSpeed) => void;
  /** Current speed (listen/single modes) */
  playbackSpeed?: PlaybackSpeed;
  /** Close callback (single-play mode only) */
  onClose?: () => void;
}

// ============================================================================
// Mode Configuration
// ============================================================================

const MODE_CONFIG: Record<PlayerMode, { icon: "speaker" | "book" | "graduation" | "play"; label: string }> = {
  listen: { icon: "speaker", label: "Listen" },
  read: { icon: "book", label: "Read" },
  study: { icon: "graduation", label: "Study" },
  single: { icon: "play", label: "Playing" },
};

// ============================================================================
// Sub-components
// ============================================================================

/** Mode icon component */
function ModeIcon({ type }: { type: "speaker" | "book" | "graduation" | "play" }) {
  const className = "w-4 h-4";

  switch (type) {
    case "speaker":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
      );
    case "book":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "graduation":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      );
    case "play":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      );
  }
}

/** Control button styles */
const CONTROL_BUTTON_PRIMARY = "min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-[var(--text-accent)] text-[var(--surface-primary)] hover:opacity-90 transition-opacity duration-150 flex items-center justify-center disabled:opacity-50";
const CONTROL_BUTTON_SECONDARY = "min-w-[44px] min-h-[44px] w-11 h-11 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] transition-colors duration-150 flex items-center justify-center";

/** Play/Pause control button */
function PlayPauseButton({
  isPaused,
  isLoading,
  onClick,
}: {
  isPaused: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={CONTROL_BUTTON_PRIMARY}
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
  );
}

/** Section track for study mode - horizontal pipeline with labels */
function SectionTrack({
  sections,
  progress,
}: {
  sections: StudySectionInfo[];
  progress: number;
}) {
  const currentIndex = sections.findIndex(s => s.status === "current");

  // Calculate overall progress once (memoized within render)
  const completedSections = sections.filter(s => s.status === "completed").length;
  const sectionWidth = sections.length > 0 ? 100 / sections.length : 0;
  const overallProgress = currentIndex === -1
    ? 0
    : (completedSections * sectionWidth) + (progress / 100) * sectionWidth;

  const getStatusStyles = (status: StudySectionInfo["status"]) => {
    switch (status) {
      case "completed":
        return "bg-[var(--text-accent)]";
      case "current":
        return "bg-[var(--text-accent)] ring-2 ring-[var(--text-accent)]/30 scale-110";
      case "upcoming":
        return "border-2 border-[var(--border-subtle)] bg-transparent";
      case "skipped":
        return "bg-[var(--border-subtle)] opacity-40";
    }
  };

  return (
    <div className="space-y-2" role="group" aria-label="Section progress">
      {/* Progress bar - full width */}
      <div
        className="h-1 bg-[var(--surface-secondary)] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(overallProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall progress"
      >
        <div
          className="h-full bg-[var(--text-accent)] transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
        />
      </div>

      {/* Section indicators with labels */}
      <div className="flex items-center justify-center gap-2 text-xs">
        {sections.map((section, idx) => (
          <div key={section.id} className="flex items-center gap-1.5">
            {/* Connector line between sections */}
            {idx > 0 && (
              <span
                className={`w-4 h-px transition-colors duration-200 ${
                  sections[idx - 1].status === "completed"
                    ? "bg-[var(--text-accent)]"
                    : "bg-[var(--border-subtle)]"
                }`}
                aria-hidden="true"
              />
            )}
            {/* Section dot */}
            <div
              className={`w-2 h-2 rounded-full transition-all duration-200 ${getStatusStyles(section.status)}`}
              aria-hidden="true"
            />
            {/* Section label */}
            <span
              className={`transition-colors duration-200 ${
                section.status === "current"
                  ? "font-semibold text-[var(--text-primary)]"
                  : section.status === "completed"
                  ? "text-[var(--text-secondary)]"
                  : "text-[var(--text-tertiary)]"
              }`}
              aria-label={`${section.label}: ${section.status}`}
            >
              {section.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MiniPlayerActive({
  mode,
  statusText,
  statusHighlight = false,
  progress,
  currentTime,
  totalDuration,
  sections,
  versePosition,
  isPaused,
  isLoading,
  onPlayPause,
  onStop,
  onSkip,
  skipLabel = "Skip to next",
  onSpeedChange,
  playbackSpeed,
  onClose,
}: MiniPlayerActiveProps) {
  const config = MODE_CONFIG[mode];
  const isStudyMode = mode === "study";
  const showTime = !isStudyMode && currentTime !== undefined && totalDuration !== undefined;
  const showSections = isStudyMode && sections && sections.length > 0;
  const showSpeed = (mode === "listen" || mode === "single") && onSpeedChange && playbackSpeed;
  const showSkip = isStudyMode && onSkip;
  const showClose = mode === "single" && onClose;
  const showVersePosition = mode !== "single" && versePosition;

  // Study mode uses distinct 3-row layout
  if (isStudyMode && showSections) {
    return (
      <div
        className="bg-[var(--surface-primary)]/95 backdrop-blur-sm border-t border-[var(--border-subtle)] px-4 py-3"
        role="region"
        aria-label="Study mode player"
      >
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Row 1 & 2: Section Track (progress bar + labeled sections) */}
          <SectionTrack sections={sections} progress={progress} />

          {/* Row 3: Controls | Verse position | Skip */}
          <div className="flex items-center justify-between">
            {/* Left: Control buttons */}
            <div className="flex items-center gap-1">
              <PlayPauseButton isPaused={isPaused} isLoading={isLoading} onClick={onPlayPause} />
              <button onClick={onStop} className={CONTROL_BUTTON_SECONDARY} aria-label="Stop">
                <StopIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Center: Verse position (prominent) */}
            {versePosition && (
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Verse {versePosition.current} of {versePosition.total}
              </span>
            )}

            {/* Right: Skip button */}
            {showSkip && (
              <button onClick={onSkip} className={CONTROL_BUTTON_SECONDARY} aria-label={skipLabel}>
                <SkipIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard layout for Listen, Read, Single modes
  return (
    <div
      className="bg-[var(--surface-primary)]/95 backdrop-blur-sm border-t border-[var(--border-subtle)] px-4 py-2"
      role="region"
      aria-label={`${config.label} mode player`}
    >
      <div className="max-w-4xl mx-auto">
        {/* Top row: Status | Progress | Position */}
        <div className="flex items-center gap-3 mb-1.5 min-h-[20px]">
          {/* Status text - what's currently happening */}
          <span
            className={`text-xs w-20 text-right truncate transition-colors duration-200 ${
              statusHighlight
                ? "text-[var(--text-accent)] font-medium"
                : "text-[var(--text-tertiary)]"
            }`}
          >
            {statusText}
          </span>

          {/* Progress area */}
          <div className="flex-1 flex items-center gap-2">
            {/* Time (if applicable) */}
            {showTime && (
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono w-8 text-right">
                {formatTime(currentTime)}
              </span>
            )}

            {/* Progress bar */}
            <div
              className="flex-1 h-1 bg-[var(--surface-secondary)] rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Playback progress"
            >
              <div
                className="h-full bg-[var(--text-accent)] transition-all duration-150 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>

            {/* End time */}
            {showTime && (
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono w-8">
                {formatTime(totalDuration)}
              </span>
            )}
          </div>

          {/* Verse position */}
          {showVersePosition && (
            <span className="text-xs text-[var(--text-tertiary)] font-mono w-10 text-right">
              {versePosition.current}/{versePosition.total}
            </span>
          )}
        </div>

        {/* Bottom row: Controls | Center | Mode indicator */}
        <div className="flex items-center justify-between">
          {/* Left: Control buttons - min 44px touch targets */}
          <div className="flex items-center gap-1">
            <PlayPauseButton isPaused={isPaused} isLoading={isLoading} onClick={onPlayPause} />
            <button onClick={onStop} className={CONTROL_BUTTON_SECONDARY} aria-label="Stop">
              <StopIcon className="w-5 h-5" />
            </button>
            {showClose && (
              <button onClick={onClose} className={CONTROL_BUTTON_SECONDARY} aria-label="Close">
                <CloseIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Center: Speed control (when applicable) */}
          {showSpeed && (
            <AudioSpeedControl
              speed={playbackSpeed}
              onSpeedChange={onSpeedChange}
              compact
            />
          )}

          {/* Right: Mode indicator */}
          <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
            {/* Loop indicator for auto-advance modes */}
            {mode !== "single" && (
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <ModeIcon type={config.icon} />
            <span className="text-xs font-medium">{config.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

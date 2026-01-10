/**
 * MiniPlayer Component (v1.25.0)
 *
 * Compact audio player for Reading Mode.
 * Unified design with consistent height and quiet library aesthetics.
 *
 * Modes:
 * - Idle: Mode selector (Listen/Study/Read buttons)
 * - Listen: Audio auto-advance through chapter
 * - Read: Timed silent reading auto-advance
 * - Study: Guided narration (Sanskrit → English → Hindi → Insight)
 * - Single: One-off verse playback from header
 *
 * Uses MiniPlayerActive for all active states (consistent layout).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "../AudioPlayerContext";
import { useAudioCached } from "../../../hooks";
import type { AutoAdvanceMode } from "../../../hooks/useAutoAdvance";
import { SECTION_LABELS, type StudySection } from "../../../hooks/useStudyMode";
import type { StudyAutoModeStatus, StudyAutoModePhase } from "../../../hooks/useStudyAutoMode";

// Components
import { MiniPlayerActive, type StudySectionInfo } from "./MiniPlayerActive";
import { MiniPlayerModeSelector } from "./MiniPlayerModeSelector";
import { MiniPlayerStandard } from "./MiniPlayerStandard";

// Re-exports
export { MiniPlayerPlayButton } from "./MiniPlayerPlayButton";
export { MiniPlayerActive } from "./MiniPlayerActive";
export { MiniPlayerModeSelector } from "./MiniPlayerModeSelector";
export { MiniPlayerStandard } from "./MiniPlayerStandard";
// Legacy exports (deprecated - use MiniPlayerActive)
export { MiniPlayerSinglePlay } from "./MiniPlayerSinglePlay";
export { MiniPlayerAutoAdvance } from "./MiniPlayerAutoAdvance";
export { MiniPlayerStudyMode } from "./MiniPlayerStudyMode";

// ============================================================================
// Constants
// ============================================================================

/** Section playback order for study mode */
const STUDY_SECTION_ORDER: StudySection[] = ["sanskrit", "english", "hindi", "insight"];

// ============================================================================
// Hooks
// ============================================================================

/** Live region announcement for screen readers */
function useLiveAnnouncement() {
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message: string) => {
    setAnnouncement("");
    setTimeout(() => setAnnouncement(message), 50);
  }, []);

  return { announcement, announce };
}

// ============================================================================
// Types
// ============================================================================

interface MiniPlayerProps {
  verseId: string;
  audioUrl: string;
  autoPlay?: boolean;
  onEnded?: () => void;
}

interface AutoAdvanceMiniPlayerProps extends MiniPlayerProps {
  autoAdvanceMode: AutoAdvanceMode;
  isAutoAdvancePaused: boolean;
  textModeProgress: number;
  durationMs: number | null | undefined;
  versePosition: { current: number; total: number };
  onStartAudioMode: () => void;
  onStartTextMode: () => void;
  onPauseAutoAdvance: () => void;
  onResumeAutoAdvance: () => void;
  onStopAutoAdvance: () => void;
  singlePlayMode?: boolean;
  onExitSinglePlay?: () => void;
  continuousPlayback?: boolean;
  onToggleContinuousPlayback?: () => void;
  // Study mode
  studyModeStatus?: StudyAutoModeStatus;
  studyModePhase?: StudyAutoModePhase;
  studyModeSection?: StudySection | null;
  studyModeAvailableSections?: StudySection[];
  isStudyModeLoading?: boolean;
  onStartStudyMode?: () => void;
  onPauseStudyMode?: () => void;
  onResumeStudyMode?: () => void;
  onStopStudyMode?: () => void;
  onSkipStudySection?: () => void;
  onSkipStudyVerse?: () => void;
}

function isAutoAdvanceProps(
  props: MiniPlayerProps | AutoAdvanceMiniPlayerProps
): props is AutoAdvanceMiniPlayerProps {
  return "autoAdvanceMode" in props;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Get status text for study mode based on phase */
function getStudyStatusText(
  phase: StudyAutoModePhase,
  section: StudySection | null,
  verseNum: number,
  isLoading: boolean,
  isPaused: boolean
): string {
  if (isLoading) return "Loading...";
  if (isPaused) return "Paused";

  switch (phase) {
    case "chapter_intro": return "Chapter";
    case "verse_intro": return `Verse ${verseNum}`;
    case "chapter_complete": return "Complete";
    case "advancing": return "Next...";
    case "verse_content": return section ? SECTION_LABELS[section] : "Starting";
    default: return "Starting";
  }
}

/** Build section info for study mode dots */
function buildSectionInfo(
  currentSection: StudySection | null,
  availableSections: StudySection[]
): StudySectionInfo[] {
  const currentIndex = currentSection ? STUDY_SECTION_ORDER.indexOf(currentSection) : -1;

  return STUDY_SECTION_ORDER.map((section) => {
    const sectionIndex = STUDY_SECTION_ORDER.indexOf(section);
    const isAvailable = availableSections.includes(section);

    let status: StudySectionInfo["status"];
    if (!isAvailable) status = "skipped";
    else if (sectionIndex < currentIndex) status = "completed";
    else if (section === currentSection) status = "current";
    else status = "upcoming";

    return { id: section, label: SECTION_LABELS[section], status };
  });
}

/** Calculate progress for study mode */
function calculateStudyProgress(
  currentSection: StudySection | null,
  availableSections: StudySection[],
  phase: StudyAutoModePhase
): number {
  if (phase === "chapter_complete") return 100;
  if (!currentSection) return 0;

  const currentIndex = STUDY_SECTION_ORDER.indexOf(currentSection);
  const total = availableSections.length || STUDY_SECTION_ORDER.length;
  return total > 0 ? (currentIndex / total) * 100 : 0;
}

// ============================================================================
// Main Component
// ============================================================================

export function MiniPlayer(props: MiniPlayerProps | AutoAdvanceMiniPlayerProps) {
  const { verseId, audioUrl, autoPlay = false, onEnded } = props;

  const {
    currentlyPlaying,
    state,
    progress,
    currentTime,
    duration,
    error,
    playbackSpeed,
    isLooping,
    play,
    pause,
    resume,
    seek,
    setPlaybackSpeed,
    toggleLoop,
    retry,
  } = useAudioPlayer();

  const isThisPlaying = currentlyPlaying === verseId;
  const isActive = isThisPlaying && ["playing", "paused", "loading", "completed"].includes(state);
  const isIdle = !isThisPlaying || state === "idle";
  const prevVerseIdRef = useRef(verseId);
  const hasCalledOnEndedRef = useRef(false);

  const { isCached: isAudioCached } = useAudioCached(audioUrl);
  const { announcement, announce } = useLiveAnnouncement();

  // Mode detection
  const hasAutoAdvance = isAutoAdvanceProps(props);
  const autoAdvanceMode = hasAutoAdvance ? props.autoAdvanceMode : "off";
  const isAutoAdvanceActive = autoAdvanceMode !== "off";
  const isAutoAdvancePaused = hasAutoAdvance ? props.isAutoAdvancePaused : false;
  const singlePlayMode = hasAutoAdvance ? props.singlePlayMode || false : false;

  // Study mode
  const studyModeStatus = hasAutoAdvance ? props.studyModeStatus : undefined;
  const isStudyModeActive = studyModeStatus && studyModeStatus !== "idle";
  const isStudyModePaused = studyModeStatus === "paused";

  // Screen reader announcements
  const prevModeRef = useRef(autoAdvanceMode);
  useEffect(() => {
    if (prevModeRef.current !== autoAdvanceMode && hasAutoAdvance) {
      if (autoAdvanceMode === "audio") {
        announce(`Listen mode, verse ${props.versePosition.current} of ${props.versePosition.total}`);
      } else if (autoAdvanceMode === "text") {
        announce(`Read mode, verse ${props.versePosition.current} of ${props.versePosition.total}`);
      } else if (autoAdvanceMode === "off" && prevModeRef.current !== "off") {
        announce("Stopped");
      }
      prevModeRef.current = autoAdvanceMode;
    }
  }, [autoAdvanceMode, hasAutoAdvance, announce, props]);

  // Play/pause handler
  const handlePlayPause = useCallback(() => {
    if (isThisPlaying) {
      if (state === "playing") pause();
      else if (state === "paused") resume();
      else if (state === "error") retry();
    } else {
      play(verseId, audioUrl);
    }
  }, [isThisPlaying, state, pause, resume, retry, play, verseId, audioUrl]);

  // Auto-play on verse change
  useEffect(() => {
    if (!isAutoAdvanceActive && autoPlay && verseId !== prevVerseIdRef.current) {
      prevVerseIdRef.current = verseId;
      const timer = setTimeout(() => play(verseId, audioUrl), 300);
      return () => clearTimeout(timer);
    }
    prevVerseIdRef.current = verseId;
  }, [verseId, audioUrl, autoPlay, play, isAutoAdvanceActive]);

  // Notify on audio end
  useEffect(() => {
    if (isThisPlaying && state === "completed" && !hasCalledOnEndedRef.current) {
      hasCalledOnEndedRef.current = true;
      onEnded?.();
    } else if (state === "playing") {
      hasCalledOnEndedRef.current = false;
    }
  }, [isThisPlaying, state, onEnded]);

  // Text mode display values
  const getTextModeDisplay = () => {
    if (!hasAutoAdvance || !props.durationMs) return { time: 0, total: 0 };
    const textModeDuration = props.durationMs * 0.8;
    const time = Math.floor((props.textModeProgress / 100) * textModeDuration);
    return { time, total: textModeDuration };
  };

  // -------------------------------------------------------------------------
  // Render: Single-play mode
  // -------------------------------------------------------------------------
  if (hasAutoAdvance && singlePlayMode && isThisPlaying) {
    return (
      <>
        <MiniPlayerActive
          mode="single"
          statusText={state === "loading" ? "Loading..." : state === "paused" ? "Paused" : "Playing"}
          statusHighlight={state === "loading"}
          progress={progress * 100}
          currentTime={currentTime}
          totalDuration={duration}
          isPaused={state === "paused"}
          isLoading={state === "loading"}
          onPlayPause={handlePlayPause}
          onStop={() => props.onExitSinglePlay?.()}
          onClose={props.onExitSinglePlay}
          onSpeedChange={setPlaybackSpeed}
          playbackSpeed={playbackSpeed}
        />
        <LiveRegion announcement={announcement} />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Study mode
  // -------------------------------------------------------------------------
  if (hasAutoAdvance && isStudyModeActive) {
    const phase = props.studyModePhase ?? "idle";
    const section = props.studyModeSection ?? null;
    const available = props.studyModeAvailableSections ?? [];
    const isIntroPhase = ["chapter_intro", "verse_intro", "chapter_complete"].includes(phase);

    return (
      <>
        <MiniPlayerActive
          mode="study"
          statusText={getStudyStatusText(
            phase,
            section,
            props.versePosition.current,
            props.isStudyModeLoading ?? false,
            isStudyModePaused
          )}
          statusHighlight={isIntroPhase || props.isStudyModeLoading}
          progress={calculateStudyProgress(section, available, phase)}
          sections={buildSectionInfo(section, available)}
          versePosition={props.versePosition}
          isPaused={isStudyModePaused}
          isLoading={props.isStudyModeLoading ?? false}
          onPlayPause={isStudyModePaused ? (props.onResumeStudyMode ?? (() => {})) : (props.onPauseStudyMode ?? (() => {}))}
          onStop={props.onStopStudyMode ?? (() => {})}
          onSkip={isIntroPhase ? props.onSkipStudySection : props.onSkipStudyVerse}
          skipLabel={isIntroPhase ? "Skip introduction" : "Skip to next verse"}
        />
        <LiveRegion announcement={announcement} />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Listen/Read mode
  // -------------------------------------------------------------------------
  if (hasAutoAdvance && isAutoAdvanceActive) {
    const textDisplay = getTextModeDisplay();
    const isAudio = autoAdvanceMode === "audio";
    const displayProgress = isAudio ? progress * 100 : props.textModeProgress;
    const displayTime = isAudio ? currentTime : textDisplay.time / 1000;
    const displayDuration = isAudio ? duration : textDisplay.total / 1000;
    const isAudioLoading = isAudio && state === "loading";

    return (
      <>
        <MiniPlayerActive
          mode={isAudio ? "listen" : "read"}
          statusText={
            isAudioLoading ? "Loading..." :
            isAutoAdvancePaused ? "Paused" :
            isAudio ? "Playing" : "Reading"
          }
          statusHighlight={isAudioLoading}
          progress={displayProgress}
          currentTime={displayTime}
          totalDuration={displayDuration}
          versePosition={props.versePosition}
          isPaused={isAutoAdvancePaused}
          isLoading={isAudioLoading}
          onPlayPause={isAutoAdvancePaused ? props.onResumeAutoAdvance : props.onPauseAutoAdvance}
          onStop={props.onStopAutoAdvance}
          onSpeedChange={isAudio ? setPlaybackSpeed : undefined}
          playbackSpeed={isAudio ? playbackSpeed : undefined}
        />
        <LiveRegion announcement={announcement} />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Mode selector (idle state)
  // -------------------------------------------------------------------------
  if (hasAutoAdvance && !isAutoAdvanceActive && !isStudyModeActive && !singlePlayMode) {
    return (
      <MiniPlayerModeSelector
        versePosition={props.versePosition}
        onStartAudioMode={props.onStartAudioMode}
        onStartTextMode={props.onStartTextMode}
        onStartStudyMode={props.onStartStudyMode}
        isStudyModeLoading={props.isStudyModeLoading}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Render: Standard single-verse UI (legacy/fallback)
  // -------------------------------------------------------------------------
  return (
    <>
      <MiniPlayerStandard
        state={state}
        isThisPlaying={isThisPlaying}
        isIdle={isIdle}
        isActive={isActive}
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        error={error}
        playbackSpeed={playbackSpeed}
        isLooping={isLooping}
        isAudioCached={isAudioCached}
        onPlayPause={handlePlayPause}
        onSeek={seek}
        onSpeedChange={setPlaybackSpeed}
        onToggleLoop={toggleLoop}
        continuousPlayback={hasAutoAdvance ? props.continuousPlayback : undefined}
        onToggleContinuousPlayback={hasAutoAdvance ? props.onToggleContinuousPlayback : undefined}
        showContinuousPlayback={
          hasAutoAdvance && props.autoAdvanceMode === "audio" && !!props.onToggleContinuousPlayback
        }
      />
      <LiveRegion announcement={announcement} />
    </>
  );
}

/** Screen reader live region */
function LiveRegion({ announcement }: { announcement: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}

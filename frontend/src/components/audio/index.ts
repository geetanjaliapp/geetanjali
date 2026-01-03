/**
 * Audio Components (v1.17.0)
 *
 * Exports for verse audio playback functionality.
 */

export { AudioPlayer } from "./AudioPlayer";
export {
  AudioPlayerProvider,
  useAudioPlayer,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type AudioState,
} from "./AudioPlayerContext";
export { AudioProgress } from "./AudioProgress";
export { AudioSpeedControl } from "./AudioSpeedControl";
export {
  MiniPlayer,
  MiniPlayerPlayButton,
  MiniPlayerSinglePlay,
  MiniPlayerAutoAdvance,
  MiniPlayerModeSelector,
  MiniPlayerStandard,
} from "./MiniPlayer";
export { FloatingAudioBar } from "./FloatingAudioBar";
export { StudyModePlayer } from "./StudyModePlayer";
export {
  formatTime,
  formatVerseId,
  ADVANCE_DELAY_MS,
  COMPLETED_DISPLAY_MS,
  PRELOAD_THRESHOLD,
} from "./audioUtils";

/**
 * Custom hooks barrel exports
 *
 * Usage:
 *   import { useApiRequest, useCaseData } from '@/hooks';
 *
 * Instead of:
 *   import { useApiRequest } from './hooks/useApiRequest';
 *   import { useCaseData } from './hooks/useCaseData';
 */

export { useApiRequest } from "./useApiRequest";
export { useCaseData } from "./useCaseData";
export { useSEO } from "./useSEO";
export { useShare, shareUrls } from "./useShare";
export {
  usePreferences,
  useFavoritesPrefs,
  useGoalsPrefs,
  useReadingPrefs,
  useSyncStatus,
} from "./usePreferences";
// SyncStatus type is now available from syncEngine
export type { SyncStatus } from "../lib/syncEngine";
export { useAdjacentVerses } from "./useAdjacentVerses";
export { useSwipeNavigation } from "./useSwipeNavigation";
export { useSearch } from "./useSearch";
export { useTaxonomy, preloadTaxonomy } from "./useTaxonomy";
// useLearningGoal removed - use useGoalsPrefs() from usePreferences instead
export { useFocusTrap } from "./useFocusTrap";
export { useOnlineStatus } from "./useOnlineStatus";
export { useFeedback } from "./useFeedback";
export { useNewsletterSync } from "./useNewsletterSync";
export { useResendVerification } from "./useResendVerification";
export { useAutoAdvance } from "./useAutoAdvance";
export type {
  AutoAdvanceMode,
  UseAutoAdvanceConfig,
  UseAutoAdvanceReturn,
} from "./useAutoAdvance";
export { useStudyMode, SECTION_LABELS } from "./useStudyMode";
export type {
  StudySection,
  StudyModeStatus,
  StudyModeState,
  StudyModeConfig,
  StudyModeControls,
} from "./useStudyMode";
export {
  useCrossChapterPreload,
  PRELOAD_THRESHOLD_VERSES,
} from "./useCrossChapterPreload";
export type { CrossChapterPreloadConfig } from "./useCrossChapterPreload";
export {
  useAudioCached,
  useAudioCacheStatus,
  formatBytes,
} from "./useAudioCache";
export type { AudioCacheStatus } from "./useAudioCache";
export { useFadeOut, useAutoFadeOut } from "./useFadeOut";
// Re-export audio types for convenience
export type { AudioState, PlaybackSpeed } from "../components/audio";

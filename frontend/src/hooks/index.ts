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
export { useFavorites } from "./useFavorites";
export { useAdjacentVerses } from "./useAdjacentVerses";
export { useSwipeNavigation } from "./useSwipeNavigation";
export { useSearch } from "./useSearch";
export { useTaxonomy, preloadTaxonomy } from "./useTaxonomy";
export { useLearningGoal } from "./useLearningGoal";
export { useFocusTrap } from "./useFocusTrap";
export { useOnlineStatus } from "./useOnlineStatus";

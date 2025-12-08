/**
 * Component barrel exports for cleaner imports
 *
 * Usage:
 *   import { Navbar, VerseCard, FeaturedVerse } from '@/components';
 *
 * Instead of:
 *   import { Navbar } from './components/Navbar';
 *   import { VerseCard } from './components/VerseCard';
 *   import { FeaturedVerse } from './components/FeaturedVerse';
 */

// Root-level components
export { Navbar } from './Navbar';
export { PageLayout } from './PageLayout';
export { ErrorBoundary } from './ErrorBoundary';
export { VerseCard } from './VerseCard';
export { FeaturedVerse } from './FeaturedVerse';
export { ConfirmModal } from './ConfirmModal';
export { ConsultationWaiting } from './ConsultationWaiting';
export { FloatingActionButton } from './FloatingActionButton';
export { ContentNotFound } from './ContentNotFound';

// Case-related components
export {
  CaseHeader,
  PathsSection,
  StepsSection,
  ReflectionsSection,
  OutputFeedback,
  FollowUpInput,
  CaseTimeline,
  CaseExchange,
} from './case';

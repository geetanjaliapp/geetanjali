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
export { Navbar } from "./Navbar";
export { Footer } from "./Footer";
export { PageLayout } from "./PageLayout";
export { ErrorBoundary } from "./ErrorBoundary";
export { VerseCard } from "./VerseCard";
export { FeaturedVerse } from "./FeaturedVerse";
export { ConfirmModal } from "./ConfirmModal";
export { ConsultationWaiting } from "./ConsultationWaiting";
export { FloatingActionButton } from "./FloatingActionButton";
export { ContentNotFound } from "./ContentNotFound";
export { SkipLink } from "./SkipLink";
export { ChapterContextBar } from "./ChapterContextBar";
export { ProgressBar } from "./ProgressBar";
export { StickyBottomNav } from "./StickyBottomNav";
export { FloatingNavArrow } from "./FloatingNavArrow";
export { VerseFocus } from "./VerseFocus";
export { ChapterSelector } from "./ChapterSelector";

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
} from "./case";

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
export { Navbar } from "./navigation/Navbar";
export { Footer } from "./Footer";
export { PageLayout } from "./PageLayout";
export { ErrorBoundary } from "./ErrorBoundary";
export { VerseCard } from "./VerseCard";
export type { VerseMatch } from "./VerseCard";
export { SearchInput, saveRecentSearch } from "./SearchInput";
export type { SearchInputProps, SearchInputHandle } from "./SearchInput";
export { FeaturedVerse } from "./FeaturedVerse";
export { ConfirmModal } from "./ConfirmModal";
export { FloatingActionButton } from "./FloatingActionButton";
export { ContentNotFound } from "./ContentNotFound";
export { SkipLink } from "./SkipLink";
export { ChapterContextBar } from "./ChapterContextBar";
export { ProgressBar } from "./ProgressBar";
export { StickyBottomNav } from "./StickyBottomNav";
export { FloatingNavArrow } from "./FloatingNavArrow";
export { VerseFocus } from "./VerseFocus";
export { ChapterSelector } from "./ChapterSelector";
export { IntroCard } from "./IntroCard";
export { VersePopover } from "./VersePopover";
export { GuidanceMarkdown } from "./GuidanceMarkdown";
export { FeaturedConsultations } from "./FeaturedConsultations";

// Case-related components
export {
  CaseHeader,
  PathsSection,
  StepsSection,
  ReflectionsSection,
  OutputFeedback,
  FollowUpInput,
  ThinkingIndicator,
} from "./case";

// Newsletter/Settings components
export { GoalSelector } from "./GoalSelector";
export { TimeSelector } from "./TimeSelector";
export type { SendTime } from "./TimeSelector";
export { NewsletterCard } from "./NewsletterCard";
export {
  markNewsletterSubscribed,
  clearNewsletterSubscribed,
} from "../lib/newsletterStorage";

// Notifications
export { Toast } from "./Toast";
export { OfflineIndicator } from "./OfflineIndicator";
export { VerifyEmailBanner } from "./VerifyEmailBanner";

// UI Foundation Components (v1.16.0)
export {
  Button,
  buttonVariants,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
  cardVariants,
  Input,
  inputVariants,
  Badge,
  badgeVariants,
  Skeleton,
  skeletonVariants,
  IconButton,
  iconButtonVariants,
  Link,
  linkVariants,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
  ModalFooter,
  modalContentVariants,
} from "./ui";
export type {
  ButtonProps,
  CardProps,
  InputProps,
  BadgeProps,
  SkeletonProps,
  IconButtonProps,
  LinkProps,
  ModalProps,
} from "./ui";

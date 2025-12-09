import { Link, useLocation } from 'react-router-dom';
import { trackEvent, EXPERIMENTS } from '../lib/experiment';

interface FloatingActionButtonProps {
  /** Override the default destination */
  to?: string;
  /** Override the default label */
  label?: string;
}

/**
 * Track FAB click for analytics
 */
function handleFabClick() {
  trackEvent(EXPERIMENTS.HOMEPAGE_CTA.name, 'fab_click', {
    source: 'mobile_fab',
  });
}

/**
 * Floating Action Button for primary CTA ("Ask a Question")
 * - Visible on mobile only (hidden on desktop where CTA is in content)
 * - Hidden on pages where it's not relevant (NewCase, Login, Signup)
 * - Fixed position bottom-right with safe area padding
 */
export function FloatingActionButton({
  to = '/cases/new',
  label = 'Ask'
}: FloatingActionButtonProps) {
  const location = useLocation();

  // Hide FAB on certain pages where it's not appropriate
  const hiddenPaths = ['/cases/new', '/login', '/signup'];
  const shouldHide = hiddenPaths.some(path => location.pathname === path);

  // Also hide if we're on a specific case view (to avoid clutter during reading)
  const isOnCaseView = location.pathname.match(/^\/cases\/[^/]+$/);

  if (shouldHide || isOnCaseView) {
    return null;
  }

  return (
    <Link
      to={to}
      onClick={handleFabClick}
      className="
        fixed bottom-6 right-6 z-40
        md:hidden
        flex items-center gap-2
        bg-gradient-to-r from-red-600 to-orange-600
        hover:from-red-700 hover:to-orange-700
        text-white font-semibold
        pl-4 pr-5 py-3
        rounded-full
        shadow-lg shadow-red-600/30
        hover:shadow-xl hover:shadow-red-600/40
        transform hover:scale-105
        transition-all duration-200
        active:scale-95
      "
      aria-label="Ask a Question"
    >
      {/* Plus icon */}
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M12 4v16m8-8H4"
        />
      </svg>
      <span className="text-sm">{label}</span>
    </Link>
  );
}

export default FloatingActionButton;

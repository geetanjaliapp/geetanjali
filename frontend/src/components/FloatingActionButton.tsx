import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { trackEvent } from "../lib/experiment";
import { useAudioPlayer } from "./audio";

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
  trackEvent("homepage", "fab_click", {
    source: "mobile_fab",
  });
}

/**
 * Floating Action Button for primary CTA ("Ask a Question")
 * - Visible on mobile only (hidden on desktop where CTA is in content)
 * - Hidden on pages where it's not relevant (NewCase, Login, Signup)
 * - Hidden on homepage when inline CTA is visible (scroll-aware)
 * - Fixed position bottom-right with safe area padding
 */
export function FloatingActionButton({
  to = "/cases/new",
  label = "Ask",
}: FloatingActionButtonProps) {
  const location = useLocation();
  const isHomepage = location.pathname === "/";

  // Check if audio bar is visible (audio actively playing/paused/loading/error)
  const { currentlyPlaying, state: audioState } = useAudioPlayer();
  const isAudioBarVisible = Boolean(
    currentlyPlaying &&
    (audioState === "playing" ||
      audioState === "paused" ||
      audioState === "loading" ||
      audioState === "error"),
  );

  // Track whether CTA is in viewport (only relevant on homepage)
  const [ctaInView, setCtaInView] = useState(isHomepage);

  // Scroll-aware: hide FAB when inline CTA is visible on homepage
  useEffect(() => {
    // Only apply scroll-awareness on homepage
    if (!isHomepage) {
      return;
    }

    const ctaElement = document.querySelector("[data-cta-primary]");
    if (!ctaElement) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setCtaInView(entry.isIntersecting),
      { threshold: 0.5 },
    );
    observer.observe(ctaElement);

    return () => observer.disconnect();
  }, [isHomepage]);

  // Hide FAB on certain pages where it's not appropriate
  const hiddenPaths = ["/cases/new", "/login", "/signup"];
  const shouldHide = hiddenPaths.some((path) => location.pathname === path);

  // Show on /read (users may have questions from scripture)
  const isOnReadingMode = location.pathname === "/read";

  // Show on case view (users may want follow-up questions)
  const isOnCaseView = location.pathname.match(/^\/cases\/[^/]+$/);

  // Hide on verse detail (conflicts with sticky bottom nav)
  const isOnVerseDetail = location.pathname.match(/^\/verses\/[^/]+$/);

  // Hide when inline CTA is visible on homepage
  const hideOnHomepage = isHomepage && ctaInView;

  if (shouldHide || isOnVerseDetail || hideOnHomepage) {
    return null;
  }

  // Determine bottom offset based on page layout:
  // - Reading Mode: bottom nav + MiniPlayer always visible → bottom-36 (144px)
  // - Case view: bottom nav → bottom-20 (80px)
  // - Verses with audio playing: FloatingAudioBar → bottom-20 (80px)
  // - Default: bottom-6 (24px)
  const getBottomClass = () => {
    if (isOnReadingMode) {
      return "bottom-36"; // Bottom nav + MiniPlayer always present
    }
    if (isOnCaseView || isAudioBarVisible) {
      return "bottom-20"; // Bottom nav or floating audio bar
    }
    return "bottom-6"; // Default
  };

  return (
    <Link
      to={to}
      onClick={handleFabClick}
      className={`
        fixed right-6 z-40
        ${getBottomClass()}
        md:hidden
        flex items-center gap-2
        bg-linear-to-r from-[var(--gradient-fab-from)] to-[var(--gradient-fab-to)]
        hover:from-[var(--gradient-fab-hover-from)] hover:to-[var(--gradient-fab-hover-to)]
        text-[var(--interactive-primary-text)] font-semibold
        pl-4 pr-5 py-3
        rounded-[var(--radius-chip)]
        shadow-[var(--shadow-dropdown)] shadow-[var(--shadow-fab)]
        hover:shadow-[var(--shadow-modal)] hover:shadow-[var(--shadow-fab-hover)]
        transform hover:scale-105
        transition-[var(--transition-all)]
        active:scale-95
        focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]
      `}
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

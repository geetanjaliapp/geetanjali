import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { trackEvent } from "../lib/experiment";

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

  // Position higher on pages with bottom navigation
  const needsHigherPosition = isOnReadingMode || isOnCaseView;

  return (
    <Link
      to={to}
      onClick={handleFabClick}
      className={`
        fixed right-6 z-40
        ${needsHigherPosition ? "bottom-20" : "bottom-6"}
        md:hidden
        flex items-center gap-2
        bg-linear-to-r from-orange-500 to-orange-600
        hover:from-orange-600 hover:to-orange-700
        text-white font-semibold
        pl-4 pr-5 py-3
        rounded-full
        shadow-lg shadow-orange-600/30
        hover:shadow-xl hover:shadow-orange-600/40
        transform hover:scale-105
        transition-all duration-200
        active:scale-95
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

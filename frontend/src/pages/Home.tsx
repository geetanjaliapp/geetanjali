import { Link } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { checkHealth, casesApi, versesApi } from "../lib/api";
import type { Case, Verse } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { FeaturedVerse } from "../components/FeaturedVerse";
import { Footer } from "../components/Footer";
import { Navbar, NewsletterCard } from "../components";
import { LogoIcon } from "../components/icons";
import { useSEO } from "../hooks";
import { trackEvent } from "../lib/experiment";
import { errorMessages } from "../lib/errorMessages";

// Lazy load FeaturedConsultations to reduce main bundle size
// (includes react-markdown which adds ~100KB)
const FeaturedConsultations = lazy(
  () => import("../components/FeaturedConsultations")
);

export default function Home() {
  // SEO - uses defaults for homepage
  useSEO({ canonical: "/" });
  const [error, setError] = useState<string | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [casesError, setCasesError] = useState(false);
  const [dailyVerse, setDailyVerse] = useState<Verse | null>(null);
  const [verseError, setVerseError] = useState(false);
  const [verseLoading, setVerseLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  // Cases loading state - only relevant when authenticated
  const [casesLoading, setCasesLoading] = useState(isAuthenticated);

  // Simple analytics tracking (A/B test removed)
  const handlePrimaryCTA = () => {
    trackEvent("homepage", "cta_click", { type: "primary" });
  };

  const handleExploreCTA = () => {
    trackEvent("homepage", "cta_click", { type: "explore" });
  };

  // Check backend health on mount
  useEffect(() => {
    checkHealth().catch((err) => setError(errorMessages.health(err)));
  }, []);

  // Load recent consultations when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    casesApi
      .list(0, 3)
      .then((data) => {
        if (!cancelled) setRecentCases(data.cases);
      })
      .catch(() => {
        if (!cancelled) setCasesError(true);
      })
      .finally(() => {
        if (!cancelled) setCasesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Load random verse on mount
  useEffect(() => {
    let cancelled = false;
    versesApi
      .getRandom()
      .then((data) => {
        if (!cancelled) {
          setDailyVerse(data);
        }
      })
      .catch(() => {
        if (!cancelled) setVerseError(true);
      })
      .finally(() => {
        if (!cancelled) setVerseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      <Navbar />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
        <div className="text-center">
          {/* Hero Section */}
          <div className="mb-6 sm:mb-8">
            {/* Logo */}
            <div className="flex justify-center mb-4 sm:mb-5">
              <LogoIcon className="h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
            </div>

            {/* Main Tagline */}
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold font-heading text-[var(--text-primary)] mb-2">
              Wisdom for Life's{" "}
              <span className="bg-linear-to-r from-[var(--text-accent)] to-[var(--gradient-accent-to)] bg-clip-text text-transparent">
                Difficult Decisions
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg lg:text-xl text-[var(--text-tertiary)] max-w-2xl mx-auto">
              Ethical guidance grounded in the timeless teachings of the
              Bhagavad Geeta
            </p>

            {/* Signup prompt for guests */}
            {!isAuthenticated && (
              <p className="text-sm text-[var(--text-muted)] mt-3 sm:mt-4">
                Try it free — no signup required
              </p>
            )}
          </div>

          {/* Backend Status - Only show errors */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 sm:mb-8 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-[var(--status-error-text)] px-4 sm:px-6 py-3 sm:py-4 rounded-[var(--radius-button)] max-w-2xl mx-auto"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg sm:text-xl">⚠️</span>
                <div className="text-left">
                  <p className="font-semibold mb-1 text-sm sm:text-base">
                    Service Unavailable
                  </p>
                  <p className="text-xs sm:text-sm text-[var(--status-error-text)]">
                    Unable to connect to the service. Please try again later.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Featured Verse of the Day */}
          <div className="mb-6 sm:mb-8 lg:mb-10">
            <FeaturedVerse
              verse={dailyVerse}
              loading={verseLoading}
              error={verseError}
            />
          </div>

          {/* CTA Section - visible on all screen sizes */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 lg:mb-8"
            data-cta-primary
          >
            <Link
              to="/cases/new"
              onClick={handlePrimaryCTA}
              className="inline-flex items-center gap-2 bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] text-[var(--interactive-primary-text)] font-semibold px-6 py-3 sm:px-8 sm:py-3.5 rounded-[var(--radius-card)] transition-[var(--transition-all)] shadow-[var(--shadow-dropdown)] hover:shadow-[var(--shadow-modal)] text-base sm:text-lg group"
            >
              <span>Ask a Question</span>
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link
              to="/verses"
              onClick={handleExploreCTA}
              className="inline-flex items-center gap-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] font-medium px-6 py-3 sm:px-8 sm:py-3.5 rounded-[var(--radius-card)] transition-[var(--transition-all)] border border-[var(--border-default)] hover:border-[var(--border-default)] text-base sm:text-lg"
            >
              <span>Explore Verses</span>
            </Link>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mb-8 lg:mb-10">
            Get personalized guidance in minutes
          </p>

          {/* Featured Consultations - lazy loaded to reduce initial bundle */}
          <div className="mb-8 sm:mb-10 lg:mb-12">
            <Suspense
              fallback={
                <div className="animate-pulse bg-[var(--skeleton-bg)] rounded-[var(--radius-card)] h-64" />
              }
            >
              <FeaturedConsultations />
            </Suspense>
          </div>

          {/* Daily Wisdom Discovery Card - dismissable */}
          <NewsletterCard />

          {/* Recent Consultations */}
          {!casesLoading && recentCases.length > 0 && (
            <div className="mb-8 sm:mb-10 max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                  Continue where you left off
                </h2>
                <Link
                  to="/consultations"
                  className="text-[var(--interactive-ghost-text)] hover:text-[var(--text-link-hover)] font-medium text-sm shrink-0"
                >
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {recentCases.map((case_) => (
                  <Link
                    key={case_.id}
                    to={`/cases/${case_.id}`}
                    className="flex items-center justify-between gap-4 p-3 bg-[var(--surface-warm-subtle)] rounded-[var(--radius-button)] border border-[var(--border-warm)] hover:border-[var(--option-selected-border)] hover:bg-[var(--surface-warm)] transition-[var(--transition-all)] group"
                  >
                    <h3 className="font-medium text-[var(--text-primary)] text-sm sm:text-base truncate group-hover:text-[var(--option-selected-text)] transition-[var(--transition-color)] min-w-0">
                      {case_.title}
                    </h3>
                    <span className="text-xs text-[var(--text-muted)] shrink-0">
                      {new Date(case_.created_at || "").toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Consultations Error State */}
          {!casesLoading && casesError && isAuthenticated && (
            <div className="mb-8 sm:mb-10 max-w-4xl mx-auto">
              <div className="p-4 bg-[var(--surface-warm-subtle)] rounded-[var(--radius-button)] border border-[var(--border-warm)] text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  Unable to load your consultations.{" "}
                  <Link
                    to="/consultations"
                    className="text-[var(--interactive-ghost-text)] hover:underline"
                  >
                    View all consultations →
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Feature Overview - Problem-oriented copy */}
          <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6 max-w-4xl mx-auto">
            <div className="bg-linear-to-br from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] p-3 sm:p-6 rounded-[var(--radius-card)] border border-[var(--border-warm)] text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--section-icon-newsletter-bg)] rounded-[var(--radius-button)] flex items-center justify-center mb-2 sm:mb-4 mx-auto">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-accent)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-xs sm:text-lg font-semibold text-[var(--text-primary)] sm:mb-1.5">
                <span className="sm:hidden">Navigate</span>
                <span className="hidden sm:inline">Navigate Tough Choices</span>
              </h3>
              <p className="hidden sm:block text-[var(--text-tertiary)] text-sm sm:text-base leading-relaxed">
                Get clarity when the right path isn't obvious
              </p>
            </div>
            <div className="bg-linear-to-br from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] p-3 sm:p-6 rounded-[var(--radius-card)] border border-[var(--border-warm)] text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--section-icon-newsletter-bg)] rounded-[var(--radius-button)] flex items-center justify-center mb-2 sm:mb-4 mx-auto">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-accent)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>
              <h3 className="text-xs sm:text-lg font-semibold text-[var(--text-primary)] sm:mb-1.5">
                <span className="sm:hidden">Options</span>
                <span className="hidden sm:inline">See All Your Options</span>
              </h3>
              <p className="hidden sm:block text-[var(--text-tertiary)] text-sm sm:text-base leading-relaxed">
                Compare approaches with honest trade-offs
              </p>
            </div>
            <div className="bg-linear-to-br from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] p-3 sm:p-6 rounded-[var(--radius-card)] border border-[var(--border-warm)] text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--section-icon-newsletter-bg)] rounded-[var(--radius-button)] flex items-center justify-center mb-2 sm:mb-4 mx-auto">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-accent)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="text-xs sm:text-lg font-semibold text-[var(--text-primary)] sm:mb-1.5">
                <span className="sm:hidden">Trusted</span>
                <span className="hidden sm:inline">Wisdom You Can Trust</span>
              </h3>
              <p className="hidden sm:block text-[var(--text-tertiary)] text-sm sm:text-base leading-relaxed">
                Every recommendation cites its source
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Bottom padding for FAB on mobile */}
      <div className="h-20 sm:hidden" />
    </div>
  );
}

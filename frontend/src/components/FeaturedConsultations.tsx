import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trackEvent } from "../lib/experiment";
import { getVersePath } from "../lib/sanskritFormatter";
import {
  getFeaturedCases,
  getRandomCaseForCategory,
  isApiCase,
} from "../lib/featuredCases";
import { GuidanceMarkdown } from "./GuidanceMarkdown";
import type { FeaturedCasesResponse } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  career: "Career",
  relationships: "Relationships",
  ethics: "Ethics",
  leadership: "Leadership",
};

interface FeaturedConsultationsProps {
  defaultCategory?: string;
}

export function FeaturedConsultations({
  defaultCategory,
}: FeaturedConsultationsProps) {
  const [selected, setSelected] = useState<string | null>(
    defaultCategory || null,
  );
  const [data, setData] = useState<FeaturedCasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();

  // Fetch featured cases on mount
  useEffect(() => {
    let cancelled = false;

    getFeaturedCases()
      .then((response) => {
        if (!cancelled) {
          setData(response);
          // Pick random category from API response if not already set
          setSelected((prev) => {
            if (response.categories.length > 0 && !prev) {
              const randomIdx = Math.floor(
                Math.random() * response.categories.length,
              );
              return response.categories[randomIdx];
            } else if (prev && !response.categories.includes(prev)) {
              // Selected category not in response, pick first available
              return response.categories[0] || null;
            }
            return prev;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [defaultCategory]);

  // Get random case for selected category (memoized per category selection)
  const currentCase = useMemo(() => {
    if (!data || !selected) return null;
    return getRandomCaseForCategory(data.cases, selected);
  }, [data, selected]);

  const categories = data?.categories ?? [];

  const handleCategoryChange = (category: string) => {
    if (category === selected) return;

    // Fade out, change, fade in
    setIsTransitioning(true);
    setTimeout(() => {
      setSelected(category);
      trackEvent("homepage", "featured_tab_click", { category });
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };

  const handleViewFull = (slug: string) => {
    trackEvent("homepage", "cta_click", {
      type: "view_full",
      category: selected,
    });
    navigate(`/c/${slug}`);
  };

  const handleAskSimilar = () => {
    trackEvent("homepage", "cta_click", {
      type: "ask_similar",
      category: selected,
    });
    navigate("/cases/new", {
      state: { prefill: currentCase?.dilemma_preview },
    });
  };

  // Loading state
  if (loading) {
    return (
      <section className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl font-heading font-semibold text-[var(--text-primary)] mb-4 text-center">
          See how Geetanjali helps
        </h2>
        <div className="bg-[var(--surface-elevated)] rounded-xl sm:rounded-2xl shadow-md border border-[var(--border-warm)] p-6 sm:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-[var(--surface-muted)] rounded-sm w-3/4"></div>
            <div className="h-4 bg-[var(--surface-muted)] rounded-sm w-1/2"></div>
            <div className="h-20 bg-[var(--surface-muted)] rounded-sm"></div>
          </div>
        </div>
      </section>
    );
  }

  // Error state - fall back to static message
  if (error || !currentCase) {
    return (
      <section className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl font-heading font-semibold text-[var(--text-primary)] mb-4 text-center">
          See how Geetanjali helps
        </h2>
        <div className="bg-[var(--surface-elevated)] rounded-xl sm:rounded-2xl shadow-md border border-[var(--border-warm)] p-6 sm:p-8 text-center">
          <p className="text-[var(--text-secondary)] mb-4">
            Explore real ethical dilemmas and see how ancient wisdom applies to
            modern challenges.
          </p>
          <Link
            to="/cases/new"
            className="inline-flex items-center gap-2 text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded-sm"
          >
            <span>Ask your own question</span>
            <svg
              className="w-4 h-4"
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
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto">
      {/* Section Header */}
      <h2 className="text-lg sm:text-xl font-heading font-semibold text-[var(--text-primary)] mb-4 text-center">
        See how Geetanjali helps
      </h2>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
              selected === cat
                ? "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]"
                : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)]"
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Featured Case Content Card with fade transition */}
      <div
        className={`bg-[var(--surface-elevated)] rounded-xl sm:rounded-2xl shadow-md border border-[var(--border-warm)] p-4 sm:p-6 transition-opacity duration-150 text-left ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Badge at top left */}
        {isApiCase(currentCase) && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--badge-warm-text)] bg-[var(--badge-warm-bg)] px-2 py-0.5 rounded-full mb-3">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            From community
          </span>
        )}

        {/* Dilemma Quote - left aligned, 3 lines max */}
        <blockquote className="text-[var(--text-primary)] text-base sm:text-lg italic border-l-4 border-[var(--border-accent)] pl-4 mb-4 line-clamp-3">
          "{currentCase.dilemma_preview}"
        </blockquote>

        {/* Guidance Summary - left aligned, 4 lines max, markdown (newlines merged) */}
        {currentCase.guidance_summary && (
          <div className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed line-clamp-4">
            <GuidanceMarkdown
              content={currentCase.guidance_summary.replace(/\n+/g, " ").trim()}
              className="prose-base prose-p:my-0 prose-p:leading-relaxed"
            />
          </div>
        )}

        {/* Recommended Steps */}
        {currentCase.recommended_steps.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Geetanjali suggests:
            </p>
            <div className="bg-[var(--surface-warm-subtle)] rounded-lg p-3 sm:p-4">
              <ul className="space-y-2">
                {currentCase.recommended_steps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm sm:text-base text-[var(--text-secondary)]"
                  >
                    <span className="shrink-0 w-5 h-5 bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Follow-up Indicator */}
        {currentCase.has_followups && (
          <p className="text-xs sm:text-sm text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
            <span>💬</span>
            <span>Includes follow-up discussion</span>
          </p>
        )}

        {/* Verse References - centered */}
        {currentCase.verse_references.length > 0 && (
          <p className="text-xs sm:text-sm text-[var(--text-tertiary)] text-center">
            Based on:{" "}
            {currentCase.verse_references.map((ref, idx) => (
              <span key={ref.canonical_id}>
                <Link
                  to={getVersePath(ref.display)}
                  className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:underline focus-visible:outline-hidden focus-visible:underline focus-visible:ring-1 focus-visible:ring-[var(--border-focus)] rounded-sm"
                >
                  {ref.display}
                </Link>
                {idx < currentCase.verse_references.length - 1 && ", "}
              </span>
            ))}
          </p>
        )}

        {/* View Full Consultation - separate line */}
        {isApiCase(currentCase) && currentCase.slug && (
          <p className="text-sm text-center mt-3">
            <button
              onClick={() => handleViewFull(currentCase.slug!)}
              className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:underline focus-visible:outline-hidden focus-visible:underline focus-visible:ring-1 focus-visible:ring-[var(--border-focus)] rounded-sm font-medium"
            >
              View full consultation →
            </button>
          </p>
        )}
      </div>

      {/* CTA - Outside card, outlined button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={handleAskSimilar}
          className="inline-flex items-center gap-2 border-2 border-[var(--interactive-primary)] text-[var(--text-accent)] hover:bg-[var(--interactive-primary)] hover:text-white hover:text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-sm sm:text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
        >
          <span>Ask a similar question</span>
          <svg
            className="w-4 h-4"
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
        </button>
      </div>
    </section>
  );
}

export default FeaturedConsultations;

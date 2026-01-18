/**
 * TopicsIndex - Landing page for all principles/topics
 *
 * Route: /topics
 *
 * Features:
 * - Hero section with page title
 * - 4 yoga path groups (Karma, Jnana, Bhakti, Sadachara)
 * - 4 principles per group (16 total)
 * - Responsive grid: 1 col mobile, 2 cols tablet, 2x2 groups desktop
 * - Topic cards with Sanskrit names, descriptions, verse counts
 *
 * Design: Mobile-first, content-forward, warm accessibility
 */

import { Navbar } from "../components";
import { Footer } from "../components/Footer";
import { TopicCard } from "../components/topics";
import { useTopics, useSEO } from "../hooks";

/** Loading skeleton for TopicsIndex */
function TopicsIndexSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="h-8 bg-[var(--skeleton-bg)] rounded w-64 mx-auto" />
        <div className="h-4 bg-[var(--skeleton-bg)] rounded w-80 mx-auto mt-4" />
      </div>

      {/* Group skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2, 3, 4].map((g) => (
          <div key={g}>
            <div className="h-6 bg-[var(--skeleton-bg)] rounded w-40 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((p) => (
                <div
                  key={p}
                  className="h-32 bg-[var(--skeleton-bg)] rounded-[var(--radius-card)]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Error state component */
function TopicsError({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-[var(--status-error-text)] mb-4">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="text-[var(--text-accent)] hover:text-[var(--interactive-primary)] underline"
      >
        Try again
      </button>
    </div>
  );
}

export default function TopicsIndex() {
  const { groups, totalPrinciples, totalVerses, loading, error } = useTopics();

  useSEO({
    title: "Teachings of the Bhagavad Gita | 16 Principles for Ethical Leadership",
    description:
      "Explore 16 timeless principles from the Bhagavad Gita for ethical leadership and personal growth. Discover teachings on Karma, Jnana, Bhakti, and Sadachara.",
    canonical: "/topics",
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero section */}
        <header className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-heading text-[var(--text-primary)] mb-3">
            Teachings of the Bhagavad Gita
          </h1>
          <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Explore {totalPrinciples || 16} timeless principles for ethical
            leadership and personal growth, drawn from {totalVerses || 701}{" "}
            verses of sacred wisdom.
          </p>
        </header>

        {/* Loading state */}
        {loading && <TopicsIndexSkeleton />}

        {/* Error state */}
        {error && <TopicsError message={error} />}

        {/* Content */}
        {!loading && !error && groups.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                {/* Group header */}
                <h2
                  id={`group-${group.id}`}
                  className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"
                >
                  <span>{group.label}</span>
                  <span className="font-serif text-[var(--text-tertiary)]">
                    {group.sanskrit}
                  </span>
                  <span className="text-sm font-normal text-[var(--text-muted)]">
                    · {group.description}
                  </span>
                </h2>

                {/* Principles grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {group.principles.map((principle) => (
                    <TopicCard
                      key={principle.id}
                      principle={principle}
                      showVerseCount
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Empty state (shouldn't happen, but handle gracefully) */}
        {!loading && !error && groups.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--text-secondary)]">
              No topics available at the moment.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

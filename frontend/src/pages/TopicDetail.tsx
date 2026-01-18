/**
 * TopicDetail - Deep dive page for a single principle/topic
 *
 * Route: /topics/:topicId
 *
 * Features:
 * - Hero header with Sanskrit name, English label, yoga path badge
 * - Collapsible content sections (extended, leadership, application, misconceptions)
 * - FAQ accordion
 * - Related topics horizontal scroll
 * - Verse list with audio indicators
 * - Back to topics navigation
 *
 * Design: Mobile-first, content-forward, progressive disclosure
 */

import { Link, useParams } from "react-router-dom";
import { Navbar } from "../components";
import { Footer } from "../components/Footer";
import {
  TopicCard,
  TopicHeader,
  TopicContent,
  TopicFAQ,
  TopicVerseList,
} from "../components/topics";
import { ChevronLeftIcon } from "../components/icons";
import { useTopic, useSEO } from "../hooks";

/** Loading skeleton for TopicDetail */
function TopicDetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="text-center py-8">
        <div className="h-12 bg-[var(--skeleton-bg)] rounded w-32 mx-auto" />
        <div className="h-6 bg-[var(--skeleton-bg)] rounded w-48 mx-auto mt-4" />
        <div className="h-8 bg-[var(--skeleton-bg)] rounded w-40 mx-auto mt-4" />
        <div className="h-16 bg-[var(--skeleton-bg)] rounded max-w-xl mx-auto mt-6" />
      </div>

      {/* Content section skeletons */}
      {[1, 2, 3].map((s) => (
        <div key={s} className="border-t border-[var(--border-subtle)] py-4">
          <div className="h-6 bg-[var(--skeleton-bg)] rounded w-48" />
          <div className="h-24 bg-[var(--skeleton-bg)] rounded mt-4" />
        </div>
      ))}
    </div>
  );
}

/** Error state component */
function TopicError({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-[var(--status-error-text)] mb-4">{message}</p>
      <Link
        to="/topics"
        className="text-[var(--text-accent)] hover:text-[var(--interactive-primary)] underline"
      >
        Back to Topics
      </Link>
    </div>
  );
}

export default function TopicDetail() {
  const { topicId } = useParams<{ topicId: string }>();
  const { topic, loading, error } = useTopic(topicId);

  useSEO({
    title: topic
      ? `${topic.label} (${topic.sanskrit}) | Geetanjali`
      : "Topic | Geetanjali",
    description: topic?.description ?? "Explore this principle from the Bhagavad Gita.",
    canonical: topicId ? `/topics/${topicId}` : "/topics",
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Back navigation */}
        <nav className="mb-4" aria-label="Breadcrumb">
          <Link
            to="/topics"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-tertiary)]
                       hover:text-[var(--text-secondary)] transition-colors
                       min-h-[44px] py-2"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Topics
          </Link>
        </nav>

        {/* Loading state */}
        {loading && <TopicDetailSkeleton />}

        {/* Error state */}
        {error && <TopicError message={error} />}

        {/* Content */}
        {!loading && !error && topic && (
          <>
            {/* Hero header */}
            <TopicHeader topic={topic} />

            {/* Collapsible content sections */}
            <TopicContent topic={topic} />

            {/* FAQ accordion */}
            {topic.faq && <TopicFAQ faq={topic.faq} />}

            {/* Related topics */}
            {topic.relatedPrinciples.length > 0 && (
              <section className="border-t border-[var(--border-subtle)] py-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                  Related Teachings
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                  {topic.relatedPrinciples.map((related) => (
                    <TopicCard
                      key={related.id}
                      principle={{
                        id: related.id,
                        label: related.label,
                        shortLabel: related.shortLabel,
                        sanskrit: "", // Not available in related principles
                        transliteration: "",
                        description: "",
                        verseCount: 0,
                      }}
                      compact
                      showVerseCount={false}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Verse list */}
            <TopicVerseList
              verses={topic.verses}
              topicId={topic.id}
              topicLabel={topic.shortLabel}
            />
          </>
        )}

        {/* Not found state */}
        {!loading && !error && !topic && (
          <TopicError message="Topic not found." />
        )}
      </main>

      <Footer />
    </div>
  );
}

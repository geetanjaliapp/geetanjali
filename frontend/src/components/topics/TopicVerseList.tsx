/**
 * TopicVerseList - List of verses associated with a topic
 *
 * Features:
 * - Verse cards with Sanskrit preview
 * - Audio indicator for verses with audio
 * - Click navigates to verse detail with back context
 * - "Load more" pagination for > 8 verses
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import type { TopicVerseSummary } from "../../lib/api";
import { VolumeIcon } from "../icons";

interface TopicVerseListProps {
  /** Verses to display */
  verses: TopicVerseSummary[];
  /** Topic ID for navigation context */
  topicId: string;
  /** Topic label for heading */
  topicLabel: string;
}

const INITIAL_SHOW_COUNT = 8;

export function TopicVerseList({
  verses,
  topicId,
  topicLabel,
}: TopicVerseListProps) {
  const [showAll, setShowAll] = useState(false);

  if (verses.length === 0) {
    return null;
  }

  const displayedVerses = showAll ? verses : verses.slice(0, INITIAL_SHOW_COUNT);
  const hasMore = verses.length > INITIAL_SHOW_COUNT;

  return (
    <section className="border-t border-[var(--border-subtle)] py-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        Verses on {topicLabel}{" "}
        <span className="font-normal text-[var(--text-tertiary)]">
          ({verses.length})
        </span>
      </h2>

      <div className="space-y-3">
        {displayedVerses.map((verse) => (
          <Link
            key={verse.canonicalId}
            to={`/verses/${verse.canonicalId}?from=topic&topic=${encodeURIComponent(topicId)}`}
            className="flex items-start gap-3 p-3 sm:p-4
                       bg-[var(--surface-card)] border border-[var(--border-default)]
                       rounded-[var(--radius-card)]
                       hover:bg-[var(--surface-warm-subtle)]
                       transition-[var(--transition-color)] group"
          >
            <div className="flex-1 min-w-0">
              {/* Verse reference */}
              <p className="text-sm font-medium text-[var(--text-accent)] mb-1">
                {verse.chapter}.{verse.verse}
              </p>

              {/* Sanskrit preview */}
              <p className="text-base font-serif text-[var(--text-sanskrit-primary)] line-clamp-1 mb-1">
                {verse.sanskritDevanagari}
              </p>

              {/* English preview */}
              <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                {verse.paraphraseEn}
              </p>
            </div>

            {/* Audio indicator + arrow */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {verse.hasAudio && (
                <VolumeIcon
                  className="w-4 h-4 text-[var(--text-tertiary)]"
                  aria-label="Has audio"
                />
              )}
              <span className="text-[var(--text-tertiary)] group-hover:text-[var(--text-accent)] transition-colors">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Load more button */}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full py-3 text-sm font-medium
                     text-[var(--text-accent)] hover:text-[var(--interactive-primary)]
                     border border-[var(--border-default)] rounded-[var(--radius-button)]
                     hover:border-[var(--border-accent)] transition-colors
                     min-h-[44px]"
        >
          Show all {verses.length} verses
        </button>
      )}

      {showAll && hasMore && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-4 w-full py-3 text-sm font-medium
                     text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
                     transition-colors min-h-[44px]"
        >
          Show less
        </button>
      )}
    </section>
  );
}

export default TopicVerseList;

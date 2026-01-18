/**
 * TopicCard - Card component for topic/principle display
 *
 * Used in:
 * - TopicsIndex page grid
 * - Related topics horizontal scroll
 *
 * Features:
 * - Sanskrit name prominently displayed
 * - English label and description
 * - Verse count badge (optional)
 * - Compact variant for horizontal scroll
 * - Hover lift effect
 */

import { Link } from "react-router-dom";
import type { TopicPrincipleSummary } from "../../lib/api";

interface TopicCardProps {
  /** Principle data to display */
  principle: TopicPrincipleSummary;
  /** Compact mode for horizontal scroll (related topics) */
  compact?: boolean;
  /** Show verse count badge */
  showVerseCount?: boolean;
}

export function TopicCard({
  principle,
  compact = false,
  showVerseCount = true,
}: TopicCardProps) {
  if (compact) {
    // In compact mode, show Sanskrit if available, otherwise show shortLabel
    const primaryText = principle.sanskrit || principle.shortLabel;
    const secondaryText = principle.sanskrit ? principle.shortLabel : principle.label;

    return (
      <Link
        to={`/topics/${principle.id}`}
        className="flex-shrink-0 w-32 sm:w-36 p-3
                   bg-[var(--surface-card)] border border-[var(--border-default)]
                   rounded-[var(--radius-card)] shadow-[var(--shadow-card)]
                   hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5
                   transition-all duration-150 text-center"
        aria-label={principle.label}
      >
        <p className="text-base font-serif text-[var(--text-sanskrit-primary)] mb-1 line-clamp-1">
          {primaryText}
        </p>
        <p className="text-xs font-medium text-[var(--text-secondary)] line-clamp-1">
          {secondaryText}
        </p>
      </Link>
    );
  }

  return (
    <Link
      to={`/topics/${principle.id}`}
      className="block p-4 sm:p-5
                 bg-[var(--surface-card)] border border-[var(--border-default)]
                 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]
                 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5
                 transition-all duration-150 group"
      aria-label={`${principle.label}: ${principle.description}`}
    >
      {/* Sanskrit name - hero */}
      <h3 className="text-lg sm:text-xl font-serif font-semibold text-[var(--text-sanskrit-primary)] mb-1">
        {principle.sanskrit}
      </h3>

      {/* English label */}
      <p className="text-base font-medium text-[var(--text-primary)] mb-2">
        {principle.label}
      </p>

      {/* Description - truncated to 2 lines */}
      <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
        {principle.description}
      </p>

      {/* Footer: verse count + arrow */}
      <div className="flex items-center justify-between">
        {showVerseCount && principle.verseCount > 0 && (
          <span className="text-xs text-[var(--badge-warm-text)] bg-[var(--badge-warm-bg)] px-2 py-0.5 rounded-[var(--radius-badge)]">
            {principle.verseCount} verses
          </span>
        )}
        {(!showVerseCount || principle.verseCount === 0) && <span />}
        <span className="text-[var(--text-accent)] group-hover:text-[var(--interactive-primary)] text-sm transition-colors">
          →
        </span>
      </div>
    </Link>
  );
}

export default TopicCard;

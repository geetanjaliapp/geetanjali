/**
 * TopicHeader - Hero section for topic detail page
 *
 * Displays:
 * - Sanskrit name (large, hero)
 * - English label
 * - Yoga path badge
 * - Core description
 */

import type { TopicDetailResponse } from "../../lib/api";

interface TopicHeaderProps {
  /** Topic data */
  topic: TopicDetailResponse;
}

export function TopicHeader({ topic }: TopicHeaderProps) {
  return (
    <header className="text-center py-6 sm:py-10">
      {/* Sanskrit name - hero */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[var(--text-sanskrit-primary)] mb-2">
        {topic.sanskrit}
      </h1>

      {/* English name */}
      <p className="text-xl sm:text-2xl font-medium text-[var(--text-primary)] mb-4">
        {topic.label}
      </p>

      {/* Yoga path badge */}
      <div className="mb-6">
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5
                     bg-[var(--surface-warm)] rounded-[var(--radius-badge)]
                     text-sm text-[var(--text-secondary)]"
        >
          {topic.group.label}
          <span className="text-[var(--text-tertiary)]">·</span>
          <span className="font-serif">{topic.group.transliteration}</span>
        </span>
      </div>

      {/* Description */}
      <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
        {topic.description}
      </p>
    </header>
  );
}

export default TopicHeader;

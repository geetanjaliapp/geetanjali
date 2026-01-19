/**
 * TopicContent - Collapsible content sections for topic detail
 *
 * Sections:
 * - Extended description (Understanding [Topic])
 * - Leadership context (In Leadership)
 * - Practical application (Applying This Principle)
 * - Common misconceptions
 *
 * Features:
 * - Progressive disclosure (collapsible)
 * - First section expanded by default
 * - Smooth height animations
 * - WCAG accessible (aria-expanded)
 */

import { useState, useId } from "react";
import type { TopicDetailResponse } from "../../lib/api";
import { ChevronDownIcon } from "../icons";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="border-t border-[var(--border-subtle)] py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left py-2
                   min-h-[44px] focus:outline-hidden focus-visible:ring-2
                   focus-visible:ring-[var(--border-focus)] rounded-sm"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <ChevronDownIcon
          className={`w-5 h-5 text-[var(--text-tertiary)]
                      transition-transform duration-200
                      ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id={contentId}
        className={`overflow-hidden transition-[max-height,opacity] duration-300
                    ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="pt-3 text-[var(--text-secondary)] leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  );
}

interface TopicContentProps {
  /** Topic data */
  topic: TopicDetailResponse;
}

export function TopicContent({ topic }: TopicContentProps) {
  const hasExtended = Boolean(topic.extendedDescription);
  const hasApplication = Boolean(topic.practicalApplication);
  const hasMisconceptions = Boolean(topic.commonMisconceptions);
  const hasLeadership = Boolean(topic.leadershipContext);

  // If no extended content, show nothing
  if (!hasExtended && !hasApplication && !hasMisconceptions && !hasLeadership) {
    return null;
  }

  return (
    <div className="space-y-0">
      {hasExtended && (
        <CollapsibleSection
          title={`Understanding ${topic.shortLabel}`}
          defaultOpen={true}
        >
          <p className="whitespace-pre-line">{topic.extendedDescription}</p>
        </CollapsibleSection>
      )}

      {hasLeadership && (
        <CollapsibleSection title="In Leadership" defaultOpen={!hasExtended}>
          <p className="whitespace-pre-line">{topic.leadershipContext}</p>
        </CollapsibleSection>
      )}

      {hasApplication && (
        <CollapsibleSection
          title="Applying This Principle"
          defaultOpen={!hasExtended && !hasLeadership}
        >
          <p className="whitespace-pre-line">{topic.practicalApplication}</p>
        </CollapsibleSection>
      )}

      {hasMisconceptions && (
        <CollapsibleSection title="Common Misconceptions">
          <p className="whitespace-pre-line">{topic.commonMisconceptions}</p>
        </CollapsibleSection>
      )}
    </div>
  );
}

export default TopicContent;

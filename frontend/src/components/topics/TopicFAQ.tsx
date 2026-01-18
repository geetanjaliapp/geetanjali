/**
 * TopicFAQ - FAQ accordion for topic detail
 *
 * Displays the question/answer pair for a topic in an expandable format.
 * Matches FAQPage schema structure for SEO.
 */

import { useState, useId } from "react";
import type { TopicFAQ as TopicFAQType } from "../../lib/api";
import { ChevronDownIcon } from "../icons";

interface TopicFAQProps {
  /** FAQ data */
  faq: TopicFAQType;
}

export function TopicFAQ({ faq }: TopicFAQProps) {
  const [isOpen, setIsOpen] = useState(false);
  const answerId = useId();

  return (
    <section className="border-t border-[var(--border-subtle)] py-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        Frequently Asked
      </h2>

      <div className="bg-[var(--surface-warm-subtle)] rounded-[var(--radius-card)] p-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left flex items-start justify-between gap-3
                     min-h-[44px] focus:outline-hidden focus-visible:ring-2
                     focus-visible:ring-[var(--border-focus)] rounded-sm"
          aria-expanded={isOpen}
          aria-controls={answerId}
        >
          <h3 className="font-medium text-[var(--text-primary)] pr-2">
            {faq.question}
          </h3>
          <ChevronDownIcon
            className={`w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5
                        transition-transform duration-200
                        ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div
          id={answerId}
          className={`overflow-hidden transition-[max-height,opacity] duration-300
                      ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <p className="mt-3 text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
            {faq.answer}
          </p>
        </div>
      </div>
    </section>
  );
}

export default TopicFAQ;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trackEvent } from "../lib/experiment";
import { getVersePath } from "../lib/sanskritFormatter";

type Category = "career" | "relationships" | "ethics" | "leadership";

interface ConsultationExample {
  dilemma: string;
  options: string[];
  verses: string[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  career: "Career",
  relationships: "Relationships",
  ethics: "Ethics",
  leadership: "Leadership",
};

const EXAMPLES: Record<Category, ConsultationExample> = {
  career: {
    dilemma:
      "My boss asked me to falsify a report. I need this job, but this feels wrong. What should I do?",
    options: [
      "Document and escalate internally",
      "Refuse with clear reasoning",
      "Seek counsel before deciding",
    ],
    verses: ["BG 2.47", "BG 18.63"],
  },
  relationships: {
    dilemma:
      "My colleague is taking credit for my work. Should I confront them or let it go?",
    options: [
      "Direct but private conversation",
      "Document and involve manager",
      "Focus on your own path forward",
    ],
    verses: ["BG 3.19", "BG 6.9"],
  },
  ethics: {
    dilemma:
      "I discovered financial irregularities at my company. Reporting internally failed. Do I go public?",
    options: [
      "Escalate to board/audit committee",
      "External disclosure with legal counsel",
      "Document and wait for right moment",
    ],
    verses: ["BG 18.63", "BG 2.47"],
  },
  leadership: {
    dilemma:
      "I need to lay off team members to save the company. How do I balance duty to individuals vs organization?",
    options: [
      "Transparent communication with support",
      "Explore all alternatives first",
      "Phase gradually with dignity",
    ],
    verses: ["BG 3.35", "BG 18.45"],
  },
};

interface ExampleConsultationProps {
  defaultCategory?: Category;
}

export function ExampleConsultation({
  defaultCategory = "career",
}: ExampleConsultationProps) {
  const [selected, setSelected] = useState<Category>(defaultCategory);
  const navigate = useNavigate();
  const example = EXAMPLES[selected];

  const handleCategoryChange = (category: Category) => {
    setSelected(category);
    trackEvent("homepage", "example_tab_click", { category });
  };

  const handleAskSimilar = () => {
    trackEvent("homepage", "cta_click", {
      type: "ask_similar",
      category: selected,
    });
    // Prefill with the example dilemma so users have a starting point
    navigate("/cases/new", {
      state: { prefill: example.dilemma },
    });
  };

  return (
    <section className="max-w-4xl mx-auto">
      {/* Section Header */}
      <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-4 text-center">
        See how Geetanjali helps
      </h2>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 justify-center">
        {(Object.keys(EXAMPLES) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selected === cat
                ? "bg-orange-600 text-white"
                : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)]"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Example Content Card */}
      <div className="bg-[var(--surface-elevated)] rounded-xl sm:rounded-2xl shadow-md border border-[var(--border-default)] p-4 sm:p-6">
        {/* Dilemma Quote */}
        <blockquote className="text-[var(--text-primary)] text-base sm:text-lg italic mb-4 sm:mb-5 border-l-4 border-[var(--border-accent)] pl-4">
          "{example.dilemma}"
        </blockquote>

        {/* Suggestions */}
        <div className="mb-4 sm:mb-5">
          <p className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
            Geetanjali suggests:
          </p>
          <ul className="space-y-2">
            {example.options.map((option, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm sm:text-base text-[var(--text-secondary)]"
              >
                <span className="shrink-0 w-5 h-5 bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] rounded-full flex items-center justify-center text-xs font-medium">
                  {idx + 1}
                </span>
                <span>{option}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Verse References */}
        <p className="text-xs sm:text-sm text-[var(--text-tertiary)] mb-4 sm:mb-5">
          Based on:{" "}
          {example.verses.map((verse, idx) => (
            <span key={verse}>
              <Link
                to={getVersePath(verse)}
                className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:underline"
              >
                {verse}
              </Link>
              {idx < example.verses.length - 1 && ", "}
            </span>
          ))}
        </p>

        {/* Secondary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 items-center pt-3 border-t border-[var(--border-default)]">
          <button
            onClick={handleAskSimilar}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] font-medium text-sm sm:text-base"
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
      </div>
    </section>
  );
}

export default ExampleConsultation;

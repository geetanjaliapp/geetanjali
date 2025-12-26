import { useState } from "react";
import { trackEvent } from "../lib/experiment";

interface ExampleQuestionsProps {
  onSelect: (question: string) => void;
}

// Curated pool of 8 example questions across categories
const EXAMPLE_QUESTIONS = [
  // Career
  "My boss asked me to take credit for a colleague's work. What should I do?",
  "Should I leave a stable job to pursue something I'm passionate about?",
  // Relationships
  "How do I set boundaries with family without hurting them?",
  "A close friend betrayed my trust. Should I forgive them?",
  // Ethics
  "I discovered my company is doing something unethical. Should I speak up?",
  "Is it okay to lie to protect someone's feelings?",
  // Leadership
  "How do I balance being fair to my team while meeting business demands?",
  "I need to deliver bad news to my team. What's the right approach?",
];

/**
 * Shuffle array and return first N items
 */
function getRandomSample<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Example Questions component
 * Shows 3 randomly selected questions from a curated pool.
 * Clicking a question prefills the main question field.
 */
export function ExampleQuestions({ onSelect }: ExampleQuestionsProps) {
  // Select 3 random questions on mount (stable for component lifetime)
  const [displayQuestions] = useState(() =>
    getRandomSample(EXAMPLE_QUESTIONS, 3),
  );

  const handleSelect = (question: string, idx: number) => {
    trackEvent("newcase", "example_question_click", { question_index: idx });
    onSelect(question);
  };

  return (
    <div className="mb-4">
      <p className="text-xs text-[var(--text-tertiary)] mb-2">
        Need inspiration? Try one:
      </p>
      <div className="flex flex-wrap gap-2">
        {displayQuestions.map((question, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelect(question, idx)}
            className="text-left text-xs px-3 py-1.5 bg-[var(--surface-warm)] hover:bg-[var(--interactive-ghost-hover-bg)] text-[var(--badge-warm-text)] rounded-[var(--radius-chip)] border border-[var(--border-warm)] transition-[var(--transition-color)] max-w-full sm:max-w-none"
            title={question}
          >
            {/* Show more on desktop, truncate only on mobile */}
            <span className="sm:hidden">
              {question.length > 40 ? question.slice(0, 37) + "..." : question}
            </span>
            <span className="hidden sm:inline">{question}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ExampleQuestions;

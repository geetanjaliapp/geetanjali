import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDownIcon } from "../../components/icons";

interface ReflectPromptProps {
  canonicalId: string;
  verseParaphrase?: string | null;
  verseTranslation?: string | null;
}

/**
 * Collapsible reflection prompt on verse detail pages.
 *
 * Two-step flow (Maya-approved, Linus-simple):
 * 1. User expands "Reflect" → sees textarea "How does this speak to your life?"
 * 2. After typing ≥20 chars → "Get guided perspective →" button appears
 *    Navigates to /cases/new?verse={canonicalId} with reflection in location.state
 *
 * Reflection text flows into the consultation description ("Regarding verse BG_X_Y:
 * [reflection]"). No API call. No server storage. Pure frontend state.
 * Tradeoff: location.state lost on browser reload — acceptable (reflect is ephemeral).
 */
export default function ReflectPrompt({
  canonicalId,
  verseParaphrase,
}: ReflectPromptProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [reflection, setReflection] = useState("");

  const charCount = reflection.length;
  const showConsultButton = charCount >= 20;
  const isOverLimit = charCount > 500;

  const handleNavigate = () => {
    const trimmed = reflection.slice(0, 500).trim();
    navigate(`/cases/new?verse=${canonicalId}`, {
      state: { reflect: trimmed || undefined },
    });
  };

  return (
    <div className="bg-[var(--surface-elevated-translucent-subtle)] backdrop-blur-xs rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-4 sm:p-6 lg:p-8 border border-[var(--border-warm-subtle)] mb-4 sm:mb-6 lg:mb-8">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex-1 flex items-center justify-between text-left w-full group"
        aria-expanded={isExpanded}
      >
        <span className="text-xs font-semibold text-[var(--text-accent-muted)] uppercase tracking-widest">
          Reflect
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-all duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Collapsible content */}
      <div
        className={`transition-all duration-200 overflow-hidden ${
          isExpanded ? "max-h-[500px] opacity-100 mt-3 sm:mt-4" : "max-h-0 opacity-0"
        }`}
      >
        {verseParaphrase && (
          <p className="text-sm text-[var(--text-secondary)] italic mb-3 line-clamp-3">
            "{verseParaphrase}"
          </p>
        )}
        <label
          htmlFor={`reflect-${canonicalId}`}
          className="block text-sm text-[var(--text-secondary)] mb-2"
        >
          How does this speak to your life?
        </label>
        <textarea
          id={`reflect-${canonicalId}`}
          value={reflection}
          onChange={(e) => {
            if (e.target.value.length <= 500) {
              setReflection(e.target.value);
            }
          }}
          placeholder="This verse reminds me of..."
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--surface-primary)] border border-[var(--border-warm-subtle)] rounded-[var(--radius-chip)] resize-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 transition-[var(--transition-color)] placeholder:text-[var(--text-muted)]"
          aria-describedby={`reflect-hint-${canonicalId}`}
        />

        {/* Character counter + hint */}
        <div className="flex items-center justify-between mt-1.5">
          <span
            id={`reflect-hint-${canonicalId}`}
            className="text-xs text-[var(--text-muted)]"
          >
            Your reflection helps personalize AI guidance
          </span>
          <span
            className={`text-xs tabular-nums ${
              isOverLimit
                ? "text-red-500 font-medium"
                : charCount > 400
                  ? "text-[var(--text-accent)]"
                  : "text-[var(--text-muted)]"
            }`}
          >
            {charCount}/500
          </span>
        </div>

        {/* Consultation CTA — appears after ≥20 chars */}
        {showConsultButton && (
          <button
            onClick={handleNavigate}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] bg-[var(--accent)] rounded-[var(--radius-chip)] shadow-[var(--shadow-button)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-card)] active:bg-[var(--accent-active)] transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <span>Get guided perspective</span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}

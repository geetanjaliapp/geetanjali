import { SpeakButton } from "../SpeakButton";

interface PathOption {
  title: string;
  pros: string[];
  cons: string[];
}

interface PathsSectionProps {
  options: PathOption[];
  selectedOption: number;
  showPaths: boolean;
  onToggle: () => void;
  onSelectOption: (index: number) => void;
}

/**
 * Format path option for TTS
 */
function formatPathForSpeech(option: PathOption, index: number): string {
  let text = `Paths Before You. Path ${index + 1}: ${option.title}. `;
  if (option.pros.length > 0) {
    text += `Benefits: ${option.pros.join(". ")}. `;
  }
  if (option.cons.length > 0) {
    text += `Considerations: ${option.cons.join(". ")}.`;
  }
  return text;
}

export function PathsSection({
  options,
  selectedOption,
  showPaths,
  onToggle,
  onSelectOption,
}: PathsSectionProps) {
  if (options.length === 0) return null;

  return (
    <div className="relative pl-8 sm:pl-10 pb-3 sm:pb-4">
      <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-[var(--radius-avatar)] bg-[var(--badge-warm-bg)] border-2 border-[var(--border-accent)] flex items-center justify-center">
        <svg
          className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--text-accent)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      </div>

      <button
        onClick={onToggle}
        className="w-full text-left rounded-[var(--radius-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
      >
        <div className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-[var(--radius-card)] p-3 sm:p-4 shadow-[var(--shadow-button)] border border-[var(--border-warm)] hover:shadow-[var(--shadow-card)] transition-[var(--transition-all)]">
          <div>
            <div className="text-xs font-semibold text-[var(--badge-warm-text)] uppercase tracking-wide">
              Paths Before You
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 sm:mt-1">
              {options.length} approaches to consider
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${showPaths ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {showPaths && (
        <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
          {/* Path selector - horizontal scroll on mobile, grid on larger screens */}
          <div className="flex sm:grid sm:grid-cols-3 gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectOption(idx)}
                className={`shrink-0 w-28 sm:w-auto p-2.5 sm:p-3 rounded-[var(--radius-card)] border-2 text-left transition-[var(--transition-all)] h-full ${
                  selectedOption === idx
                    ? "bg-[var(--surface-warm)] border-[var(--border-accent)] shadow-[var(--shadow-card)]"
                    : "bg-[var(--surface-elevated)] border-[var(--border-default)] hover:border-[var(--border-warm)]"
                }`}
              >
                <div
                  className={`text-xs font-semibold ${selectedOption === idx ? "text-[var(--badge-warm-text)]" : "text-[var(--text-tertiary)]"}`}
                >
                  Path {idx + 1}
                </div>
                <div
                  className={`text-sm font-medium mt-0.5 sm:mt-1 leading-snug line-clamp-2 ${selectedOption === idx ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                >
                  {opt.title.replace(" Approach", "")}
                </div>
              </button>
            ))}
          </div>

          {/* Selected path details */}
          <div className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-button)] p-3 sm:p-4 border border-[var(--border-warm)]">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-[var(--text-primary)] text-sm sm:text-base">
                {options[selectedOption].title}
              </h4>
              <SpeakButton
                text={formatPathForSpeech(
                  options[selectedOption],
                  selectedOption,
                )}
                size="sm"
                aria-label="Listen to this path"
              />
            </div>
            {/* Stack on mobile, side-by-side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
              <div>
                <div className="text-xs font-semibold text-[var(--status-success-text)] mb-1">
                  Benefits
                </div>
                {options[selectedOption].pros.map((pro, i) => (
                  <div
                    key={i}
                    className="text-sm sm:text-base text-[var(--text-secondary)] flex items-start gap-1 mb-0.5"
                  >
                    <span className="text-[var(--status-success-text)] mt-0.5 text-xs shrink-0">
                      +
                    </span>
                    <span>{pro}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--status-warning-text)] mb-1">
                  Consider
                </div>
                {options[selectedOption].cons.map((con, i) => (
                  <div
                    key={i}
                    className="text-sm sm:text-base text-[var(--text-secondary)] flex items-start gap-1 mb-0.5"
                  >
                    <span className="text-[var(--status-warning-text)] mt-0.5 text-xs shrink-0">
                      -
                    </span>
                    <span>{con}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

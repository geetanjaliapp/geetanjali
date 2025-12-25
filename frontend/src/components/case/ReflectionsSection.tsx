interface ReflectionsSectionProps {
  prompts: string[];
  showReflections: boolean;
  onToggle: () => void;
}

export function ReflectionsSection({
  prompts,
  showReflections,
  onToggle,
}: ReflectionsSectionProps) {
  if (prompts.length === 0) return null;

  return (
    <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
      <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--status-info-bg)] border-2 border-[var(--status-info-border)] flex items-center justify-center">
        <svg
          className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--status-info-text)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </div>

      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between bg-[var(--status-info-bg)] rounded-xl p-3 sm:p-4 shadow-xs border border-[var(--status-info-border)] hover:shadow-md transition-shadow">
          <div>
            <div className="text-xs font-semibold text-[var(--status-info-text)] uppercase tracking-wide">
              Questions for Reflection
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 sm:mt-1">
              {prompts.length} prompts for deeper insight
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${showReflections ? "rotate-180" : ""}`}
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

      {showReflections && (
        <div className="mt-2 sm:mt-3 bg-[var(--status-info-bg)] rounded-xl p-3 sm:p-4 border border-[var(--status-info-border)]">
          <ul className="space-y-2.5 sm:space-y-3">
            {prompts.map((prompt, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[var(--text-secondary)]"
              >
                <span className="text-[var(--status-info-text)] mt-0.5 text-xs sm:text-sm">
                  ◆
                </span>
                <span className="text-sm sm:text-base italic">{prompt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

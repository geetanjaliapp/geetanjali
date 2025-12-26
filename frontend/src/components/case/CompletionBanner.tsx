interface CompletionBannerProps {
  isPolicyViolation: boolean;
  onDismiss: () => void;
}

/**
 * Banner shown when analysis completes.
 * Green for success, amber for policy violations.
 */
export function CompletionBanner({
  isPolicyViolation,
  onDismiss,
}: CompletionBannerProps) {
  return (
    <div
      className={`mb-6 rounded-[var(--radius-card)] px-4 py-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-300 ${
        isPolicyViolation
          ? "bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)]"
          : "bg-[var(--status-success-bg)] border border-[var(--status-success-border)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-[var(--radius-avatar)] flex items-center justify-center ${
            isPolicyViolation ? "bg-[var(--status-warning-text)]" : "bg-[var(--status-success-text)]"
          }`}
        >
          {isPolicyViolation ? (
            <svg
              className="w-5 h-5 text-[var(--text-inverted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-[var(--text-inverted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
        <div>
          <p
            className={
              isPolicyViolation
                ? "text-[var(--status-warning-text)] font-medium"
                : "text-[var(--status-success-text)] font-medium"
            }
          >
            {isPolicyViolation ? "Unable to Provide Guidance" : "Analysis Complete"}
          </p>
          <p
            className={
              isPolicyViolation
                ? "text-[var(--status-warning-text)] text-sm"
                : "text-[var(--status-success-text)] text-sm"
            }
          >
            {isPolicyViolation
              ? "See suggestions below for rephrasing your question"
              : "Your guidance is ready below"}
          </p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className={`rounded focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
          isPolicyViolation
            ? "text-[var(--status-warning-text)] hover:text-[var(--status-warning-text)] focus-visible:ring-[var(--border-focus)]"
            : "text-[var(--status-success-text)] hover:text-[var(--status-success-text)] focus-visible:ring-[var(--border-focus)]"
        }`}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

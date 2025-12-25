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
      className={`mb-6 rounded-xl px-4 py-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-300 ${
        isPolicyViolation
          ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800"
          : "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isPolicyViolation ? "bg-amber-500" : "bg-green-500"
          }`}
        >
          {isPolicyViolation ? (
            <svg
              className="w-5 h-5 text-white"
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
              className="w-5 h-5 text-white"
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
                ? "text-amber-800 dark:text-amber-300 font-medium"
                : "text-green-800 dark:text-green-300 font-medium"
            }
          >
            {isPolicyViolation ? "Unable to Provide Guidance" : "Analysis Complete"}
          </p>
          <p
            className={
              isPolicyViolation
                ? "text-amber-600 dark:text-amber-400 text-sm"
                : "text-green-600 dark:text-green-400 text-sm"
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
        className={`rounded focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
          isPolicyViolation
            ? "text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 focus-visible:ring-amber-500"
            : "text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 focus-visible:ring-green-500"
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

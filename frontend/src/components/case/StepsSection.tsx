interface StepsSectionProps {
  steps: string[];
  showSteps: boolean;
  onToggle: () => void;
}

export function StepsSection({
  steps,
  showSteps,
  onToggle,
}: StepsSectionProps) {
  if (steps.length === 0) return null;

  return (
    <div className="relative pl-8 sm:pl-10 pb-3 sm:pb-4">
      <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-green-100 dark:bg-green-900/40 border-2 border-green-300 dark:border-green-700 flex items-center justify-center">
        <svg
          className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-xs border border-green-100 dark:border-green-900 hover:shadow-md transition-shadow">
          <div>
            <div className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
              Recommended Steps
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">
              {steps.length} actionable steps
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${showSteps ? "rotate-180" : ""}`}
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

      {showSteps && (
        <div className="mt-2 sm:mt-3 bg-white dark:bg-gray-800 rounded-xl shadow-xs p-3 sm:p-4 border border-green-100 dark:border-green-900">
          <div className="space-y-2.5 sm:space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 sm:gap-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0 text-xs font-medium">
                  {idx + 1}
                </div>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 pt-0.5">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

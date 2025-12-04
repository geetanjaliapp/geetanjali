interface StepsSectionProps {
  steps: string[];
  showSteps: boolean;
  onToggle: () => void;
}

export function StepsSection({ steps, showSteps, onToggle }: StepsSectionProps) {
  if (steps.length === 0) return null;

  return (
    <div className="relative pl-10 pb-4">
      <div className="absolute left-0 w-7 h-7 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-green-100 hover:shadow-md transition-shadow">
          <div>
            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Recommended Steps
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {steps.length} actionable steps
            </p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${showSteps ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {showSteps && (
        <div className="mt-3 bg-white rounded-xl shadow-sm p-4 border border-green-100">
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                  {idx + 1}
                </div>
                <p className="text-sm text-gray-700 pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

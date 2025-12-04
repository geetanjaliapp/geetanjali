interface ReflectionsSectionProps {
  prompts: string[];
  showReflections: boolean;
  onToggle: () => void;
}

export function ReflectionsSection({ prompts, showReflections, onToggle }: ReflectionsSectionProps) {
  if (prompts.length === 0) return null;

  return (
    <div className="relative pl-10 pb-6">
      <div className="absolute left-0 w-7 h-7 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>

      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 shadow-sm border border-purple-100 hover:shadow-md transition-shadow">
          <div>
            <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
              Questions for Reflection
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {prompts.length} prompts for deeper insight
            </p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${showReflections ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {showReflections && (
        <div className="mt-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
          <ul className="space-y-3">
            {prompts.map((prompt, idx) => (
              <li key={idx} className="flex items-start gap-2 text-gray-700">
                <span className="text-purple-400 mt-1">◆</span>
                <span className="text-sm italic">{prompt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

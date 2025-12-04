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

export function PathsSection({
  options,
  selectedOption,
  showPaths,
  onToggle,
  onSelectOption,
}: PathsSectionProps) {
  if (options.length === 0) return null;

  return (
    <div className="relative pl-10 pb-4">
      <div className="absolute left-0 w-7 h-7 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>

      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-red-100 hover:shadow-md transition-shadow">
          <div>
            <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">
              Paths Before You
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {options.length} approaches to consider
            </p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${showPaths ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {showPaths && (
        <div className="mt-3 space-y-3">
          {/* Path selector cards - equal width and height */}
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectOption(idx)}
                className={`p-3 rounded-xl border-2 text-left transition-all h-full ${
                  selectedOption === idx
                    ? 'bg-red-50 border-red-400 shadow-md'
                    : 'bg-white border-gray-200 hover:border-red-200'
                }`}
              >
                <div className={`text-xs font-semibold ${selectedOption === idx ? 'text-red-700' : 'text-gray-500'}`}>
                  Path {idx + 1}
                </div>
                <div className={`text-sm font-medium mt-1 leading-snug ${selectedOption === idx ? 'text-red-900' : 'text-gray-700'}`}>
                  {opt.title.replace(' Approach', '')}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-red-100">
            <h4 className="font-semibold text-gray-900">
              {options[selectedOption].title}
            </h4>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-xs font-semibold text-green-700 mb-1">Benefits</div>
                {options[selectedOption].pros.map((pro, i) => (
                  <div key={i} className="text-sm text-gray-700 flex items-start gap-1 mb-0.5">
                    <span className="text-green-500 mt-0.5 text-xs">+</span> {pro}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-amber-700 mb-1">Consider</div>
                {options[selectedOption].cons.map((con, i) => (
                  <div key={i} className="text-sm text-gray-700 flex items-start gap-1 mb-0.5">
                    <span className="text-amber-500 mt-0.5 text-xs">-</span> {con}
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

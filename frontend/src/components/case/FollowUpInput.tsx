import type { FormEvent } from 'react';

interface FollowUpInputProps {
  value: string;
  submitting: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function FollowUpInput({ value, submitting, disabled = false, onChange, onSubmit }: FollowUpInputProps) {
  const isDisabled = submitting || disabled;

  return (
    <div className={`mt-4 bg-white rounded-xl shadow-md p-3 sm:p-4 transition-opacity ${disabled ? 'opacity-75' : ''}`}>
      {/* Processing indicator */}
      {disabled && (
        <div className="flex items-center gap-2 mb-3 text-orange-600">
          <div className="flex space-x-1">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm font-medium">Analyzing your follow-up...</span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="flex items-center gap-2 sm:gap-3">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={disabled ? "Please wait..." : "Ask a follow-up question..."}
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
              disabled ? 'border-orange-200 bg-orange-50/50' : 'border-gray-200'
            }`}
            disabled={isDisabled}
          />
          <button
            type="submit"
            disabled={!value.trim() || isDisabled}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-colors ${
              disabled
                ? 'bg-orange-200 text-orange-700 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
            }`}
          >
            <span className="hidden sm:inline">
              {submitting ? 'Sending...' : disabled ? 'Analyzing...' : 'Ask'}
            </span>
            <svg className={`w-4 h-4 sm:hidden ${disabled ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

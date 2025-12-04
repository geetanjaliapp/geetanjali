import type { Output } from '../../types';

interface OutputFeedbackProps {
  output: Output;
  feedback: 'up' | 'down' | null;
  feedbackLoading: string | null;
  expandedFeedback: string | null;
  feedbackText: Record<string, string>;
  onFeedback: (outputId: string, type: 'up' | 'down') => void;
  onSubmitNegativeFeedback: (outputId: string) => void;
  onCancelFeedback: (outputId: string) => void;
  onFeedbackTextChange: (outputId: string, text: string) => void;
}

export function OutputFeedback({
  output,
  feedback,
  feedbackLoading,
  expandedFeedback,
  feedbackText,
  onFeedback,
  onSubmitNegativeFeedback,
  onCancelFeedback,
  onFeedbackTextChange,
}: OutputFeedbackProps) {
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Confidence:</span>
          <div className="w-12 bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${
                output.confidence >= 0.8 ? 'bg-green-500' :
                output.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${output.confidence * 100}%` }}
            />
          </div>
          <span className="font-medium">{(output.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFeedback(output.id, 'up')}
            disabled={feedbackLoading === output.id}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              feedback === 'up'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>
          <button
            onClick={() => onFeedback(output.id, 'down')}
            disabled={feedbackLoading === output.id}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              feedback === 'down' || expandedFeedback === output.id
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded feedback text input */}
      {expandedFeedback === output.id && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
          <p className="text-xs text-gray-600 mb-2">What could be improved? (optional)</p>
          <textarea
            value={feedbackText[output.id] || ''}
            onChange={(e) => onFeedbackTextChange(output.id, e.target.value.slice(0, 280))}
            placeholder="Tell us what wasn't helpful..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            rows={2}
            maxLength={280}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {(feedbackText[output.id] || '').length}/280
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onCancelFeedback(output.id)}
                disabled={feedbackLoading === output.id}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onSubmitNegativeFeedback(output.id)}
                disabled={feedbackLoading === output.id}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {feedbackLoading === output.id ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

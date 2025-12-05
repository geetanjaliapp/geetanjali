import { Link } from 'react-router-dom';
import type { Case, Message, Output } from '../../types';
import { OutputFeedback } from './OutputFeedback';

interface CaseExchangeProps {
  userMessage: Message;
  assistantMessage: Message;
  output: Output | undefined;
  caseData: Case;
  isFirst: boolean;
  expandedSources: Set<string>;
  feedbackGiven: Record<string, 'up' | 'down' | null>;
  feedbackLoading: string | null;
  expandedFeedback: string | null;
  feedbackText: Record<string, string>;
  onToggleSources: (outputId: string) => void;
  onFeedback: (outputId: string, type: 'up' | 'down') => void;
  onSubmitNegativeFeedback: (outputId: string) => void;
  onCancelFeedback: (outputId: string) => void;
  onFeedbackTextChange: (outputId: string, text: string) => void;
}

/**
 * Renders a single question-answer exchange in the case timeline
 * Includes styling, feedback buttons, and source expansion
 */
export function CaseExchange({
  userMessage,
  assistantMessage,
  output,
  caseData,
  isFirst,
  expandedSources,
  feedbackGiven,
  feedbackLoading,
  expandedFeedback,
  feedbackText,
  onToggleSources,
  onFeedback,
  onSubmitNegativeFeedback,
  onCancelFeedback,
  onFeedbackTextChange,
}: CaseExchangeProps) {
  const isSourcesExpanded = output ? expandedSources.has(output.id) : false;
  const feedback = output ? feedbackGiven[output.id] : null;

  return (
    <div>
      {/* Question */}
      <div className="relative pl-10 pb-4">
        <div
          className={`absolute left-0 w-7 h-7 rounded-full flex items-center justify-center ${
            isFirst ? 'bg-amber-500 text-white' : 'bg-blue-100 border-2 border-blue-400'
          }`}
        >
          {isFirst ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <span className="text-xs text-blue-700">+</span>
          )}
        </div>
        <div
          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
            isFirst ? 'text-amber-700' : 'text-blue-600'
          }`}
        >
          {isFirst ? 'Your Question' : 'Follow-up'}
        </div>
        <div
          className={`rounded-xl p-4 ${
            isFirst ? 'bg-white shadow-lg border-2 border-amber-200' : 'bg-blue-50 border border-blue-100'
          }`}
        >
          <p className={`leading-relaxed whitespace-pre-wrap ${isFirst ? 'text-gray-900 text-base' : 'text-gray-700 text-sm'}`}>
            {userMessage.content}
          </p>
          {isFirst && (caseData.stakeholders.length > 1 || caseData.stakeholders[0] !== 'self' || caseData.constraints.length > 0 || caseData.role !== 'Individual') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {caseData.role !== 'Individual' && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                  {caseData.role}
                </span>
              )}
              {caseData.stakeholders.filter(s => s !== 'self').map((s, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Response */}
      <div className="relative pl-10 pb-6">
        <div
          className={`absolute left-0 w-7 h-7 rounded-full flex items-center justify-center ${
            isFirst ? 'bg-orange-500 text-white' : 'bg-orange-100 border-2 border-orange-300'
          }`}
        >
          {isFirst ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          ) : (
            <span className="text-xs text-orange-600">~</span>
          )}
        </div>
        <div
          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
            isFirst ? 'text-orange-700' : 'text-orange-600'
          }`}
        >
          {isFirst ? 'Wisdom from the Gita' : 'Guidance'}
        </div>

        <div
          className={`rounded-xl p-4 border ${
            isFirst ? 'bg-white shadow-lg border-orange-200' : 'bg-white shadow-md border-orange-100'
          }`}
        >
          <p className={`leading-relaxed whitespace-pre-wrap ${isFirst ? 'text-gray-900' : 'text-gray-800 text-sm'}`}>
            {assistantMessage.content}
          </p>

          {/* Scholar flag */}
          {output?.scholar_flag && (
            <div className="mt-3 flex items-center gap-2 text-yellow-700 text-sm bg-yellow-50 px-3 py-2 rounded-lg">
              <span>⚠️</span>
              <span>Low confidence - consider seeking expert guidance</span>
            </div>
          )}

          {/* Verse Sources */}
          {output && output.result_json.sources?.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => onToggleSources(output.id)}
                className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isSourcesExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {output.result_json.sources.length} verse reference{output.result_json.sources.length > 1 ? 's' : ''}
              </button>

              {isSourcesExpanded && (
                <div className="mt-3 space-y-2">
                  {output.result_json.sources.map((source) => (
                    <div key={source.canonical_id} className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-100">
                      <div className="flex items-center justify-between">
                        <Link to={`/verses/${source.canonical_id}`} className="font-mono text-orange-700 font-semibold text-sm hover:underline">
                          {source.canonical_id.replace(/_/g, ' ')}
                        </Link>
                      </div>
                      <p className="mt-1.5 text-gray-700 italic text-sm">"{source.paraphrase}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback row */}
          {output && (
            <OutputFeedback
              output={output}
              feedback={feedback}
              feedbackLoading={feedbackLoading}
              expandedFeedback={expandedFeedback}
              feedbackText={feedbackText}
              onFeedback={onFeedback}
              onSubmitNegativeFeedback={onSubmitNegativeFeedback}
              onCancelFeedback={onCancelFeedback}
              onFeedbackTextChange={onFeedbackTextChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default CaseExchange;

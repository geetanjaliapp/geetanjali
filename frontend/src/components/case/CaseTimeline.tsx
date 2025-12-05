import type { Case, Message, Output } from '../../types';
import { CaseExchange } from './CaseExchange';

interface MessageExchange {
  user: Message;
  assistant: Message;
  output?: Output;
}

interface CaseTimelineProps {
  exchanges: MessageExchange[];
  caseData: Case;
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
 * Renders the complete case timeline with vertical line and exchanges
 * Handles styling, spacing, and exchange rendering
 */
export function CaseTimeline({
  exchanges,
  caseData,
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
}: CaseTimelineProps) {
  return (
    <div className="relative">
      {/* Vertical Line */}
      <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gradient-to-b from-amber-300 via-orange-300 to-red-300" />

      {/* Exchanges */}
      {exchanges.map((exchange, exchangeIdx) => (
        <div key={exchange.user.id}>
          <CaseExchange
            userMessage={exchange.user}
            assistantMessage={exchange.assistant}
            output={exchange.output}
            caseData={caseData}
            isFirst={exchangeIdx === 0}
            expandedSources={expandedSources}
            feedbackGiven={feedbackGiven}
            feedbackLoading={feedbackLoading}
            expandedFeedback={expandedFeedback}
            feedbackText={feedbackText}
            onToggleSources={onToggleSources}
            onFeedback={onFeedback}
            onSubmitNegativeFeedback={onSubmitNegativeFeedback}
            onCancelFeedback={onCancelFeedback}
            onFeedbackTextChange={onFeedbackTextChange}
          />
        </div>
      ))}
    </div>
  );
}

export default CaseTimeline;

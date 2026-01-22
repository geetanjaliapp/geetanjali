import { memo } from "react";
import type { Output } from "../../types";

interface OutputFeedbackProps {
  output: Output;
  feedback: "up" | "down" | null;
  feedbackLoading: string | null;
  expandedFeedback: string | null;
  savedComment: Record<string, string>; // Persisted comment for display
  feedbackText: Record<string, string>; // Draft text for editing
  onFeedback: (outputId: string, type: "up" | "down") => void;
  onEditFeedback: (outputId: string) => void;
  onSubmitNegativeFeedback: (outputId: string) => void;
  onCancelFeedback: (outputId: string) => void;
  onFeedbackTextChange: (outputId: string, text: string) => void;
}

/**
 * Feedback component for consultation outputs.
 * Shows thumbs up/down buttons, handles feedback submission,
 * and displays existing feedback with edit capability.
 */
export const OutputFeedback = memo(
  function OutputFeedback({
    output,
    feedback,
    feedbackLoading,
    expandedFeedback,
    savedComment,
    feedbackText,
    onFeedback,
    onEditFeedback,
    onSubmitNegativeFeedback,
    onCancelFeedback,
    onFeedbackTextChange,
  }: OutputFeedbackProps) {
    const isExpanded = expandedFeedback === output.id;
    const hasExistingComment = feedback === "down" && savedComment[output.id];

    // Validate confidence reason: must be non-empty string with actual content
    const hasValidConfidenceReason =
      output.confidence_reason &&
      typeof output.confidence_reason === "string" &&
      output.confidence_reason.trim().length > 0;

    return (
      <div className="mt-4 pt-3 border-t border-[var(--border-default)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <span>Confidence:</span>
            <div className="w-12 bg-[var(--surface-muted)] rounded-[var(--radius-progress)] h-1.5">
              <div
                className={`h-1.5 rounded-[var(--radius-progress)] ${
                  output.confidence >= 0.8
                    ? "bg-[var(--status-success-text)]"
                    : output.confidence >= 0.6
                      ? "bg-[var(--status-warning-text)]"
                      : "bg-[var(--status-error-text)]"
                }`}
                style={{ width: `${output.confidence * 100}%` }}
              />
            </div>
            <span className="font-medium">
              {(output.confidence * 100).toFixed(0)}%
            </span>
            {/* Subtle info icon for confidence reason tooltip */}
            {hasValidConfidenceReason && output.confidence_reason && (
              <div className="group relative">
                <button
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  title={output.confidence_reason}
                  aria-label="Confidence explanation"
                >
                  <svg
                    className="w-3.5 h-3.5"
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
                </button>
                {/* CSS-based tooltip with content validation */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-[var(--surface-secondary)] text-[var(--text-primary)] text-xs rounded-[var(--radius-button)] px-3 py-2 max-w-xs shadow-lg border border-[var(--border-subtle)] whitespace-normal break-words">
                    {output.confidence_reason}
                  </div>
                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[var(--surface-secondary)]" />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onFeedback(output.id, "up")}
              disabled={feedbackLoading === output.id}
              aria-label={
                feedback === "up" ? "Feedback: helpful" : "Mark as helpful"
              }
              className={`w-10 h-10 sm:w-8 sm:h-8 rounded-[var(--radius-avatar)] flex items-center justify-center transition-[var(--transition-color)] ${
                feedback === "up" && !isExpanded
                  ? "bg-[var(--status-success-text)] text-[var(--text-inverted)]"
                  : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--status-success-bg)] hover:text-[var(--status-success-text)]"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                />
              </svg>
            </button>
            <button
              onClick={() => onFeedback(output.id, "down")}
              disabled={feedbackLoading === output.id}
              aria-label={
                feedback === "down"
                  ? "Feedback: needs improvement"
                  : "Mark as needs improvement"
              }
              className={`w-10 h-10 sm:w-8 sm:h-8 rounded-[var(--radius-avatar)] flex items-center justify-center transition-[var(--transition-color)] ${
                feedback === "down" || isExpanded
                  ? "bg-[var(--status-error-text)] text-[var(--text-inverted)]"
                  : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error-text)]"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Show existing comment in read-only mode when not editing */}
        {hasExistingComment && !isExpanded && (
          <div className="mt-3 p-2.5 bg-[var(--status-error-bg)] rounded-[var(--radius-button)] border border-[var(--status-error-border)]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--text-secondary)] italic flex-1">
                "{savedComment[output.id]}"
              </p>
              <button
                onClick={() => onEditFeedback(output.id)}
                className="text-xs text-[var(--status-error-text)] hover:text-[var(--status-error-text)] whitespace-nowrap"
              >
                Edit
              </button>
            </div>
          </div>
        )}

        {/* Expanded feedback form for new/editing comment */}
        {isExpanded && (
          <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              {savedComment[output.id]
                ? "Edit your feedback:"
                : "What could be improved? (optional)"}
            </p>
            <textarea
              value={feedbackText[output.id] || ""}
              onChange={(e) => onFeedbackTextChange(output.id, e.target.value)}
              placeholder="Tell us what wasn't helpful..."
              className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] hover:border-[var(--input-border-hover)] rounded-[var(--radius-button)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent resize-none placeholder:text-[var(--input-text-placeholder)]"
              rows={2}
              maxLength={1000}
            />
            <div className="flex justify-end mt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => onCancelFeedback(output.id)}
                  disabled={feedbackLoading === output.id}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSubmitNegativeFeedback(output.id)}
                  disabled={feedbackLoading === output.id}
                  className="px-3 py-1.5 text-xs bg-[var(--status-error-text)] text-[var(--text-inverted)] rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50"
                >
                  {feedbackLoading === output.id
                    ? "Saving..."
                    : savedComment[output.id]
                      ? "Update"
                      : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
  // Custom comparison to prevent re-renders from unrelated state changes
  (prev, next) => {
    return (
      prev.output.id === next.output.id &&
      prev.output.confidence === next.output.confidence &&
      prev.output.confidence_reason === next.output.confidence_reason &&
      prev.feedback === next.feedback &&
      prev.feedbackLoading === next.feedbackLoading &&
      prev.expandedFeedback === next.expandedFeedback &&
      prev.savedComment[prev.output.id] === next.savedComment[next.output.id] &&
      prev.feedbackText[prev.output.id] === next.feedbackText[next.output.id]
    );
  },
);

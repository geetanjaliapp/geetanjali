import { memo } from "react";
import type { Output } from "../../types";

interface OutputFeedbackProps {
  output: Output;
  feedback: "up" | "down" | null;
  feedbackLoading: string | null;
  expandedFeedback: string | null;
  feedbackText: Record<string, string>;
  onFeedback: (outputId: string, type: "up" | "down") => void;
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
    feedbackText,
    onFeedback,
    onSubmitNegativeFeedback,
    onCancelFeedback,
    onFeedbackTextChange,
  }: OutputFeedbackProps) {
    const isExpanded = expandedFeedback === output.id;
    const hasExistingComment = feedback === "down" && feedbackText[output.id];
    const isEditing = isExpanded;

    return (
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Confidence:</span>
            <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  output.confidence >= 0.8
                    ? "bg-green-500"
                    : output.confidence >= 0.6
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${output.confidence * 100}%` }}
              />
            </div>
            <span className="font-medium">
              {(output.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onFeedback(output.id, "up")}
              disabled={feedbackLoading === output.id}
              aria-label={feedback === "up" ? "Feedback: helpful" : "Mark as helpful"}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                feedback === "up" && !isExpanded
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-green-100 dark:hover:bg-green-900/40 hover:text-green-600 dark:hover:text-green-400"
              }`}
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
                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                />
              </svg>
            </button>
            <button
              onClick={() => onFeedback(output.id, "down")}
              disabled={feedbackLoading === output.id}
              aria-label={feedback === "down" ? "Feedback: needs improvement" : "Mark as needs improvement"}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                feedback === "down" || isExpanded
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"
              }`}
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
                  d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Show existing comment in read-only mode when not editing */}
        {hasExistingComment && !isEditing && (
          <div className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/50">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 italic flex-1">
                "{feedbackText[output.id]}"
              </p>
              <button
                onClick={() => onFeedback(output.id, "down")}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 whitespace-nowrap"
              >
                Edit
              </button>
            </div>
          </div>
        )}

        {/* Expanded feedback form for editing */}
        {isEditing && (
          <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {feedback === "down"
                ? "Edit your feedback"
                : "What could be improved? (optional)"}
            </p>
            <textarea
              value={feedbackText[output.id] || ""}
              onChange={(e) => onFeedbackTextChange(output.id, e.target.value)}
              placeholder="Tell us what wasn't helpful..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              rows={2}
              maxLength={1000}
            />
            <div className="flex justify-end mt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => onCancelFeedback(output.id)}
                  disabled={feedbackLoading === output.id}
                  className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSubmitNegativeFeedback(output.id)}
                  disabled={feedbackLoading === output.id}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {feedbackLoading === output.id
                    ? "Saving..."
                    : feedback === "down"
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
      prev.feedback === next.feedback &&
      prev.feedbackLoading === next.feedbackLoading &&
      prev.expandedFeedback === next.expandedFeedback &&
      prev.feedbackText[prev.output.id] === next.feedbackText[next.output.id]
    );
  },
);

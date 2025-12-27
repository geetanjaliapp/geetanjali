import { useReducer, useCallback } from "react";
import { outputsApi } from "../lib/api";
import type { Output } from "../types";

/**
 * Feedback state structure.
 */
interface FeedbackState {
  feedbackGiven: Record<string, "up" | "down" | null>;
  feedbackLoading: string | null;
  expandedFeedback: string | null;
  feedbackText: Record<string, string>; // Draft text being edited
  savedComment: Record<string, string>; // Last persisted comment
}

/**
 * Actions for feedback state management.
 */
type FeedbackAction =
  | {
      type: "INITIALIZE";
      feedback: Record<string, "up" | "down" | null>;
      comments: Record<string, string>;
    }
  | { type: "SET_LOADING"; outputId: string | null }
  | { type: "SET_FEEDBACK"; outputId: string; value: "up" | "down" | null }
  | { type: "SET_EXPANDED"; outputId: string | null }
  | { type: "SET_TEXT"; outputId: string; text: string }
  | { type: "SAVE_COMMENT"; outputId: string; comment: string | null }
  | { type: "REMOVE"; outputId: string }
  | { type: "OPTIMISTIC_UP"; outputId: string }
  | { type: "OPTIMISTIC_DOWN"; outputId: string; comment: string | null }
  | {
      type: "ROLLBACK";
      outputId: string;
      prevFeedback: "up" | "down" | null;
      prevComment: string | null;
      reopenForm?: boolean;
    };

const initialState: FeedbackState = {
  feedbackGiven: {},
  feedbackLoading: null,
  expandedFeedback: null,
  feedbackText: {},
  savedComment: {},
};

/**
 * Pure reducer for feedback state - eliminates stale closures.
 */
function feedbackReducer(
  state: FeedbackState,
  action: FeedbackAction,
): FeedbackState {
  switch (action.type) {
    case "INITIALIZE": {
      return {
        ...state,
        feedbackGiven: { ...state.feedbackGiven, ...action.feedback },
        savedComment: { ...state.savedComment, ...action.comments },
        feedbackText: { ...state.feedbackText, ...action.comments },
      };
    }

    case "SET_LOADING": {
      return { ...state, feedbackLoading: action.outputId };
    }

    case "SET_FEEDBACK": {
      const newFeedbackGiven = { ...state.feedbackGiven };
      if (action.value === null) {
        delete newFeedbackGiven[action.outputId];
      } else {
        newFeedbackGiven[action.outputId] = action.value;
      }
      return { ...state, feedbackGiven: newFeedbackGiven };
    }

    case "SET_EXPANDED": {
      return { ...state, expandedFeedback: action.outputId };
    }

    case "SET_TEXT": {
      return {
        ...state,
        feedbackText: { ...state.feedbackText, [action.outputId]: action.text },
      };
    }

    case "SAVE_COMMENT": {
      const newSavedComment = { ...state.savedComment };
      if (action.comment === null) {
        delete newSavedComment[action.outputId];
      } else {
        newSavedComment[action.outputId] = action.comment;
      }
      return { ...state, savedComment: newSavedComment };
    }

    case "REMOVE": {
      const newFeedbackGiven = { ...state.feedbackGiven };
      const newSavedComment = { ...state.savedComment };
      const newFeedbackText = { ...state.feedbackText };
      delete newFeedbackGiven[action.outputId];
      delete newSavedComment[action.outputId];
      delete newFeedbackText[action.outputId];
      return {
        ...state,
        feedbackGiven: newFeedbackGiven,
        savedComment: newSavedComment,
        feedbackText: newFeedbackText,
        expandedFeedback: null,
      };
    }

    case "OPTIMISTIC_UP": {
      const newFeedbackGiven = {
        ...state.feedbackGiven,
        [action.outputId]: "up" as const,
      };
      const newSavedComment = { ...state.savedComment };
      const newFeedbackText = { ...state.feedbackText };
      delete newSavedComment[action.outputId];
      delete newFeedbackText[action.outputId];
      return {
        ...state,
        feedbackGiven: newFeedbackGiven,
        savedComment: newSavedComment,
        feedbackText: newFeedbackText,
        expandedFeedback: null,
      };
    }

    case "OPTIMISTIC_DOWN": {
      const newFeedbackGiven = {
        ...state.feedbackGiven,
        [action.outputId]: "down" as const,
      };
      const newSavedComment = { ...state.savedComment };
      if (action.comment) {
        newSavedComment[action.outputId] = action.comment;
      } else {
        delete newSavedComment[action.outputId];
      }
      return {
        ...state,
        feedbackGiven: newFeedbackGiven,
        savedComment: newSavedComment,
        expandedFeedback: null,
      };
    }

    case "ROLLBACK": {
      const newFeedbackGiven = { ...state.feedbackGiven };
      const newSavedComment = { ...state.savedComment };

      if (action.prevFeedback === null) {
        delete newFeedbackGiven[action.outputId];
      } else {
        newFeedbackGiven[action.outputId] = action.prevFeedback;
      }

      if (action.prevComment === null) {
        delete newSavedComment[action.outputId];
      } else {
        newSavedComment[action.outputId] = action.prevComment;
      }

      return {
        ...state,
        feedbackGiven: newFeedbackGiven,
        savedComment: newSavedComment,
        expandedFeedback: action.reopenForm
          ? action.outputId
          : state.expandedFeedback,
      };
    }

    default:
      return state;
  }
}

/**
 * Feedback state and handlers for output feedback.
 *
 * Uses useReducer pattern to eliminate stale closures in async handlers.
 *
 * Manages:
 * - Thumbs up/down state
 * - Draft vs saved comments
 * - Loading states
 * - Expanded feedback form state
 */
export function useFeedback() {
  const [state, dispatch] = useReducer(feedbackReducer, initialState);

  /**
   * Initialize feedback state from loaded outputs.
   */
  const initializeFeedback = useCallback((outputs: Output[]) => {
    const feedback: Record<string, "up" | "down" | null> = {};
    const comments: Record<string, string> = {};

    for (const output of outputs) {
      if (output.user_feedback) {
        feedback[output.id] = output.user_feedback.rating ? "up" : "down";
        if (output.user_feedback.comment) {
          comments[output.id] = output.user_feedback.comment;
        }
      }
    }

    if (Object.keys(feedback).length > 0 || Object.keys(comments).length > 0) {
      dispatch({ type: "INITIALIZE", feedback, comments });
    }
  }, []);

  /**
   * Remove feedback entirely (un-vote).
   */
  const removeFeedback = useCallback(async (outputId: string) => {
    dispatch({ type: "SET_LOADING", outputId });
    try {
      await outputsApi.deleteFeedback(outputId);
      dispatch({ type: "REMOVE", outputId });
    } catch {
      // Silent failure - state unchanged, user can retry
    } finally {
      dispatch({ type: "SET_LOADING", outputId: null });
    }
  }, []);

  /**
   * Handle thumbs up/down click.
   *
   * Behavior:
   * - Click up when none/down: Submit positive feedback immediately
   * - Click up when already up: Remove feedback (un-vote)
   * - Click down when none/up: Expand form for comment
   * - Click down when already down (form closed): Expand form to edit
   * - Click down when already down (form open): Remove feedback (un-vote)
   */
  const handleFeedback = useCallback(
    async (outputId: string, type: "up" | "down") => {
      // Read current state synchronously to avoid stale closures
      const current = state.feedbackGiven[outputId];
      const isFormOpen = state.expandedFeedback === outputId;
      const isLoading = state.feedbackLoading === outputId;

      if (isLoading) return;

      // Clicking thumbs down
      if (type === "down") {
        if (current === "down" && isFormOpen) {
          // Already down with form open - un-vote (remove feedback)
          await removeFeedback(outputId);
          return;
        }
        if (current === "down") {
          // Already down, form closed - open form to edit
          dispatch({
            type: "SET_TEXT",
            outputId,
            text: state.savedComment[outputId] || "",
          });
          dispatch({ type: "SET_EXPANDED", outputId });
          return;
        }
        // Not down yet - expand form for new negative feedback
        dispatch({ type: "SET_TEXT", outputId, text: "" });
        dispatch({ type: "SET_EXPANDED", outputId });
        return;
      }

      // Clicking thumbs up
      if (current === "up") {
        // Already up - un-vote (remove feedback)
        await removeFeedback(outputId);
        return;
      }

      // Submit positive feedback with rollback on error
      // Capture previous state synchronously before any async operations
      const prevFeedback = state.feedbackGiven[outputId] ?? null;
      const prevComment = state.savedComment[outputId] ?? null;

      dispatch({ type: "SET_LOADING", outputId });
      dispatch({ type: "OPTIMISTIC_UP", outputId });

      try {
        await outputsApi.submitFeedback(outputId, { rating: true });
        // Success - optimistic state is correct
      } catch {
        // Silent rollback - restore previous state
        dispatch({ type: "ROLLBACK", outputId, prevFeedback, prevComment });
      } finally {
        dispatch({ type: "SET_LOADING", outputId: null });
      }
    },
    [
      state.feedbackGiven,
      state.expandedFeedback,
      state.feedbackLoading,
      state.savedComment,
      removeFeedback,
    ],
  );

  /**
   * Submit negative feedback with optional comment.
   */
  const handleSubmitNegativeFeedback = useCallback(
    async (outputId: string) => {
      const isLoading = state.feedbackLoading === outputId;
      if (isLoading) return;

      // Capture previous state synchronously for rollback
      const prevFeedback = state.feedbackGiven[outputId] ?? null;
      const prevComment = state.savedComment[outputId] ?? null;
      const comment = state.feedbackText[outputId]?.trim() || null;

      dispatch({ type: "SET_LOADING", outputId });
      dispatch({ type: "OPTIMISTIC_DOWN", outputId, comment });

      try {
        await outputsApi.submitFeedback(outputId, {
          rating: false,
          comment: comment || undefined,
        });
        // Success - optimistic state is correct
      } catch {
        // Silent rollback - restore previous state and reopen form
        dispatch({
          type: "ROLLBACK",
          outputId,
          prevFeedback,
          prevComment,
          reopenForm: true,
        });
      } finally {
        dispatch({ type: "SET_LOADING", outputId: null });
      }
    },
    [
      state.feedbackLoading,
      state.feedbackGiven,
      state.savedComment,
      state.feedbackText,
    ],
  );

  /**
   * Edit existing negative feedback - just expand the form.
   */
  const handleEditFeedback = useCallback(
    (outputId: string) => {
      dispatch({
        type: "SET_TEXT",
        outputId,
        text: state.savedComment[outputId] || "",
      });
      dispatch({ type: "SET_EXPANDED", outputId });
    },
    [state.savedComment],
  );

  /**
   * Cancel feedback editing - restore to last saved state.
   */
  const handleCancelFeedback = useCallback(
    (outputId: string) => {
      dispatch({
        type: "SET_TEXT",
        outputId,
        text: state.savedComment[outputId] || "",
      });
      dispatch({ type: "SET_EXPANDED", outputId: null });
    },
    [state.savedComment],
  );

  /**
   * Update feedback text draft.
   */
  const handleFeedbackTextChange = useCallback(
    (outputId: string, text: string) => {
      dispatch({ type: "SET_TEXT", outputId, text });
    },
    [],
  );

  return {
    // State
    feedbackGiven: state.feedbackGiven,
    feedbackLoading: state.feedbackLoading,
    expandedFeedback: state.expandedFeedback,
    feedbackText: state.feedbackText,
    savedComment: state.savedComment,
    // Actions
    initializeFeedback,
    handleFeedback,
    handleSubmitNegativeFeedback,
    handleEditFeedback,
    handleCancelFeedback,
    handleFeedbackTextChange,
  };
}

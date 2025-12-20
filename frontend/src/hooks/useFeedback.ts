import { useState, useCallback } from "react";
import { outputsApi } from "../lib/api";
import type { Output } from "../types";

/**
 * Feedback state and handlers for output feedback.
 *
 * Manages:
 * - Thumbs up/down state
 * - Draft vs saved comments
 * - Loading states
 * - Expanded feedback form state
 */
export function useFeedback() {
  // Feedback state
  const [feedbackGiven, setFeedbackGiven] = useState<
    Record<string, "up" | "down" | null>
  >({});
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({}); // Draft text being edited
  const [savedComment, setSavedComment] = useState<Record<string, string>>({}); // Last persisted comment

  /**
   * Initialize feedback state from loaded outputs.
   */
  const initializeFeedback = useCallback((outputs: Output[]) => {
    const initialFeedback: Record<string, "up" | "down" | null> = {};
    const initialComments: Record<string, string> = {};

    for (const output of outputs) {
      if (output.user_feedback) {
        initialFeedback[output.id] = output.user_feedback.rating ? "up" : "down";
        if (output.user_feedback.comment) {
          initialComments[output.id] = output.user_feedback.comment;
        }
      }
    }

    if (Object.keys(initialFeedback).length > 0) {
      setFeedbackGiven((prev) => ({ ...prev, ...initialFeedback }));
    }
    if (Object.keys(initialComments).length > 0) {
      setSavedComment((prev) => ({ ...prev, ...initialComments }));
      setFeedbackText((prev) => ({ ...prev, ...initialComments }));
    }
  }, []);

  /**
   * Remove feedback entirely (un-vote).
   */
  const removeFeedback = useCallback(async (outputId: string) => {
    setFeedbackLoading(outputId);
    try {
      await outputsApi.deleteFeedback(outputId);
      setFeedbackGiven((prev) => {
        const next = { ...prev };
        delete next[outputId];
        return next;
      });
      setSavedComment((prev) => {
        const next = { ...prev };
        delete next[outputId];
        return next;
      });
      setFeedbackText((prev) => {
        const next = { ...prev };
        delete next[outputId];
        return next;
      });
      setExpandedFeedback(null);
    } catch {
      // Silent rollback - state unchanged, user can retry
    } finally {
      setFeedbackLoading(null);
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
      if (feedbackLoading === outputId) return;

      const current = feedbackGiven[outputId];
      const isFormOpen = expandedFeedback === outputId;

      // Clicking thumbs down
      if (type === "down") {
        if (current === "down" && isFormOpen) {
          // Already down with form open - un-vote (remove feedback)
          await removeFeedback(outputId);
          return;
        }
        if (current === "down") {
          // Already down, form closed - open form to edit
          setFeedbackText((prev) => ({
            ...prev,
            [outputId]: savedComment[outputId] || "",
          }));
          setExpandedFeedback(outputId);
          return;
        }
        // Not down yet - expand form for new negative feedback
        setFeedbackText((prev) => ({ ...prev, [outputId]: "" }));
        setExpandedFeedback(outputId);
        return;
      }

      // Clicking thumbs up
      if (current === "up") {
        // Already up - un-vote (remove feedback)
        await removeFeedback(outputId);
        return;
      }

      // Submit positive feedback with rollback on error
      const previousState = feedbackGiven[outputId];
      const previousComment = savedComment[outputId];

      setFeedbackLoading(outputId);
      // Optimistic update
      setFeedbackGiven((prev) => ({ ...prev, [outputId]: "up" }));
      setSavedComment((prev) => {
        const next = { ...prev };
        delete next[outputId];
        return next;
      });
      setFeedbackText((prev) => {
        const next = { ...prev };
        delete next[outputId];
        return next;
      });
      setExpandedFeedback(null);

      try {
        await outputsApi.submitFeedback(outputId, { rating: true });
        // Success - optimistic state is correct
      } catch {
        // Silent rollback - restore previous state
        setFeedbackGiven((prev) => ({
          ...prev,
          [outputId]: previousState ?? null,
        }));
        if (previousComment) {
          setSavedComment((prev) => ({ ...prev, [outputId]: previousComment }));
        }
      } finally {
        setFeedbackLoading(null);
      }
    },
    [feedbackLoading, feedbackGiven, expandedFeedback, savedComment, removeFeedback]
  );

  /**
   * Submit negative feedback with optional comment.
   */
  const handleSubmitNegativeFeedback = useCallback(
    async (outputId: string) => {
      if (feedbackLoading === outputId) return;

      // Capture previous state for rollback
      const previousState = feedbackGiven[outputId];
      const previousComment = savedComment[outputId];
      const comment = feedbackText[outputId]?.trim() || undefined;

      setFeedbackLoading(outputId);
      // Optimistic update
      setFeedbackGiven((prev) => ({ ...prev, [outputId]: "down" }));
      setSavedComment((prev) =>
        comment
          ? { ...prev, [outputId]: comment }
          : (() => {
              const next = { ...prev };
              delete next[outputId];
              return next;
            })()
      );
      setExpandedFeedback(null);

      try {
        await outputsApi.submitFeedback(outputId, { rating: false, comment });
        // Success - optimistic state is correct
      } catch {
        // Silent rollback - restore previous state
        setFeedbackGiven((prev) => ({
          ...prev,
          [outputId]: previousState ?? null,
        }));
        if (previousComment) {
          setSavedComment((prev) => ({ ...prev, [outputId]: previousComment }));
        } else {
          setSavedComment((prev) => {
            const next = { ...prev };
            delete next[outputId];
            return next;
          });
        }
        // Re-expand form so user can retry
        setExpandedFeedback(outputId);
      } finally {
        setFeedbackLoading(null);
      }
    },
    [feedbackLoading, feedbackText, feedbackGiven, savedComment]
  );

  /**
   * Edit existing negative feedback - just expand the form.
   */
  const handleEditFeedback = useCallback(
    (outputId: string) => {
      // Load saved comment into draft for editing
      setFeedbackText((prev) => ({
        ...prev,
        [outputId]: savedComment[outputId] || "",
      }));
      setExpandedFeedback(outputId);
    },
    [savedComment]
  );

  /**
   * Cancel feedback editing - restore to last saved state.
   */
  const handleCancelFeedback = useCallback(
    (outputId: string) => {
      // Restore draft to saved comment (or empty if none)
      setFeedbackText((prev) => ({
        ...prev,
        [outputId]: savedComment[outputId] || "",
      }));
      setExpandedFeedback(null);
    },
    [savedComment]
  );

  /**
   * Update feedback text draft.
   */
  const handleFeedbackTextChange = useCallback(
    (outputId: string, text: string) => {
      setFeedbackText((prev) => ({ ...prev, [outputId]: text }));
    },
    []
  );

  return {
    // State
    feedbackGiven,
    feedbackLoading,
    expandedFeedback,
    feedbackText,
    savedComment,
    // Actions
    initializeFeedback,
    handleFeedback,
    handleSubmitNegativeFeedback,
    handleEditFeedback,
    handleCancelFeedback,
    handleFeedbackTextChange,
  };
}

/**
 * Tests for useFeedback hook
 *
 * Critical paths:
 * - Initialize feedback from outputs
 * - Thumbs up: optimistic update + API call
 * - Thumbs down: expand form, submit with comment
 * - Rollback on API error
 * - Remove feedback (un-vote)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFeedback } from "./useFeedback";
import { outputsApi } from "../lib/api";
import type { Output } from "../types";

// Mock the API
vi.mock("../lib/api", () => ({
  outputsApi: {
    submitFeedback: vi.fn(),
    deleteFeedback: vi.fn(),
  },
}));

const mockSubmitFeedback = outputsApi.submitFeedback as Mock;
const mockDeleteFeedback = outputsApi.deleteFeedback as Mock;

describe("useFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitFeedback.mockResolvedValue({});
    mockDeleteFeedback.mockResolvedValue({});
  });

  describe("initial state", () => {
    it("should start with empty state", () => {
      const { result } = renderHook(() => useFeedback());

      expect(result.current.feedbackGiven).toEqual({});
      expect(result.current.feedbackLoading).toBeNull();
      expect(result.current.expandedFeedback).toBeNull();
      expect(result.current.feedbackText).toEqual({});
      expect(result.current.savedComment).toEqual({});
    });
  });

  describe("initializeFeedback", () => {
    it("should initialize feedback from outputs with user_feedback", () => {
      const { result } = renderHook(() => useFeedback());

      const outputs: Partial<Output>[] = [
        { id: "out-1", user_feedback: { rating: true, comment: undefined } },
        {
          id: "out-2",
          user_feedback: { rating: false, comment: "needs work" },
        },
        { id: "out-3", user_feedback: undefined },
      ];

      act(() => {
        result.current.initializeFeedback(outputs as Output[]);
      });

      expect(result.current.feedbackGiven["out-1"]).toBe("up");
      expect(result.current.feedbackGiven["out-2"]).toBe("down");
      expect(result.current.feedbackGiven["out-3"]).toBeUndefined();
      expect(result.current.savedComment["out-2"]).toBe("needs work");
    });

    it("should handle empty outputs array", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.initializeFeedback([]);
      });

      expect(result.current.feedbackGiven).toEqual({});
    });
  });

  describe("handleFeedback - thumbs up", () => {
    it("should submit positive feedback with optimistic update", async () => {
      const { result } = renderHook(() => useFeedback());

      await act(async () => {
        await result.current.handleFeedback("out-1", "up");
      });

      expect(result.current.feedbackGiven["out-1"]).toBe("up");
      expect(mockSubmitFeedback).toHaveBeenCalledWith("out-1", {
        rating: true,
      });
    });

    it("should rollback on API error", async () => {
      mockSubmitFeedback.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useFeedback());

      await act(async () => {
        await result.current.handleFeedback("out-1", "up");
      });

      // Should rollback to no feedback
      expect(result.current.feedbackGiven["out-1"]).toBeUndefined();
    });

    it("should remove feedback when clicking up on already-up", async () => {
      const { result } = renderHook(() => useFeedback());

      // First, set feedback to up
      await act(async () => {
        await result.current.handleFeedback("out-1", "up");
      });
      expect(result.current.feedbackGiven["out-1"]).toBe("up");

      // Click up again to remove
      await act(async () => {
        await result.current.handleFeedback("out-1", "up");
      });

      expect(mockDeleteFeedback).toHaveBeenCalledWith("out-1");
    });
  });

  describe("handleFeedback - thumbs down", () => {
    it("should expand feedback form when clicking down", async () => {
      const { result } = renderHook(() => useFeedback());

      await act(async () => {
        await result.current.handleFeedback("out-1", "down");
      });

      // Should expand form, not submit yet
      expect(result.current.expandedFeedback).toBe("out-1");
      expect(mockSubmitFeedback).not.toHaveBeenCalled();
    });

    it("should remove feedback when clicking down on already-down with form open", async () => {
      const { result } = renderHook(() => useFeedback());

      // First click expands form
      await act(async () => {
        await result.current.handleFeedback("out-1", "down");
      });
      expect(result.current.expandedFeedback).toBe("out-1");

      // Initialize as if feedback was previously given
      act(() => {
        result.current.initializeFeedback([
          {
            id: "out-1",
            user_feedback: { rating: false, comment: undefined },
          } as Output,
        ]);
      });

      // Form still open, click down again to remove
      await act(async () => {
        await result.current.handleFeedback("out-1", "down");
      });

      expect(mockDeleteFeedback).toHaveBeenCalledWith("out-1");
    });
  });

  describe("handleSubmitNegativeFeedback", () => {
    it("should submit negative feedback with comment", async () => {
      const { result } = renderHook(() => useFeedback());

      // Open form and add text
      await act(async () => {
        await result.current.handleFeedback("out-1", "down");
        result.current.handleFeedbackTextChange(
          "out-1",
          "This could be better",
        );
      });

      // Submit
      await act(async () => {
        await result.current.handleSubmitNegativeFeedback("out-1");
      });

      expect(result.current.feedbackGiven["out-1"]).toBe("down");
      expect(result.current.savedComment["out-1"]).toBe("This could be better");
      expect(mockSubmitFeedback).toHaveBeenCalledWith("out-1", {
        rating: false,
        comment: "This could be better",
      });
    });

    it("should rollback and reopen form on API error", async () => {
      mockSubmitFeedback.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useFeedback());

      // Open form
      await act(async () => {
        await result.current.handleFeedback("out-1", "down");
        result.current.handleFeedbackTextChange("out-1", "Some feedback");
      });

      // Submit (will fail)
      await act(async () => {
        await result.current.handleSubmitNegativeFeedback("out-1");
      });

      // Should rollback and reopen form
      expect(result.current.feedbackGiven["out-1"]).toBeUndefined();
      expect(result.current.expandedFeedback).toBe("out-1");
    });
  });

  describe("handleCancelFeedback", () => {
    it("should close form and restore saved comment", () => {
      const { result } = renderHook(() => useFeedback());

      // Initialize with existing comment
      act(() => {
        result.current.initializeFeedback([
          {
            id: "out-1",
            user_feedback: { rating: false, comment: "original" },
          } as Output,
        ]);
      });

      // Open form and edit
      act(() => {
        result.current.handleEditFeedback("out-1");
        result.current.handleFeedbackTextChange("out-1", "edited text");
      });

      expect(result.current.feedbackText["out-1"]).toBe("edited text");

      // Cancel
      act(() => {
        result.current.handleCancelFeedback("out-1");
      });

      expect(result.current.expandedFeedback).toBeNull();
      expect(result.current.feedbackText["out-1"]).toBe("original");
    });
  });

  describe("loading state", () => {
    it("should prevent concurrent operations on same output", async () => {
      // Make API call hang
      let resolveSubmit: (value?: unknown) => void;
      mockSubmitFeedback.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      const { result } = renderHook(() => useFeedback());

      // Start first operation
      act(() => {
        result.current.handleFeedback("out-1", "up");
      });

      expect(result.current.feedbackLoading).toBe("out-1");

      // Try second operation while first is pending
      await act(async () => {
        await result.current.handleFeedback("out-1", "down");
      });

      // Should only have one API call
      expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);

      // Cleanup
      await act(async () => {
        resolveSubmit!();
      });
    });
  });
});

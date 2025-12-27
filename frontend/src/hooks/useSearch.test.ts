/**
 * Tests for useSearch hook
 *
 * Critical paths:
 * - Search returns results successfully
 * - Search handles errors gracefully
 * - Clear resets all state
 * - LoadMore paginates correctly
 * - Empty query clears results
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearch } from "./useSearch";

// Mock the searchApi
vi.mock("../lib/api", () => ({
  searchApi: {
    search: vi.fn(),
  },
}));

// Mock errorMessages
vi.mock("../lib/errorMessages", () => ({
  errorMessages: {
    search: (err: Error) => err.message || "Search failed",
  },
}));

import { searchApi } from "../lib/api";

const mockSearchApi = searchApi.search as ReturnType<typeof vi.fn>;

describe("useSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should start with empty state", () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.loadingMore).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(false);
      expect(result.current.query).toBe("");
    });
  });

  describe("search", () => {
    it("should fetch results successfully", async () => {
      const mockResponse = {
        results: [
          { canonical_id: "BG_2_47", score: 0.95 },
          { canonical_id: "BG_3_19", score: 0.85 },
        ],
        total: 2,
        total_count: 2,
        query_info: { processed_query: "test" },
      };
      mockSearchApi.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search("test query");
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should set loading state during search", async () => {
      mockSearchApi.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ results: [], total: 0, total_count: 0 }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useSearch());

      // Start search but don't await
      act(() => {
        result.current.search("test");
      });

      expect(result.current.loading).toBe(true);

      // Wait for search to complete
      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(result.current.loading).toBe(false);
    });

    it("should handle search errors", async () => {
      mockSearchApi.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search("test");
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("should clear results for empty query", async () => {
      // First, set up some results
      mockSearchApi.mockResolvedValueOnce({
        results: [{ canonical_id: "BG_2_47", score: 0.95 }],
        total: 1,
        total_count: 1,
      });

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search("test");
      });

      expect(result.current.data).not.toBeNull();

      // Now search with empty query
      await act(async () => {
        await result.current.search("");
      });

      expect(result.current.data).toBeNull();
      expect(result.current.query).toBe("");
    });
  });

  describe("clear", () => {
    it("should reset all state", async () => {
      mockSearchApi.mockResolvedValueOnce({
        results: [{ canonical_id: "BG_2_47", score: 0.95 }],
        total: 1,
        total_count: 1,
      });

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search("test");
      });

      expect(result.current.data).not.toBeNull();

      act(() => {
        result.current.clear();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.query).toBe("");
    });
  });

  describe("loadMore", () => {
    it("should load more results with pagination", async () => {
      // First page
      mockSearchApi.mockResolvedValueOnce({
        results: [{ canonical_id: "BG_2_47", score: 0.95 }],
        total: 1,
        total_count: 3, // More results available
      });

      const { result } = renderHook(() => useSearch({ limit: 1 }));

      await act(async () => {
        await result.current.search("test");
      });

      expect(result.current.hasMore).toBe(true);

      // Second page
      mockSearchApi.mockResolvedValueOnce({
        results: [{ canonical_id: "BG_3_19", score: 0.85 }],
        total: 1,
        total_count: 3,
      });

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.data?.results).toHaveLength(2);
      expect(result.current.loadingMore).toBe(false);
    });

    it("should not load more when hasMore is false", async () => {
      mockSearchApi.mockResolvedValueOnce({
        results: [{ canonical_id: "BG_2_47", score: 0.95 }],
        total: 1,
        total_count: 1, // No more results
      });

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search("test");
      });

      expect(result.current.hasMore).toBe(false);

      await act(async () => {
        await result.current.loadMore();
      });

      // API should not be called again
      expect(mockSearchApi).toHaveBeenCalledTimes(1);
    });
  });

  describe("with filters", () => {
    it("should pass chapter filter to API", async () => {
      mockSearchApi.mockResolvedValueOnce({
        results: [],
        total: 0,
        total_count: 0,
      });

      const { result } = renderHook(() => useSearch({ chapter: 2 }));

      await act(async () => {
        await result.current.search("test");
      });

      expect(mockSearchApi).toHaveBeenCalledWith("test", {
        chapter: 2,
        principle: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it("should pass principle filter to API", async () => {
      mockSearchApi.mockResolvedValueOnce({
        results: [],
        total: 0,
        total_count: 0,
      });

      const { result } = renderHook(() =>
        useSearch({ principle: "karma_yoga" }),
      );

      await act(async () => {
        await result.current.search("test");
      });

      expect(mockSearchApi).toHaveBeenCalledWith("test", {
        chapter: undefined,
        principle: "karma_yoga",
        limit: 20,
        offset: 0,
      });
    });
  });
});

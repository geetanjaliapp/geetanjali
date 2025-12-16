import { useState, useCallback, useRef, useEffect } from "react";
import { searchApi } from "../lib/api";
import { errorMessages } from "../lib/errorMessages";
import type { SearchResponse, SearchResult } from "../types";

interface UseSearchOptions {
  /** Debounce delay in ms for instant search (default: 300) */
  debounceMs?: number;
  /** Minimum query length for instant search (default: 2) */
  minQueryLength?: number;
  /** Chapter filter */
  chapter?: number;
  /** Principle filter */
  principle?: string;
  /** Results per page */
  limit?: number;
}

interface UseSearchState {
  data: SearchResponse | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
}

/**
 * Hook for managing search state with debounced instant search and pagination.
 *
 * Implements hybrid search pattern:
 * - Short queries (< 5 chars): Instant search with debounce
 * - Complex queries (>= 5 chars or contains spaces): Submit-based
 *
 * Supports "load more" pagination for large result sets.
 *
 * @example
 * const { data, loading, loadingMore, hasMore, search, loadMore } = useSearch();
 *
 * // For submit-based search (onSubmit)
 * <form onSubmit={() => search(query)}>
 *
 * // For load more
 * {hasMore && <button onClick={loadMore}>Load More</button>}
 */
export function useSearch(options: UseSearchOptions = {}) {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    chapter,
    principle,
    limit = 20,
  } = options;

  const [state, setState] = useState<UseSearchState>({
    data: null,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
  });

  const [query, setQuery] = useState("");
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  /**
   * Execute search immediately (for form submit)
   * Resets pagination to start fresh
   */
  const search = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      setQuery(trimmed);

      if (!trimmed) {
        setState({
          data: null,
          loading: false,
          loadingMore: false,
          error: null,
          hasMore: false,
        });
        setAllResults([]);
        return;
      }

      // Cancel any pending debounced search
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Cancel any in-flight request
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await searchApi.search(trimmed, {
          chapter,
          principle,
          limit,
          offset: 0, // Always start from 0 for new search
        });

        const totalCount = response.total_count ?? response.total;
        const hasMore = response.results.length < totalCount;

        setAllResults(response.results);
        setState({
          data: response,
          loading: false,
          loadingMore: false,
          error: null,
          hasMore,
        });
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;

        const message = errorMessages.search(err);
        setState({
          data: null,
          loading: false,
          loadingMore: false,
          error: message,
          hasMore: false,
        });
        setAllResults([]);
      }
    },
    [chapter, principle, limit],
  );

  /**
   * Load more results (pagination)
   */
  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.data || !state.hasMore) return;

    setState((prev) => ({ ...prev, loadingMore: true }));

    try {
      const response = await searchApi.search(query, {
        chapter,
        principle,
        limit,
        offset: allResults.length,
      });

      const newResults = [...allResults, ...response.results];
      const totalCount = response.total_count ?? response.total;
      const hasMore = newResults.length < totalCount;

      setAllResults(newResults);
      setState((prev) => ({
        ...prev,
        data: {
          ...prev.data!,
          results: newResults,
          total: newResults.length,
        },
        loadingMore: false,
        hasMore,
      }));
    } catch (err) {
      const message = errorMessages.search(err);
      setState((prev) => ({ ...prev, loadingMore: false, error: message }));
    }
  }, [
    state.loadingMore,
    state.data,
    state.hasMore,
    query,
    chapter,
    principle,
    limit,
    allResults,
  ]);

  /**
   * Debounced search for instant results (for input onChange)
   * Only triggers for short queries; longer queries should use submit
   */
  const searchInstant = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      setQuery(trimmed);

      // Clear any pending debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Don't search if too short
      if (trimmed.length < minQueryLength) {
        setState({
          data: null,
          loading: false,
          loadingMore: false,
          error: null,
          hasMore: false,
        });
        setAllResults([]);
        return;
      }

      // For complex queries (long or has spaces), wait for submit
      const isComplex = trimmed.length >= 5 || trimmed.includes(" ");
      if (isComplex) {
        // Show loading indicator but don't search yet
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Simple query - debounce and search
      setState((prev) => ({ ...prev, loading: true }));

      debounceRef.current = setTimeout(() => {
        search(trimmed);
      }, debounceMs);
    },
    [debounceMs, minQueryLength, search],
  );

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    setQuery("");
    setState({
      data: null,
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
    });
    setAllResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return {
    ...state,
    query,
    search,
    searchInstant,
    loadMore,
    clear,
  };
}

export default useSearch;

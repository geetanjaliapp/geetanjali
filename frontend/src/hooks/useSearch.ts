import { useState, useCallback, useRef, useEffect } from "react";
import { searchApi } from "../lib/api";
import { errorMessages } from "../lib/errorMessages";
import type { SearchResponse } from "../types";

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
  error: string | null;
}

/**
 * Hook for managing search state with debounced instant search.
 *
 * Implements hybrid search pattern:
 * - Short queries (< 5 chars): Instant search with debounce
 * - Complex queries (>= 5 chars or contains spaces): Submit-based
 *
 * @example
 * const { data, loading, error, search, searchInstant } = useSearch();
 *
 * // For instant search (onChange)
 * <input onChange={(e) => searchInstant(e.target.value)} />
 *
 * // For submit-based search (onSubmit)
 * <form onSubmit={() => search(query)}>
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
    error: null,
  });

  const [query, setQuery] = useState("");
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
   */
  const search = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      setQuery(trimmed);

      if (!trimmed) {
        setState({ data: null, loading: false, error: null });
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
        });
        setState({ data: response, loading: false, error: null });
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;

        const message = errorMessages.search(err);
        setState({ data: null, loading: false, error: message });
      }
    },
    [chapter, principle, limit]
  );

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
        setState({ data: null, loading: false, error: null });
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
    [debounceMs, minQueryLength, search]
  );

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    setQuery("");
    setState({ data: null, loading: false, error: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return {
    ...state,
    query,
    search,
    searchInstant,
    clear,
  };
}

export default useSearch;

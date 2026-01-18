import { useState, useEffect, useCallback } from "react";
import {
  topicsApi,
  type TopicsListResponse,
  type TopicGroup,
  type TopicPrincipleSummary,
} from "../lib/api";
import { errorMessages } from "../lib/errorMessages";

/**
 * Topics list cache - shared across all hook instances.
 * Prevents multiple API calls when used in multiple components.
 */
let cachedData: TopicsListResponse | null = null;
let loadingPromise: Promise<void> | null = null;

/**
 * Hook for accessing the full topics list grouped by yoga path.
 *
 * Data is fetched once and cached globally, so multiple components
 * using this hook will share the same data.
 *
 * @example
 * const { groups, totalPrinciples, loading, getGroup, getPrinciple } = useTopics();
 */
export function useTopics() {
  const [data, setData] = useState<TopicsListResponse | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already cached, use it
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    // If fetch is already in progress, wait for it
    if (loadingPromise) {
      loadingPromise
        .then(() => {
          if (cachedData) setData(cachedData);
        })
        .catch((err) => {
          setError(errorMessages.general(err));
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    // Start fetching
    setLoading(true);
    loadingPromise = (async () => {
      try {
        const response = await topicsApi.getAll();
        cachedData = response;
        setData(cachedData);
      } catch (err) {
        setError(errorMessages.general(err));
      } finally {
        setLoading(false);
        loadingPromise = null;
      }
    })();
  }, []);

  /**
   * Get group by ID
   */
  const getGroup = useCallback(
    (groupId: string): TopicGroup | undefined => {
      return data?.groups.find((g) => g.id === groupId);
    },
    [data],
  );

  /**
   * Get principle by ID (searches across all groups)
   */
  const getPrinciple = useCallback(
    (principleId: string): TopicPrincipleSummary | undefined => {
      if (!data) return undefined;
      for (const group of data.groups) {
        const principle = group.principles.find((p) => p.id === principleId);
        if (principle) return principle;
      }
      return undefined;
    },
    [data],
  );

  /**
   * Get all principles as a flat list
   */
  const getAllPrinciples = useCallback((): TopicPrincipleSummary[] => {
    if (!data) return [];
    return data.groups.flatMap((g) => g.principles);
  }, [data]);

  return {
    // Data
    groups: data?.groups ?? [],
    totalPrinciples: data?.totalPrinciples ?? 0,
    totalVerses: data?.totalVerses ?? 0,
    loading,
    error,

    // Lookup helpers
    getGroup,
    getPrinciple,
    getAllPrinciples,
  };
}

/**
 * Preload topics data (call early in app lifecycle).
 * This allows data to be ready before components mount.
 */
export async function preloadTopics(): Promise<void> {
  if (cachedData) {
    return;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      cachedData = await topicsApi.getAll();
    } catch (err) {
      console.error("Failed to preload topics:", err);
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Clear the topics cache.
 * Useful for testing or when data needs to be refreshed.
 */
export function clearTopicsCache(): void {
  cachedData = null;
  loadingPromise = null;
}

export default useTopics;

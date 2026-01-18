import { useState, useEffect, useCallback } from "react";
import { topicsApi, type TopicDetailResponse } from "../lib/api";
import { errorMessages } from "../lib/errorMessages";

/**
 * Per-topic cache - stores fetched topic details by ID.
 * Cache entries persist for session duration.
 */
const topicCache = new Map<string, TopicDetailResponse>();
const loadingPromises = new Map<string, Promise<void>>();

interface UseTopicOptions {
  /** Whether to include verse list (default: true) */
  includeVerses?: boolean;
}

interface UseTopicReturn {
  /** Topic data (null if loading or error) */
  topic: TopicDetailResponse | null;
  /** Loading state */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Refetch the topic (bypasses cache) */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching a single topic's detailed information.
 *
 * Data is cached per topic ID, so navigating back to a topic
 * will use cached data instead of refetching.
 *
 * @param principleId - The topic/principle ID to fetch
 * @param options - Optional configuration
 *
 * @example
 * const { topic, loading, error } = useTopic("dharma");
 *
 * @example
 * // Without verses (lighter response)
 * const { topic, loading } = useTopic("dharma", { includeVerses: false });
 */
export function useTopic(
  principleId: string | null | undefined,
  options: UseTopicOptions = {},
): UseTopicReturn {
  const { includeVerses = true } = options;
  const cacheKey = principleId ? `${principleId}:${includeVerses}` : null;

  const [topic, setTopic] = useState<TopicDetailResponse | null>(
    cacheKey ? topicCache.get(cacheKey) ?? null : null,
  );
  const [loading, setLoading] = useState(
    principleId != null && !topicCache.has(cacheKey ?? ""),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchTopic = useCallback(
    async (bypassCache = false) => {
      if (!principleId || !cacheKey) {
        setTopic(null);
        setLoading(false);
        return;
      }

      // Check cache first (unless bypassing)
      if (!bypassCache && topicCache.has(cacheKey)) {
        setTopic(topicCache.get(cacheKey)!);
        setLoading(false);
        return;
      }

      // If fetch is already in progress for this topic, wait for it
      if (!bypassCache && loadingPromises.has(cacheKey)) {
        try {
          await loadingPromises.get(cacheKey);
          if (topicCache.has(cacheKey)) {
            setTopic(topicCache.get(cacheKey)!);
          }
        } catch (err) {
          setError(errorMessages.general(err));
        } finally {
          setLoading(false);
        }
        return;
      }

      // Start fetching
      setLoading(true);
      setError(null);

      const fetchPromise = (async () => {
        try {
          const response = await topicsApi.getById(principleId, {
            includeVerses,
          });
          topicCache.set(cacheKey, response);
          setTopic(response);
        } catch (err) {
          setError(errorMessages.general(err));
          setTopic(null);
        } finally {
          setLoading(false);
          loadingPromises.delete(cacheKey);
        }
      })();

      loadingPromises.set(cacheKey, fetchPromise);
      await fetchPromise;
    },
    [principleId, cacheKey, includeVerses],
  );

  useEffect(() => {
    fetchTopic();
  }, [fetchTopic]);

  const refetch = useCallback(async () => {
    await fetchTopic(true);
  }, [fetchTopic]);

  return {
    topic,
    loading,
    error,
    refetch,
  };
}

/**
 * Preload a topic's data (call before navigation).
 * Useful for hover prefetch or predictive loading.
 *
 * @param principleId - The topic/principle ID to preload
 * @param options - Optional configuration
 */
export async function preloadTopic(
  principleId: string,
  options: UseTopicOptions = {},
): Promise<void> {
  const { includeVerses = true } = options;
  const cacheKey = `${principleId}:${includeVerses}`;

  if (topicCache.has(cacheKey)) {
    return;
  }

  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      const response = await topicsApi.getById(principleId, { includeVerses });
      topicCache.set(cacheKey, response);
    } catch (err) {
      console.error(`Failed to preload topic ${principleId}:`, err);
    } finally {
      loadingPromises.delete(cacheKey);
    }
  })();

  loadingPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Clear the topic cache.
 * Useful for testing or when data needs to be refreshed.
 */
export function clearTopicCache(): void {
  topicCache.clear();
}

export default useTopic;

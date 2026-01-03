/**
 * useAsyncAction - Generic hook for async operations with loading/error state
 *
 * Consolidates the common pattern of:
 * - Setting loading state before async call
 * - Clearing error state before async call
 * - Catching errors and setting error message
 * - Resetting loading state in finally block
 *
 * @example
 * ```tsx
 * // Action-triggered (form submit, button click)
 * const { loading, error, execute } = useAsyncAction();
 *
 * const handleSubmit = async () => {
 *   const success = await execute(async () => {
 *     await api.doSomething();
 *     return true;
 *   });
 *   if (success) navigate('/success');
 * };
 *
 * // Fetch-on-mount pattern
 * const { loading, error, execute } = useAsyncAction({ initialLoading: true });
 *
 * useEffect(() => {
 *   execute(() => api.fetchData()).then(setData);
 * }, [execute]);
 * ```
 */

import { useState, useCallback } from "react";

export interface UseAsyncActionOptions {
  /** Default error message when no custom handler is provided */
  defaultErrorMessage?: string;
  /** Start with loading=true (for fetch-on-mount patterns) */
  initialLoading?: boolean;
}

export interface UseAsyncActionResult<T = void> {
  /** Whether an async operation is in progress */
  loading: boolean;
  /** Current error message, empty string if no error */
  error: string;
  /** Clear the current error */
  clearError: () => void;
  /** Set a custom error message */
  setError: (message: string) => void;
  /**
   * Execute an async function with automatic loading/error handling.
   * Returns the result on success, undefined on error.
   */
  execute: (
    asyncFn: () => Promise<T>,
    getErrorMessage?: (err: unknown) => string,
  ) => Promise<T | undefined>;
}

/**
 * Hook for managing async operation state (loading, error).
 *
 * @param options - Configuration options or default error message string
 * @returns Object with loading, error, clearError, setError, and execute
 */
export function useAsyncAction<T = void>(
  options: UseAsyncActionOptions | string = {},
): UseAsyncActionResult<T> {
  // Support legacy string argument for backwards compatibility
  const opts: UseAsyncActionOptions =
    typeof options === "string" ? { defaultErrorMessage: options } : options;

  const {
    defaultErrorMessage = "An error occurred",
    initialLoading = false,
  } = opts;

  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState("");

  const clearError = useCallback(() => setError(""), []);

  const execute = useCallback(
    async (
      asyncFn: () => Promise<T>,
      getErrorMessage?: (err: unknown) => string,
    ): Promise<T | undefined> => {
      setError("");
      setLoading(true);

      try {
        const result = await asyncFn();
        return result;
      } catch (err) {
        const message = getErrorMessage
          ? getErrorMessage(err)
          : defaultErrorMessage;
        setError(message);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [defaultErrorMessage],
  );

  return { loading, error, clearError, setError, execute };
}

export default useAsyncAction;

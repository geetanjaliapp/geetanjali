import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAsyncAction } from "./useAsyncAction";

describe("useAsyncAction", () => {
  describe("initial state", () => {
    it("should start with loading false", () => {
      const { result } = renderHook(() => useAsyncAction());
      expect(result.current.loading).toBe(false);
    });

    it("should start with empty error", () => {
      const { result } = renderHook(() => useAsyncAction());
      expect(result.current.error).toBe("");
    });
  });

  describe("execute", () => {
    it("should set loading true during execution", async () => {
      const { result } = renderHook(() => useAsyncAction());

      let resolvePromise: () => void;
      const asyncFn = () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve;
        });

      act(() => {
        result.current.execute(asyncFn);
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!();
      });

      expect(result.current.loading).toBe(false);
    });

    it("should return result on success", async () => {
      const { result } = renderHook(() => useAsyncAction<string>());

      let returnValue: string | undefined;
      await act(async () => {
        returnValue = await result.current.execute(async () => "success");
      });

      expect(returnValue).toBe("success");
      expect(result.current.error).toBe("");
    });

    it("should return undefined and set error on failure", async () => {
      const { result } = renderHook(() => useAsyncAction());

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.execute(async () => {
          throw new Error("test error");
        });
      });

      expect(returnValue).toBeUndefined();
      expect(result.current.error).toBe("An error occurred");
    });

    it("should use custom error message handler", async () => {
      const { result } = renderHook(() => useAsyncAction());

      await act(async () => {
        await result.current.execute(
          async () => {
            throw new Error("test error");
          },
          (err) => `Custom: ${(err as Error).message}`,
        );
      });

      expect(result.current.error).toBe("Custom: test error");
    });

    it("should use default error message from constructor", async () => {
      const { result } = renderHook(() =>
        useAsyncAction("Something went wrong"),
      );

      await act(async () => {
        await result.current.execute(async () => {
          throw new Error("test error");
        });
      });

      expect(result.current.error).toBe("Something went wrong");
    });

    it("should clear error before new execution", async () => {
      const { result } = renderHook(() => useAsyncAction());

      // First call - fails
      await act(async () => {
        await result.current.execute(async () => {
          throw new Error("first error");
        });
      });
      expect(result.current.error).toBe("An error occurred");

      // Second call - succeeds
      await act(async () => {
        await result.current.execute(async () => {});
      });
      expect(result.current.error).toBe("");
    });

    it("should set loading false even when error occurs", async () => {
      const { result } = renderHook(() => useAsyncAction());

      await act(async () => {
        await result.current.execute(async () => {
          throw new Error("test error");
        });
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe("clearError", () => {
    it("should clear the error message", async () => {
      const { result } = renderHook(() => useAsyncAction());

      await act(async () => {
        await result.current.execute(async () => {
          throw new Error("test error");
        });
      });
      expect(result.current.error).toBe("An error occurred");

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBe("");
    });
  });

  describe("setError", () => {
    it("should set a custom error message", () => {
      const { result } = renderHook(() => useAsyncAction());

      act(() => {
        result.current.setError("Custom error");
      });

      expect(result.current.error).toBe("Custom error");
    });
  });

  describe("integration with errorMessages", () => {
    it("should work with getApiErrorDetail pattern", async () => {
      const { result } = renderHook(() => useAsyncAction<void>());

      // Simulate axios-like error
      const axiosError = {
        isAxiosError: true,
        response: { data: { detail: "Server error message" } },
      };

      await act(async () => {
        await result.current.execute(
          async () => {
            throw axiosError;
          },
          (err) => {
            const axiosErr = err as typeof axiosError;
            return axiosErr.response?.data?.detail || "Fallback";
          },
        );
      });

      expect(result.current.error).toBe("Server error message");
    });
  });
});

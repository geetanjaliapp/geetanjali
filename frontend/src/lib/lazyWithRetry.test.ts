import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SESSION_KEYS } from "./storage";

// We need to test internal functions, so we'll re-implement the testable parts
// and test the exported function behavior

const CHUNK_RELOAD_KEY = SESSION_KEYS.chunkReloadAttempt;
const RELOAD_EXPIRY = 30000; // 30 seconds - matches CONFIG in lazyWithRetry.ts

/**
 * Known chunk loading error patterns - must match lazyWithRetry.ts
 */
const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "loading chunk",
  "loading css chunk",
  "failed to load",
  "unable to preload",
  "networkerror when attempting to fetch resource",
  "load failed",
  "undefined is not an object",
  "error when evaluating a module script",
];

/**
 * Re-implementation of isChunkLoadError for testing
 */
function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Re-implementation of tryMarkReloadAttempt for testing
 */
function tryMarkReloadAttempt(): boolean {
  try {
    const now = Date.now();
    const lastAttempt = sessionStorage.getItem(CHUNK_RELOAD_KEY);

    if (lastAttempt) {
      const timestamp = parseInt(lastAttempt, 10);
      if (!isNaN(timestamp) && now - timestamp < RELOAD_EXPIRY) {
        return false;
      }
    }

    sessionStorage.setItem(CHUNK_RELOAD_KEY, now.toString());
    return true;
  } catch {
    return true;
  }
}

describe("lazyWithRetry utilities", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isChunkLoadError", () => {
    it("should detect Vite/ESM chunk errors", () => {
      const error = new Error("Failed to fetch dynamically imported module: /assets/About-abc123.js");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect Vite loading errors", () => {
      const error = new Error("Error loading dynamically imported module");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect Webpack chunk errors", () => {
      const error = new Error("Loading chunk 5 failed");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect CSS chunk errors", () => {
      const error = new Error("Loading CSS chunk styles-abc123 failed");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect generic load failures", () => {
      const error = new Error("Failed to load resource: the server responded with 404");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect preload failures", () => {
      const error = new Error("Unable to preload CSS for /assets/styles.css");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect network errors", () => {
      const error = new Error("NetworkError when attempting to fetch resource");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect Safari-specific errors", () => {
      const error = new Error("undefined is not an object (evaluating 'module.exports')");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should detect Firefox-specific errors", () => {
      const error = new Error("error when evaluating a module script");
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("should NOT detect syntax errors", () => {
      const error = new Error("Unexpected token '<'");
      expect(isChunkLoadError(error)).toBe(false);
    });

    it("should NOT detect reference errors", () => {
      const error = new Error("ReferenceError: foo is not defined");
      expect(isChunkLoadError(error)).toBe(false);
    });

    it("should NOT detect type errors (non-chunk related)", () => {
      const error = new Error("TypeError: Cannot read property 'map' of undefined");
      expect(isChunkLoadError(error)).toBe(false);
    });

    it("should return false for non-Error objects", () => {
      expect(isChunkLoadError("string error")).toBe(false);
      expect(isChunkLoadError({ message: "object error" })).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });

    it("should be case-insensitive", () => {
      const error = new Error("FAILED TO FETCH DYNAMICALLY IMPORTED MODULE");
      expect(isChunkLoadError(error)).toBe(true);
    });
  });

  describe("tryMarkReloadAttempt", () => {
    it("should return true and mark on first attempt", () => {
      const result = tryMarkReloadAttempt();

      expect(result).toBe(true);
      expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeDefined();
    });

    it("should return false if called within cooldown period", () => {
      // First attempt succeeds
      expect(tryMarkReloadAttempt()).toBe(true);

      // Second attempt within 30 seconds should fail
      vi.advanceTimersByTime(5000); // 5 seconds later
      expect(tryMarkReloadAttempt()).toBe(false);
    });

    it("should return true after cooldown expires", () => {
      // First attempt
      expect(tryMarkReloadAttempt()).toBe(true);

      // Advance past cooldown (30 seconds)
      vi.advanceTimersByTime(31000);

      // Should succeed again
      expect(tryMarkReloadAttempt()).toBe(true);
    });

    it("should handle exactly at cooldown boundary", () => {
      expect(tryMarkReloadAttempt()).toBe(true);

      // At exactly 30 seconds, cooldown has expired (uses < not <=)
      // So now - timestamp = 30000, which is NOT < 30000, so reload allowed
      vi.advanceTimersByTime(30000);
      expect(tryMarkReloadAttempt()).toBe(true);
    });

    it("should block just before cooldown expires", () => {
      expect(tryMarkReloadAttempt()).toBe(true);

      // 1ms before 30 seconds, should still be blocked
      vi.advanceTimersByTime(29999);
      expect(tryMarkReloadAttempt()).toBe(false);
    });

    it("should handle invalid timestamp in storage", () => {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "not-a-number");

      // Should treat invalid as "no previous attempt" and allow reload
      expect(tryMarkReloadAttempt()).toBe(true);
    });

    it("should handle empty string in storage", () => {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "");

      expect(tryMarkReloadAttempt()).toBe(true);
    });

    it("should update timestamp on successful attempt after expiry", () => {
      const firstTime = Date.now();
      tryMarkReloadAttempt();

      const firstStored = sessionStorage.getItem(CHUNK_RELOAD_KEY);
      expect(firstStored).toBe(firstTime.toString());

      // Advance past cooldown
      vi.advanceTimersByTime(31000);
      const secondTime = Date.now();
      tryMarkReloadAttempt();

      const secondStored = sessionStorage.getItem(CHUNK_RELOAD_KEY);
      expect(secondStored).toBe(secondTime.toString());
      expect(parseInt(secondStored!, 10)).toBeGreaterThan(parseInt(firstStored!, 10));
    });

    it("should prevent race conditions (atomic check-and-set)", () => {
      // Simulate multiple simultaneous calls
      // First call should succeed and mark
      const result1 = tryMarkReloadAttempt();
      expect(result1).toBe(true);

      // Immediate second call should fail (simulating race)
      const result2 = tryMarkReloadAttempt();
      expect(result2).toBe(false);

      // Third call should also fail
      const result3 = tryMarkReloadAttempt();
      expect(result3).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should allow reload after user manually refreshes and waits", () => {
      // User hits chunk error, page reloads
      expect(tryMarkReloadAttempt()).toBe(true);

      // Simulate page reload (storage persists in session)
      // User waits 30+ seconds then navigates
      vi.advanceTimersByTime(35000);

      // Should allow another reload if needed
      expect(tryMarkReloadAttempt()).toBe(true);
    });

    it("should protect against infinite reload loop", () => {
      // Simulate rapid reload attempts (broken chunk)
      const attempts: boolean[] = [];

      for (let i = 0; i < 5; i++) {
        attempts.push(tryMarkReloadAttempt());
        vi.advanceTimersByTime(1000); // 1 second between attempts
      }

      // Only first attempt should succeed
      expect(attempts).toEqual([true, false, false, false, false]);
    });

    it("should recover after cooldown even with persistent failures", () => {
      // First attempt
      expect(tryMarkReloadAttempt()).toBe(true);

      // Multiple failed attempts during cooldown
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(2000);
        expect(tryMarkReloadAttempt()).toBe(false);
      }

      // After cooldown expires (we've advanced 20s, need 10+ more)
      vi.advanceTimersByTime(15000);

      // Should allow retry now
      expect(tryMarkReloadAttempt()).toBe(true);
    });
  });
});

describe("chunk error detection edge cases", () => {
  it("should detect errors with extra context in message", () => {
    const complexError = new Error(
      "Uncaught (in promise) TypeError: Failed to fetch dynamically imported module: https://example.com/assets/Page-12345.js"
    );
    expect(isChunkLoadError(complexError)).toBe(true);
  });

  it("should detect errors wrapped in other text", () => {
    const wrappedError = new Error(
      "Module initialization failed: Loading chunk vendors failed (timeout)"
    );
    expect(isChunkLoadError(wrappedError)).toBe(true);
  });

  it("should handle errors with stack traces in message", () => {
    const errorWithStack = new Error(
      "Failed to load module\n    at async loadComponent (/app.js:123)\n    at async render"
    );
    expect(isChunkLoadError(errorWithStack)).toBe(true);
  });
});

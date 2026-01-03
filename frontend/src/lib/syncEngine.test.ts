/**
 * SyncEngine Tests
 *
 * Tests for the core sync engine functionality.
 * Part of v1.17.3 preference sync improvements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncEngine, type SyncConfig, type SyncState } from "./syncEngine";

// Mock API
const createMockApi = () => ({
  get: vi.fn().mockResolvedValue({
    favorites: { items: [], updated_at: "" },
    reading: { chapter: null, verse: null, font_size: "regular", section_prefs: {}, updated_at: null },
    learning_goals: { goal_ids: [], updated_at: null },
    theme: { mode: "system", theme_id: "default", font_family: "mixed", updated_at: null },
  }),
  merge: vi.fn().mockResolvedValue({
    favorites: { items: [], updated_at: "" },
    reading: { chapter: null, verse: null, font_size: "regular", section_prefs: {}, updated_at: null },
    learning_goals: { goal_ids: [], updated_at: null },
    theme: { mode: "system", theme_id: "default", font_family: "mixed", updated_at: null },
  }),
  update: vi.fn().mockResolvedValue({
    favorites: { items: [], updated_at: "" },
    reading: { chapter: null, verse: null, font_size: "regular", section_prefs: {}, updated_at: null },
    learning_goals: { goal_ids: [], updated_at: null },
    theme: { mode: "system", theme_id: "default", font_family: "mixed", updated_at: null },
  }),
});

// Fast config for testing
const TEST_CONFIG: SyncConfig = {
  debounceMs: {
    reading: 50,
    fontSize: 30,
    favorites: 20,
    goals: 20,
    theme: 20,
  },
  maxRetries: 3,
  retryBackoffMs: [10, 20, 30],
  mergeThrottleMs: 100,
};

describe("SyncEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("subscribe / getState", () => {
    it("should return initial state", () => {
      const engine = new SyncEngine(createMockApi(), TEST_CONFIG);
      const state = engine.getState();

      expect(state.status).toBe("idle");
      expect(state.lastSynced).toBeNull();
      expect(state.pendingCount).toBe(0);
      expect(state.error).toBeNull();
    });

    it("should notify subscribers immediately with current state", () => {
      const engine = new SyncEngine(createMockApi(), TEST_CONFIG);
      const listener = vi.fn();

      engine.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        status: "idle",
      }));
    });

    it("should notify subscribers on state changes", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);
      const listener = vi.fn();

      engine.subscribe(listener);
      listener.mockClear(); // Clear initial call

      engine.update("favorites", { items: ["verse1"] });

      // Pending count should increase
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        pendingCount: 1,
      }));
    });

    it("should allow unsubscribing", () => {
      const engine = new SyncEngine(createMockApi(), TEST_CONFIG);
      const listener = vi.fn();

      const unsubscribe = engine.subscribe(listener);
      listener.mockClear();

      unsubscribe();
      engine.update("favorites", { items: ["verse1"] });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should queue updates and set pending count", () => {
      const engine = new SyncEngine(createMockApi(), TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });

      expect(engine.getState().pendingCount).toBe(1);
    });

    it("should batch multiple updates of same type", () => {
      const engine = new SyncEngine(createMockApi(), TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });
      engine.update("favorites", { items: ["verse1", "verse2"] });

      // Should still be 1 pending (same type overwrites)
      expect(engine.getState().pendingCount).toBe(1);
    });

    it("should count different types separately", () => {
      const engine = new SyncEngine(createMockApi(), TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });
      engine.update("goals", { goal_ids: ["goal1"] });

      expect(engine.getState().pendingCount).toBe(2);
    });

    it("should debounce and call API after delay", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });

      // Should not call immediately
      expect(mockApi.update).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(TEST_CONFIG.debounceMs.favorites + 10);

      expect(mockApi.update).toHaveBeenCalledTimes(1);
      expect(mockApi.update).toHaveBeenCalledWith({
        favorites: { items: ["verse1"] },
      });
    });

    it("should use type-specific debounce times", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      engine.update("reading", { chapter: 1, verse: 1 });

      // Reading has longer debounce (50ms vs 20ms for favorites)
      await vi.advanceTimersByTimeAsync(30);
      expect(mockApi.update).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30);
      expect(mockApi.update).toHaveBeenCalledTimes(1);
    });

    it("should reset debounce timer on repeated updates", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });
      await vi.advanceTimersByTimeAsync(15);

      engine.update("favorites", { items: ["verse1", "verse2"] });
      await vi.advanceTimersByTimeAsync(15);

      // Still not called (timer was reset)
      expect(mockApi.update).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10);
      expect(mockApi.update).toHaveBeenCalledWith({
        favorites: { items: ["verse1", "verse2"] },
      });
    });
  });

  describe("merge", () => {
    it("should call API merge with local data", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      const local = {
        favorites: { items: ["verse1"] },
      };

      const result = await engine.merge(local);

      expect(mockApi.merge).toHaveBeenCalledWith(local);
      expect(result).not.toBeNull();
    });

    it("should update state to syncing then synced", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);
      const states: SyncState[] = [];

      engine.subscribe((state) => states.push({ ...state }));

      await engine.merge({ favorites: { items: [] } });

      // Should have gone through syncing -> synced
      expect(states.some((s) => s.status === "syncing")).toBe(true);
      expect(states[states.length - 1].status).toBe("synced");
      expect(states[states.length - 1].lastSynced).not.toBeNull();
    });

    it("should throttle rapid merges", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      await engine.merge({ favorites: { items: [] } });
      const result = await engine.merge({ favorites: { items: ["new"] } });

      expect(mockApi.merge).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it("should allow merge after throttle expires", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      await engine.merge({ favorites: { items: [] } });

      // Advance past throttle
      await vi.advanceTimersByTimeAsync(TEST_CONFIG.mergeThrottleMs + 10);

      await engine.merge({ favorites: { items: ["new"] } });

      expect(mockApi.merge).toHaveBeenCalledTimes(2);
    });

    it("should handle merge errors", async () => {
      const mockApi = createMockApi();
      mockApi.merge.mockRejectedValueOnce(new Error("Network error"));
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      const result = await engine.merge({ favorites: { items: [] } });

      expect(result).toBeNull();
      expect(engine.getState().status).toBe("error");
      expect(engine.getState().error?.message).toBe("Network error");
    });
  });

  describe("flush", () => {
    it("should send pending updates immediately", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });
      engine.update("goals", { goal_ids: ["goal1"] });

      await engine.flush();

      expect(mockApi.update).toHaveBeenCalledTimes(1);
      expect(mockApi.update).toHaveBeenCalledWith({
        favorites: { items: ["verse1"] },
        learning_goals: { goal_ids: ["goal1"] },
      });
    });

    it("should clear debounce timers", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });
      await engine.flush();

      // Advance past original debounce
      await vi.advanceTimersByTimeAsync(100);

      // Should only have been called once (by flush, not timer)
      expect(mockApi.update).toHaveBeenCalledTimes(1);
    });

    it("should do nothing if no pending changes", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      await engine.flush();

      expect(mockApi.update).not.toHaveBeenCalled();
    });
  });

  describe("retry logic", () => {
    it("should retry on failure with backoff", async () => {
      const mockApi = createMockApi();
      mockApi.update
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValueOnce(undefined);

      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      // Use flush to trigger immediately instead of relying on debounce timers
      engine.update("favorites", { items: ["verse1"] });
      await engine.flush();

      // First attempt failed
      expect(mockApi.update).toHaveBeenCalledTimes(1);
      expect(engine.getState().status).toBe("error");

      // First retry
      await vi.advanceTimersByTimeAsync(TEST_CONFIG.retryBackoffMs[0] + 10);
      expect(mockApi.update).toHaveBeenCalledTimes(2);

      // Second retry (success)
      await vi.advanceTimersByTimeAsync(TEST_CONFIG.retryBackoffMs[1] + 10);
      expect(mockApi.update).toHaveBeenCalledTimes(3);
      expect(engine.getState().status).toBe("synced");
    });

    it("should stop after max retries", async () => {
      const mockApi = createMockApi();
      mockApi.update.mockRejectedValue(new Error("Persistent error"));

      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      // Use flush to trigger immediately
      engine.update("favorites", { items: ["verse1"] });
      await engine.flush();

      // Exhaust all retries
      for (const backoff of TEST_CONFIG.retryBackoffMs) {
        await vi.advanceTimersByTimeAsync(backoff + 10);
      }

      // Should have called maxRetries + 1 times (initial + retries)
      expect(mockApi.update).toHaveBeenCalledTimes(TEST_CONFIG.maxRetries + 1);
      expect(engine.getState().status).toBe("error");
    });
  });

  describe("reset", () => {
    it("should clear all state and timers", async () => {
      const mockApi = createMockApi();
      const engine = new SyncEngine(mockApi, TEST_CONFIG);

      engine.update("favorites", { items: ["verse1"] });
      engine.reset();

      expect(engine.getState().pendingCount).toBe(0);
      expect(engine.getState().status).toBe("idle");

      // Advance past debounce - should not call API
      await vi.advanceTimersByTimeAsync(100);
      expect(mockApi.update).not.toHaveBeenCalled();
    });
  });
});

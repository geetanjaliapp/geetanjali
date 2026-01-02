/**
 * PreferencesContext tests
 *
 * Tests the unified preferences context that manages:
 * - Favorites
 * - Learning Goals
 * - Reading position and settings
 * - Sync status
 *
 * Part of v1.17.3 preference sync improvements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { PreferencesProvider, usePreferencesContext } from "./PreferencesContext";
import { AuthProvider } from "./AuthContext";
import type { ReactNode } from "react";

// Mock useTaxonomy hook
vi.mock("../hooks/useTaxonomy", () => ({
  useTaxonomy: () => ({
    goals: [
      { id: "goal-1", label: "Goal 1", description: "Test goal 1", icon: "📖", principles: [] },
      { id: "goal-2", label: "Goal 2", description: "Test goal 2", icon: "🎯", principles: [] },
    ],
    getGoal: (id: string) => {
      const goals: Record<string, { id: string; label: string; description: string; icon: string; principles: string[] }> = {
        "goal-1": { id: "goal-1", label: "Goal 1", description: "Test goal 1", icon: "📖", principles: [] },
        "goal-2": { id: "goal-2", label: "Goal 2", description: "Test goal 2", icon: "🎯", principles: [] },
      };
      return goals[id];
    },
    getPrinciplesForGoal: () => [],
    loading: false,
    error: null,
  }),
}));

// Mock syncEngine
vi.mock("../lib/syncEngine", () => ({
  syncEngine: {
    subscribe: vi.fn(() => vi.fn()),
    initFlushHandlers: vi.fn(() => vi.fn()),
    initOnlineHandlers: vi.fn(() => vi.fn()),
    merge: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    reset: vi.fn(),
  },
}));

// Mock preferencesStorage
vi.mock("../lib/preferencesStorage", () => ({
  preferencesStorage: {
    getFavorites: vi.fn(() => []),
    setFavorites: vi.fn(),
    getGoals: vi.fn(() => null),
    setGoals: vi.fn(),
    getReadingPosition: vi.fn(() => null),
    setReadingPosition: vi.fn(),
    getReadingSettings: vi.fn(() => ({ fontSize: "medium" })),
    setReadingSettings: vi.fn(),
    getAllForMerge: vi.fn(() => ({})),
  },
}));

// Mock auth API
vi.mock("../api/auth", () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
  },
  tokenStorage: {
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    needsRefresh: vi.fn(),
    isExpired: vi.fn(),
  },
}));

// PreferencesProvider requires AuthProvider for auth state
const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <PreferencesProvider>{children}</PreferencesProvider>
  </AuthProvider>
);

describe("PreferencesContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    cleanup();
    vi.resetAllMocks();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  describe("usePreferencesContext hook", () => {
    it("should throw error when used outside PreferencesProvider", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => usePreferencesContext());
      }).toThrow("usePreferencesContext must be used within PreferencesProvider");

      consoleSpy.mockRestore();
    });

    it("should provide default state", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      // Favorites
      expect(result.current.favorites).toBeInstanceOf(Set);
      expect(result.current.favoritesCount).toBe(0);

      // Goals
      expect(result.current.goals.selectedIds).toEqual([]);
      expect(result.current.goals.selectedGoals).toEqual([]);
      expect(result.current.availableGoals).toBeDefined();

      // Reading
      expect(result.current.reading.position).toBeNull();
      expect(result.current.reading.settings.fontSize).toBe("medium");

      // Sync
      expect(result.current.sync.status).toBe("idle");
      expect(result.current.sync.lastSynced).toBeNull();
    });
  });

  describe("favorites functionality", () => {
    it("should add a favorite", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      act(() => {
        result.current.addFavorite("BG_1_1");
      });

      expect(result.current.favorites.has("BG_1_1")).toBe(true);
      expect(result.current.favoritesCount).toBe(1);
    });

    it("should remove a favorite", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      act(() => {
        result.current.addFavorite("BG_1_1");
      });
      expect(result.current.favorites.has("BG_1_1")).toBe(true);

      act(() => {
        result.current.removeFavorite("BG_1_1");
      });

      expect(result.current.favorites.has("BG_1_1")).toBe(false);
      expect(result.current.favoritesCount).toBe(0);
    });

    it("should toggle a favorite", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      // Toggle on
      act(() => {
        result.current.toggleFavorite("BG_1_1");
      });
      expect(result.current.favorites.has("BG_1_1")).toBe(true);

      // Toggle off
      act(() => {
        result.current.toggleFavorite("BG_1_1");
      });
      expect(result.current.favorites.has("BG_1_1")).toBe(false);
    });

    it("should check if a verse is favorite", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      expect(result.current.isFavorite("BG_1_1")).toBe(false);

      act(() => {
        result.current.addFavorite("BG_1_1");
      });

      expect(result.current.isFavorite("BG_1_1")).toBe(true);
    });

    it("should enforce maximum favorites limit", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      // Add 100 favorites (the limit)
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addFavorite(`BG_${i}_${i}`);
        }
      });
      expect(result.current.favoritesCount).toBe(100);

      // Try to add one more - should fail
      let success = true;
      act(() => {
        success = result.current.addFavorite("BG_100_100");
      });

      expect(success).toBe(false);
      expect(result.current.favoritesCount).toBe(100);
    });
  });

  describe("goals functionality", () => {
    it("should toggle a goal", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      // Toggle on
      act(() => {
        result.current.toggleGoal("goal-1");
      });
      expect(result.current.goals.selectedIds).toContain("goal-1");

      // Toggle off
      act(() => {
        result.current.toggleGoal("goal-1");
      });
      expect(result.current.goals.selectedIds).not.toContain("goal-1");
    });

    it("should set multiple goals", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      act(() => {
        result.current.setGoals(["goal-1", "goal-2"]);
      });

      expect(result.current.goals.selectedIds).toEqual(["goal-1", "goal-2"]);
    });

    it("should clear all goals", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      act(() => {
        result.current.setGoals(["goal-1", "goal-2"]);
      });
      expect(result.current.goals.selectedIds.length).toBe(2);

      act(() => {
        result.current.clearGoals();
      });

      expect(result.current.goals.selectedIds).toEqual([]);
    });

    it("should check if a goal is selected", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      expect(result.current.isGoalSelected("goal-1")).toBe(false);

      act(() => {
        result.current.toggleGoal("goal-1");
      });

      expect(result.current.isGoalSelected("goal-1")).toBe(true);
    });

    it("should resolve goal IDs to Goal objects", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      act(() => {
        result.current.setGoals(["goal-1"]);
      });

      expect(result.current.goals.selectedGoals).toHaveLength(1);
      expect(result.current.goals.selectedGoals[0].id).toBe("goal-1");
      expect(result.current.goals.selectedGoals[0].label).toBe("Goal 1");
    });
  });

  describe("reading functionality", () => {
    it("should save reading position", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      act(() => {
        result.current.saveReadingPosition(2, 47);
      });

      expect(result.current.reading.position).not.toBeNull();
      expect(result.current.reading.position?.chapter).toBe(2);
      expect(result.current.reading.position?.verse).toBe(47);
    });

    it("should set font size", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      act(() => {
        result.current.setFontSize("large");
      });

      expect(result.current.reading.settings.fontSize).toBe("large");
    });

    it("should reset reading progress", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      // Set some reading state first
      act(() => {
        result.current.saveReadingPosition(2, 47);
        result.current.setFontSize("large");
      });
      expect(result.current.reading.position).not.toBeNull();

      // Reset
      act(() => {
        result.current.resetReadingProgress();
      });

      expect(result.current.reading.position).toBeNull();
      expect(result.current.reading.settings.fontSize).toBe("medium");
    });
  });

  describe("sync status", () => {
    it("should provide sync state", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      expect(result.current.sync).toBeDefined();
      expect(result.current.sync.status).toBe("idle");
      expect(result.current.sync.pendingCount).toBe(0);
      expect(result.current.sync.error).toBeNull();
    });

    it("should provide resync function", () => {
      const { result } = renderHook(() => usePreferencesContext(), { wrapper });

      expect(typeof result.current.resync).toBe("function");
    });
  });
});

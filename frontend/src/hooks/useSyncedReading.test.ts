/**
 * Tests for useSyncedReading hook
 *
 * Critical paths:
 * - Anonymous users: Works with localStorage only
 * - Position and settings are persisted
 * - Font size changes are applied
 * - Reset clears all progress
 *
 * TESTING NOTES:
 * See useSyncedFavorites.test.ts for notes on module-level throttle state
 * and sync behavior testing limitations.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock modules before importing the hook
vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
  })),
}));

vi.mock("../lib/api", () => ({
  preferencesApi: {
    merge: vi.fn(),
    update: vi.fn(),
  },
}));

import { useSyncedReading } from "./useSyncedReading";
import { useAuth } from "../contexts/AuthContext";
import { preferencesApi } from "../lib/api";

const READING_POSITION_KEY = "geetanjali:readingPosition";
const READING_SETTINGS_KEY = "geetanjali:readingSettings";

describe("useSyncedReading", () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  const mockPreferencesApi = preferencesApi as {
    merge: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Default to anonymous user
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    mockPreferencesApi.merge.mockResolvedValue({
      reading: { chapter: null, verse: null, font_size: "medium" },
    });
    mockPreferencesApi.update.mockResolvedValue({});
  });

  // ===========================================================================
  // Interface Tests
  // ===========================================================================

  describe("interface", () => {
    it("should expose all required properties and methods", () => {
      const { result } = renderHook(() => useSyncedReading());

      // Properties
      expect(result.current.position).toBeNull(); // Initially null
      expect(result.current.settings).toHaveProperty("fontSize");
      expect(typeof result.current.syncStatus).toBe("string");
      expect(result.current.lastSynced).toBeNull();

      // Methods
      expect(typeof result.current.savePosition).toBe("function");
      expect(typeof result.current.setFontSize).toBe("function");
      expect(typeof result.current.resetProgress).toBe("function");
      expect(typeof result.current.resync).toBe("function");
    });

    it("should have valid syncStatus values", () => {
      const { result } = renderHook(() => useSyncedReading());

      const validStatuses = ["idle", "syncing", "synced", "error"];
      expect(validStatuses).toContain(result.current.syncStatus);
    });
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe("initial state", () => {
    it("should have null position when no saved progress", () => {
      const { result } = renderHook(() => useSyncedReading());

      expect(result.current.position).toBeNull();
    });

    it("should have default font size (medium)", () => {
      const { result } = renderHook(() => useSyncedReading());

      expect(result.current.settings.fontSize).toBe("medium");
    });

    it("should load existing position from localStorage", () => {
      const savedPosition = { chapter: 2, verse: 47, timestamp: Date.now() };
      localStorage.setItem(READING_POSITION_KEY, JSON.stringify(savedPosition));

      const { result } = renderHook(() => useSyncedReading());

      expect(result.current.position?.chapter).toBe(2);
      expect(result.current.position?.verse).toBe(47);
    });

    it("should load existing settings from localStorage", () => {
      localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify({ fontSize: "large" }));

      const { result } = renderHook(() => useSyncedReading());

      expect(result.current.settings.fontSize).toBe("large");
    });
  });

  // ===========================================================================
  // savePosition
  // ===========================================================================

  describe("savePosition", () => {
    it("should save position to state", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.savePosition(3, 19);
      });

      expect(result.current.position?.chapter).toBe(3);
      expect(result.current.position?.verse).toBe(19);
    });

    it("should persist position to localStorage", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.savePosition(4, 7);
      });

      const stored = JSON.parse(localStorage.getItem(READING_POSITION_KEY) || "null");
      expect(stored).not.toBeNull();
      expect(stored.chapter).toBe(4);
      expect(stored.verse).toBe(7);
    });

    it("should update timestamp on save", () => {
      const { result } = renderHook(() => useSyncedReading());

      const beforeSave = Date.now();
      act(() => {
        result.current.savePosition(2, 47);
      });
      const afterSave = Date.now();

      expect(result.current.position?.timestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(result.current.position?.timestamp).toBeLessThanOrEqual(afterSave);
    });
  });

  // ===========================================================================
  // setFontSize
  // ===========================================================================

  describe("setFontSize", () => {
    it("should change font size to small", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.setFontSize("small");
      });

      expect(result.current.settings.fontSize).toBe("small");
    });

    it("should change font size to large", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.setFontSize("large");
      });

      expect(result.current.settings.fontSize).toBe("large");
    });

    it("should persist font size to localStorage", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.setFontSize("small");
      });

      const stored = JSON.parse(localStorage.getItem(READING_SETTINGS_KEY) || "{}");
      expect(stored.fontSize).toBe("small");
    });
  });

  // ===========================================================================
  // resetProgress
  // ===========================================================================

  describe("resetProgress", () => {
    it("should clear position", () => {
      localStorage.setItem(
        READING_POSITION_KEY,
        JSON.stringify({ chapter: 2, verse: 47, timestamp: Date.now() })
      );

      const { result } = renderHook(() => useSyncedReading());
      expect(result.current.position).not.toBeNull();

      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.position).toBeNull();
    });

    it("should reset font size to default", () => {
      localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify({ fontSize: "large" }));

      const { result } = renderHook(() => useSyncedReading());
      expect(result.current.settings.fontSize).toBe("large");

      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.settings.fontSize).toBe("medium");
    });

    it("should clear localStorage", () => {
      localStorage.setItem(
        READING_POSITION_KEY,
        JSON.stringify({ chapter: 2, verse: 47, timestamp: Date.now() })
      );
      localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify({ fontSize: "large" }));

      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.resetProgress();
      });

      expect(localStorage.getItem(READING_POSITION_KEY)).toBeNull();
      expect(localStorage.getItem(READING_SETTINGS_KEY)).toBeNull();
    });
  });

  // ===========================================================================
  // Anonymous User - No API Calls
  // ===========================================================================

  describe("anonymous user", () => {
    it("should have idle sync status", () => {
      const { result } = renderHook(() => useSyncedReading());

      expect(result.current.syncStatus).toBe("idle");
    });

    it("should not call API on position save", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.savePosition(2, 47);
      });

      expect(mockPreferencesApi.merge).not.toHaveBeenCalled();
      expect(mockPreferencesApi.update).not.toHaveBeenCalled();
    });

    it("should not call API on font size change", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.setFontSize("large");
      });

      expect(mockPreferencesApi.merge).not.toHaveBeenCalled();
      expect(mockPreferencesApi.update).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Authenticated User Basics
  // ===========================================================================

  describe("authenticated user basics", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: "user-123", email: "test@example.com" },
      });
    });

    it("should still use localStorage for optimistic updates", () => {
      const { result } = renderHook(() => useSyncedReading());

      act(() => {
        result.current.savePosition(2, 47);
      });

      // Optimistic update should be immediate
      expect(result.current.position?.chapter).toBe(2);
      expect(result.current.position?.verse).toBe(47);

      const stored = JSON.parse(localStorage.getItem(READING_POSITION_KEY) || "null");
      expect(stored).not.toBeNull();
    });
  });

  // ===========================================================================
  // Resync
  // ===========================================================================

  describe("resync", () => {
    it("should be a callable function", () => {
      const { result } = renderHook(() => useSyncedReading());

      expect(typeof result.current.resync).toBe("function");
    });

    it("should return a promise", () => {
      const { result } = renderHook(() => useSyncedReading());

      const resyncResult = result.current.resync();
      expect(resyncResult).toBeInstanceOf(Promise);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle corrupted position data gracefully", () => {
      localStorage.setItem(READING_POSITION_KEY, "not-valid-json");

      const { result } = renderHook(() => useSyncedReading());

      // Should recover gracefully
      expect(result.current.position).toBeNull();
    });

    it("should handle corrupted settings data gracefully", () => {
      localStorage.setItem(READING_SETTINGS_KEY, "not-valid-json");

      const { result } = renderHook(() => useSyncedReading());

      // Should fall back to defaults
      expect(result.current.settings.fontSize).toBe("medium");
    });

    it("should handle partial settings gracefully", () => {
      localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify({}));

      const { result } = renderHook(() => useSyncedReading());

      // Should use default
      expect(result.current.settings.fontSize).toBe("medium");
    });
  });
});

/**
 * DOCUMENTED EXCEPTION: Sync Behavior Testing
 *
 * See useSyncedFavorites.test.ts for explanation of sync testing limitations.
 */

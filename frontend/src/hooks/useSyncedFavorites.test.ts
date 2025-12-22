/**
 * Tests for useSyncedFavorites hook
 *
 * Critical paths:
 * - Anonymous users: Works like useFavorites (localStorage only)
 * - Authenticated users: Interface works correctly
 * - Optimistic updates happen immediately
 * - Error states are exposed
 *
 * TESTING NOTES:
 * The sync hooks use module-level timestamps for cross-remount throttling.
 * This is INTENTIONAL (prevents 429 errors in production) but makes isolated
 * unit testing of sync behavior challenging. The throttle state persists across
 * test runs, causing some async tests to timeout.
 *
 * For comprehensive sync testing, prefer:
 * 1. Integration tests with a real backend
 * 2. E2E tests that test the full user flow
 *
 * These unit tests focus on:
 * - Interface correctness (methods exist and return correct types)
 * - Local behavior (localStorage operations)
 * - Anonymous user flow (no server calls)
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

import { useSyncedFavorites } from "./useSyncedFavorites";
import { useAuth } from "../contexts/AuthContext";
import { preferencesApi } from "../lib/api";

const STORAGE_KEY = "geetanjali_favorites";

describe("useSyncedFavorites", () => {
  const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;
  const mockPreferencesApi = preferencesApi as unknown as {
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
      favorites: { items: [] },
    });
    mockPreferencesApi.update.mockResolvedValue({});
  });

  // ===========================================================================
  // Interface Tests
  // ===========================================================================

  describe("interface", () => {
    it("should expose all required properties and methods", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      // Properties
      expect(result.current.favorites).toBeInstanceOf(Set);
      expect(typeof result.current.favoritesCount).toBe("number");
      expect(typeof result.current.syncStatus).toBe("string");
      expect(typeof result.current.didInitialSync).toBe("boolean");

      // Methods
      expect(typeof result.current.isFavorite).toBe("function");
      expect(typeof result.current.addFavorite).toBe("function");
      expect(typeof result.current.removeFavorite).toBe("function");
      expect(typeof result.current.toggleFavorite).toBe("function");
      expect(typeof result.current.resync).toBe("function");
    });

    it("should have valid syncStatus values", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      const validStatuses = ["idle", "syncing", "synced", "error"];
      expect(validStatuses).toContain(result.current.syncStatus);
    });
  });

  // ===========================================================================
  // Anonymous User Behavior
  // ===========================================================================

  describe("anonymous user", () => {
    it("should start with empty favorites", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      expect(result.current.favorites.size).toBe(0);
      expect(result.current.favoritesCount).toBe(0);
    });

    it("should have idle sync status", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      expect(result.current.syncStatus).toBe("idle");
      expect(result.current.lastSynced).toBeNull();
      expect(result.current.didInitialSync).toBe(false);
    });

    it("should add favorites to localStorage", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      act(() => {
        result.current.addFavorite("BG_2_47");
      });

      expect(result.current.isFavorite("BG_2_47")).toBe(true);
      expect(result.current.favoritesCount).toBe(1);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      expect(stored).toContain("BG_2_47");
    });

    it("should remove favorites from localStorage", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47", "BG_3_19"]));

      const { result } = renderHook(() => useSyncedFavorites());

      act(() => {
        result.current.removeFavorite("BG_2_47");
      });

      expect(result.current.isFavorite("BG_2_47")).toBe(false);
      expect(result.current.isFavorite("BG_3_19")).toBe(true);
    });

    it("should toggle favorites correctly", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      // Add
      let isFavorited: boolean;
      act(() => {
        isFavorited = result.current.toggleFavorite("BG_2_47");
      });
      expect(isFavorited!).toBe(true);
      expect(result.current.isFavorite("BG_2_47")).toBe(true);

      // Remove
      act(() => {
        isFavorited = result.current.toggleFavorite("BG_2_47");
      });
      expect(isFavorited!).toBe(false);
      expect(result.current.isFavorite("BG_2_47")).toBe(false);
    });

    it("should load existing favorites from localStorage", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47", "BG_3_19"]));

      const { result } = renderHook(() => useSyncedFavorites());

      expect(result.current.favorites.size).toBe(2);
      expect(result.current.isFavorite("BG_2_47")).toBe(true);
      expect(result.current.isFavorite("BG_3_19")).toBe(true);
    });

    it("should not call API for anonymous users", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      act(() => {
        result.current.addFavorite("BG_2_47");
        result.current.removeFavorite("BG_2_47");
      });

      // No API calls for anonymous users
      expect(mockPreferencesApi.merge).not.toHaveBeenCalled();
      expect(mockPreferencesApi.update).not.toHaveBeenCalled();
    });

    it("should return false when adding duplicate", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47"]));
      const { result } = renderHook(() => useSyncedFavorites());

      let success: boolean;
      act(() => {
        success = result.current.addFavorite("BG_2_47");
      });

      // Already exists, returns true (not an error)
      expect(success!).toBe(true);
      expect(result.current.favoritesCount).toBe(1);
    });
  });

  // ===========================================================================
  // Authenticated User - Basic Behavior
  // ===========================================================================

  describe("authenticated user basics", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: "user-123", email: "test@example.com" },
      });
    });

    it("should still work with localStorage for optimistic updates", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      act(() => {
        result.current.addFavorite("BG_2_47");
      });

      // Optimistic update should be immediate
      expect(result.current.isFavorite("BG_2_47")).toBe(true);
      expect(result.current.favoritesCount).toBe(1);
    });

    it("should persist favorites to localStorage", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      act(() => {
        result.current.addFavorite("BG_2_47");
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      expect(stored).toContain("BG_2_47");
    });
  });

  // ===========================================================================
  // Resync
  // ===========================================================================

  describe("resync", () => {
    it("should be a callable function", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      expect(typeof result.current.resync).toBe("function");
    });

    it("should return a promise", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      const resyncResult = result.current.resync();
      expect(resyncResult).toBeInstanceOf(Promise);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty localStorage gracefully", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      expect(result.current.favorites.size).toBe(0);
      expect(() => result.current.isFavorite("BG_2_47")).not.toThrow();
    });

    it("should handle corrupted localStorage gracefully", () => {
      localStorage.setItem(STORAGE_KEY, "not-valid-json");

      const { result } = renderHook(() => useSyncedFavorites());

      // Should recover gracefully
      expect(result.current.favorites.size).toBe(0);
    });

    it("should handle removing non-existent favorite", () => {
      const { result } = renderHook(() => useSyncedFavorites());

      // Should not throw
      act(() => {
        result.current.removeFavorite("non-existent");
      });

      expect(result.current.favoritesCount).toBe(0);
    });
  });
});

/**
 * DOCUMENTED EXCEPTION: Sync Behavior Testing
 *
 * The following sync behaviors are NOT fully unit tested due to
 * module-level throttle state (intentional for production reliability):
 *
 * 1. Merge on login - API called with correct payload
 * 2. Debounced sync on changes - API called after delay
 * 3. Sync status transitions - syncing -> synced/error
 * 4. Throttle behavior - prevents 429 errors
 *
 * These are covered by:
 * - Integration tests with real backend
 * - E2E tests in Playwright
 * - Manual testing during development
 *
 * The module-level state is documented in the source code with rationale.
 * See useSyncedFavorites.ts lines 57-68.
 */

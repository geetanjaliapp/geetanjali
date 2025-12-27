/**
 * Tests for useFavorites hook
 *
 * Critical paths:
 * - Add/remove favorites persists to localStorage
 * - Toggle favorite works correctly
 * - Max favorites limit is enforced
 * - Favorites are loaded from localStorage on mount
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFavorites } from "./useFavorites";

const STORAGE_KEY = "geetanjali_favorites";

describe("useFavorites", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Mock console methods
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("initial state", () => {
    it("should start with empty favorites when localStorage is empty", () => {
      const { result } = renderHook(() => useFavorites());

      expect(result.current.favorites.size).toBe(0);
      expect(result.current.favoritesCount).toBe(0);
    });

    it("should load existing favorites from localStorage", () => {
      // Pre-populate localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47", "BG_3_19"]));

      const { result } = renderHook(() => useFavorites());

      expect(result.current.favorites.size).toBe(2);
      expect(result.current.isFavorite("BG_2_47")).toBe(true);
      expect(result.current.isFavorite("BG_3_19")).toBe(true);
    });

    it("should handle corrupted localStorage gracefully", () => {
      localStorage.setItem(STORAGE_KEY, "not-valid-json");

      const { result } = renderHook(() => useFavorites());

      expect(result.current.favorites.size).toBe(0);
    });
  });

  describe("addFavorite", () => {
    it("should add a verse to favorites", () => {
      const { result } = renderHook(() => useFavorites());

      act(() => {
        result.current.addFavorite("BG_2_47");
      });

      expect(result.current.isFavorite("BG_2_47")).toBe(true);
      expect(result.current.favoritesCount).toBe(1);
    });

    it("should persist favorites to localStorage", () => {
      const { result } = renderHook(() => useFavorites());

      act(() => {
        result.current.addFavorite("BG_2_47");
      });

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBe(JSON.stringify(["BG_2_47"]));
    });

    it("should return true if verse is already favorited", () => {
      const { result } = renderHook(() => useFavorites());

      act(() => {
        result.current.addFavorite("BG_2_47");
      });

      let returnValue: boolean;
      act(() => {
        returnValue = result.current.addFavorite("BG_2_47");
      });

      expect(returnValue!).toBe(true);
      expect(result.current.favoritesCount).toBe(1); // Still 1, not 2
    });
  });

  describe("removeFavorite", () => {
    it("should remove a verse from favorites", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47"]));
      const { result } = renderHook(() => useFavorites());

      act(() => {
        result.current.removeFavorite("BG_2_47");
      });

      expect(result.current.isFavorite("BG_2_47")).toBe(false);
      expect(result.current.favoritesCount).toBe(0);
    });

    it("should persist removal to localStorage", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47", "BG_3_19"]));
      const { result } = renderHook(() => useFavorites());

      act(() => {
        result.current.removeFavorite("BG_2_47");
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      expect(stored).toEqual(["BG_3_19"]);
    });
  });

  describe("toggleFavorite", () => {
    it("should add verse when not favorited", () => {
      const { result } = renderHook(() => useFavorites());

      let isFavorited: boolean;
      act(() => {
        isFavorited = result.current.toggleFavorite("BG_2_47");
      });

      expect(isFavorited!).toBe(true);
      expect(result.current.isFavorite("BG_2_47")).toBe(true);
    });

    it("should remove verse when already favorited", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47"]));
      const { result } = renderHook(() => useFavorites());

      let isFavorited: boolean;
      act(() => {
        isFavorited = result.current.toggleFavorite("BG_2_47");
      });

      expect(isFavorited!).toBe(false);
      expect(result.current.isFavorite("BG_2_47")).toBe(false);
    });
  });

  describe("clearFavorites", () => {
    it("should remove all favorites", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(["BG_2_47", "BG_3_19", "BG_4_7"]),
      );
      const { result } = renderHook(() => useFavorites());

      expect(result.current.favoritesCount).toBe(3);

      act(() => {
        result.current.clearFavorites();
      });

      expect(result.current.favoritesCount).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
    });
  });

  describe("isFavorite", () => {
    it("should return true for favorited verses", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["BG_2_47"]));
      const { result } = renderHook(() => useFavorites());

      expect(result.current.isFavorite("BG_2_47")).toBe(true);
    });

    it("should return false for non-favorited verses", () => {
      const { result } = renderHook(() => useFavorites());

      expect(result.current.isFavorite("BG_2_47")).toBe(false);
    });
  });

  describe("max favorites limit", () => {
    it("should enforce max favorites limit (100)", () => {
      // Pre-populate with 100 favorites
      const existingFavorites = Array.from(
        { length: 100 },
        (_, i) => `BG_${i}_1`,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingFavorites));

      const { result } = renderHook(() => useFavorites());
      expect(result.current.favoritesCount).toBe(100);

      // Try to add one more
      let success: boolean;
      act(() => {
        success = result.current.addFavorite("BG_NEW_1");
      });

      expect(success!).toBe(false);
      expect(result.current.favoritesCount).toBe(100);
      expect(result.current.isFavorite("BG_NEW_1")).toBe(false);
    });
  });
});

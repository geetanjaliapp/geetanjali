/**
 * PreferencesStorage Tests
 *
 * Tests for localStorage operations and schema migration.
 * Ensures backward compatibility with old storage formats.
 *
 * Part of v1.17.3 preference sync improvements.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { preferencesStorage, normalizeFontSize } from "./preferencesStorage";
import { STORAGE_KEYS } from "./storage";

describe("preferencesStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("schema migration - favorites", () => {
    it("should read new object format with items array", () => {
      const data = {
        items: ["BG_1_1", "BG_2_47"],
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(data));

      const result = preferencesStorage.getFavorites();

      expect(result).toEqual(["BG_1_1", "BG_2_47"]);
    });

    it("should migrate legacy array format to array", () => {
      // Old format: just an array of IDs
      const legacyData = ["BG_1_1", "BG_2_47", "BG_3_1"];
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(legacyData));

      const result = preferencesStorage.getFavorites();

      expect(result).toEqual(["BG_1_1", "BG_2_47", "BG_3_1"]);
    });

    it("should return empty array for missing data", () => {
      const result = preferencesStorage.getFavorites();

      expect(result).toEqual([]);
    });

    it("should return empty array for invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.favorites, "not valid json");

      const result = preferencesStorage.getFavorites();

      expect(result).toEqual([]);
    });

    it("should write new object format with timestamp", () => {
      preferencesStorage.setFavorites(["BG_1_1"]);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites)!);

      expect(stored.items).toEqual(["BG_1_1"]);
      expect(stored.updatedAt).toBeDefined();
    });
  });

  describe("schema migration - goals", () => {
    it("should read new object format with goalIds", () => {
      const data = {
        goalIds: ["goal-1", "goal-2"],
        selectedAt: "2024-01-01T00:00:00.000Z",
      };
      localStorage.setItem(STORAGE_KEYS.learningGoals, JSON.stringify(data));

      const result = preferencesStorage.getGoals();

      expect(result?.goalIds).toEqual(["goal-1", "goal-2"]);
      expect(result?.selectedAt).toBeDefined();
    });

    it("should migrate legacy array format", () => {
      // Old format: just an array of goal IDs
      const legacyData = ["goal-1", "goal-2"];
      localStorage.setItem(STORAGE_KEYS.learningGoals, JSON.stringify(legacyData));

      const result = preferencesStorage.getGoals();

      expect(result?.goalIds).toEqual(["goal-1", "goal-2"]);
      expect(result?.selectedAt).toBeDefined(); // Should have a generated timestamp
    });

    it("should handle snake_case keys from server format", () => {
      // Server format uses snake_case
      const serverFormat = {
        goal_ids: ["goal-1"],
        selected_at: "2024-01-01T00:00:00.000Z",
      };
      localStorage.setItem(STORAGE_KEYS.learningGoals, JSON.stringify(serverFormat));

      const result = preferencesStorage.getGoals();

      expect(result?.goalIds).toEqual(["goal-1"]);
    });

    it("should return null for missing data", () => {
      const result = preferencesStorage.getGoals();

      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.learningGoals, "invalid");

      const result = preferencesStorage.getGoals();

      expect(result).toBeNull();
    });
  });

  describe("schema migration - reading", () => {
    it("should read reading position", () => {
      const data = { chapter: 2, verse: 47, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEYS.readingPosition, JSON.stringify(data));

      const result = preferencesStorage.getReadingPosition();

      expect(result?.chapter).toBe(2);
      expect(result?.verse).toBe(47);
    });

    it("should return null for missing position", () => {
      const result = preferencesStorage.getReadingPosition();

      expect(result).toBeNull();
    });

    it("should read reading settings with default", () => {
      const result = preferencesStorage.getReadingSettings();

      expect(result.fontSize).toBe("regular");
    });

    it("should read stored reading settings", () => {
      localStorage.setItem(
        STORAGE_KEYS.readingSettings,
        JSON.stringify({ fontSize: "large" })
      );

      const result = preferencesStorage.getReadingSettings();

      expect(result.fontSize).toBe("large");
    });

    it("should migrate 'medium' fontSize to 'regular'", () => {
      localStorage.setItem(
        STORAGE_KEYS.readingSettings,
        JSON.stringify({ fontSize: "medium" })
      );

      const result = preferencesStorage.getReadingSettings();

      expect(result.fontSize).toBe("regular");
    });

    it("should migrate 'normal' fontSize to 'regular'", () => {
      localStorage.setItem(
        STORAGE_KEYS.readingSettings,
        JSON.stringify({ fontSize: "normal" })
      );

      const result = preferencesStorage.getReadingSettings();

      expect(result.fontSize).toBe("regular");
    });
  });

  describe("schema migration - theme", () => {
    it("should read valid theme mode", () => {
      localStorage.setItem(STORAGE_KEYS.theme, "dark");

      const result = preferencesStorage.getThemeMode();

      expect(result).toBe("dark");
    });

    it("should default to system for invalid theme", () => {
      localStorage.setItem(STORAGE_KEYS.theme, "invalid");

      const result = preferencesStorage.getThemeMode();

      expect(result).toBe("system");
    });

    it("should default to system for missing theme", () => {
      const result = preferencesStorage.getThemeMode();

      expect(result).toBe("system");
    });

    it("should read font family with default", () => {
      const result = preferencesStorage.getFontFamily();

      expect(result).toBe("mixed");
    });

    it("should read valid font family", () => {
      localStorage.setItem(STORAGE_KEYS.fontFamily, "serif");

      const result = preferencesStorage.getFontFamily();

      expect(result).toBe("serif");
    });
  });

  describe("getAllForMerge", () => {
    it("should collect all preferences for merge request", () => {
      // Set up various preferences
      preferencesStorage.setFavorites(["BG_1_1"]);
      preferencesStorage.setGoals(["goal-1"]);
      preferencesStorage.setReadingPosition({ chapter: 2, verse: 47, timestamp: Date.now() });
      preferencesStorage.setThemeMode("dark");

      const result = preferencesStorage.getAllForMerge();

      expect(result.favorites?.items).toEqual(["BG_1_1"]);
      expect(result.learning_goals?.goal_ids).toEqual(["goal-1"]);
      expect(result.reading?.chapter).toBe(2);
      expect(result.theme?.mode).toBe("dark");
    });

    it("should handle empty preferences", () => {
      const result = preferencesStorage.getAllForMerge();

      expect(result.favorites?.items).toEqual([]);
      expect(result.learning_goals?.goal_ids).toBeUndefined();
      expect(result.reading?.chapter).toBeUndefined();
      expect(result.theme?.mode).toBe("system");
    });
  });
});

describe("normalizeFontSize", () => {
  it("should pass through valid font sizes", () => {
    expect(normalizeFontSize("small")).toBe("small");
    expect(normalizeFontSize("regular")).toBe("regular");
    expect(normalizeFontSize("large")).toBe("large");
  });

  it("should migrate 'medium' to 'regular'", () => {
    expect(normalizeFontSize("medium")).toBe("regular");
  });

  it("should migrate 'normal' to 'regular'", () => {
    expect(normalizeFontSize("normal")).toBe("regular");
  });

  it("should default to 'regular' for null/undefined", () => {
    expect(normalizeFontSize(null)).toBe("regular");
    expect(normalizeFontSize(undefined)).toBe("regular");
  });

  it("should default to 'regular' for invalid values", () => {
    expect(normalizeFontSize("invalid")).toBe("regular");
    expect(normalizeFontSize(123)).toBe("regular");
    expect(normalizeFontSize({})).toBe("regular");
  });
});

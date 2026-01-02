/**
 * Preferences Storage Helper
 *
 * Consolidates all localStorage read/write operations for user preferences.
 * Provides type-safe access and centralized timestamp tracking.
 *
 * Part of v1.17.3 preference sync improvements.
 */

import type { LocalPreferences, UserPreferences } from "../types";
import { STORAGE_KEYS, getStorageItem, setStorageItem } from "./storage";

// ============================================================================
// TYPES
// ============================================================================

export interface ReadingPosition {
  chapter: number;
  verse: number;
  timestamp: number;
}

export interface ReadingSettings {
  fontSize: "small" | "medium" | "large";
}

export type FontSize = "small" | "medium" | "large";
export type Theme = "light" | "dark" | "system";
export type FontFamily = "serif" | "sans" | "mixed";

interface GoalsData {
  goalIds: string[];
  selectedAt: string;
}

// ============================================================================
// PREFERENCES STORAGE
// ============================================================================

export const preferencesStorage = {
  // ══════════════════════════════════════════════════════════════════════════
  // FAVORITES
  // ══════════════════════════════════════════════════════════════════════════

  getFavorites(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.favorites);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Handle both array and object formats
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
          return parsed.items;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  },

  setFavorites(items: string[]): void {
    try {
      // Store with timestamp for merge
      const data = {
        items,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  },

  getFavoritesUpdatedAt(): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.favorites);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && parsed.updatedAt) {
          return parsed.updatedAt;
        }
      }
    } catch {
      // Ignore
    }
    return null;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEARNING GOALS
  // ══════════════════════════════════════════════════════════════════════════

  getGoals(): GoalsData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.learningGoals);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Handle both array and object formats
        if (Array.isArray(parsed)) {
          return { goalIds: parsed, selectedAt: new Date().toISOString() };
        }
        if (parsed && typeof parsed === "object") {
          return {
            goalIds: parsed.goalIds || parsed.goal_ids || [],
            selectedAt: parsed.selectedAt || parsed.selected_at || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Ignore
    }
    return null;
  },

  setGoals(goalIds: string[]): void {
    try {
      const data = {
        goalIds,
        selectedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.learningGoals, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // READING
  // ══════════════════════════════════════════════════════════════════════════

  getReadingPosition(): ReadingPosition | null {
    return getStorageItem<ReadingPosition | null>(STORAGE_KEYS.readingPosition, null);
  },

  setReadingPosition(position: ReadingPosition): void {
    setStorageItem(STORAGE_KEYS.readingPosition, position);
  },

  getReadingSettings(): ReadingSettings {
    return getStorageItem<ReadingSettings>(STORAGE_KEYS.readingSettings, {
      fontSize: "medium",
    });
  },

  setReadingSettings(settings: ReadingSettings): void {
    setStorageItem(STORAGE_KEYS.readingSettings, settings);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // THEME
  // ══════════════════════════════════════════════════════════════════════════

  getThemeMode(): Theme {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return "system";
  },

  setThemeMode(mode: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEYS.theme, mode);
      localStorage.setItem(STORAGE_KEYS.themeUpdatedAt, new Date().toISOString());
    } catch {
      // Ignore
    }
  },

  getThemeId(): string {
    return localStorage.getItem(STORAGE_KEYS.themeId) || "default";
  },

  setThemeId(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.themeId, id);
      localStorage.setItem(STORAGE_KEYS.themeUpdatedAt, new Date().toISOString());
    } catch {
      // Ignore
    }
  },

  getFontFamily(): FontFamily {
    const stored = localStorage.getItem(STORAGE_KEYS.fontFamily);
    if (stored === "serif" || stored === "sans" || stored === "mixed") {
      return stored;
    }
    return "mixed";
  },

  setFontFamily(family: FontFamily): void {
    try {
      localStorage.setItem(STORAGE_KEYS.fontFamily, family);
      localStorage.setItem(STORAGE_KEYS.themeUpdatedAt, new Date().toISOString());
    } catch {
      // Ignore
    }
  },

  getThemeUpdatedAt(): string | null {
    return localStorage.getItem(STORAGE_KEYS.themeUpdatedAt);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BULK OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get all local preferences for merge request.
   */
  getAllForMerge(): LocalPreferences {
    const favorites = this.getFavorites();
    const favoritesUpdatedAt = this.getFavoritesUpdatedAt();
    const goals = this.getGoals();
    const position = this.getReadingPosition();
    const settings = this.getReadingSettings();
    const themeMode = this.getThemeMode();
    const themeId = this.getThemeId();
    const fontFamily = this.getFontFamily();
    const themeUpdatedAt = this.getThemeUpdatedAt();

    return {
      favorites: {
        items: favorites,
        updated_at: favoritesUpdatedAt || undefined,
      },
      reading: {
        chapter: position?.chapter,
        verse: position?.verse,
        font_size: settings.fontSize,
        updated_at: position ? new Date(position.timestamp).toISOString() : undefined,
      },
      learning_goals: {
        goal_ids: goals?.goalIds,
        updated_at: goals?.selectedAt,
      },
      theme: {
        mode: themeMode,
        theme_id: themeId,
        font_family: fontFamily,
        updated_at: themeUpdatedAt || undefined,
      },
    };
  },

  /**
   * Apply merged preferences from server.
   */
  applyMergeResult(result: UserPreferences): void {
    // Favorites
    if (result.favorites?.items) {
      this.setFavorites(result.favorites.items);
    }

    // Goals
    if (result.learning_goals?.goal_ids) {
      this.setGoals(result.learning_goals.goal_ids);
    }

    // Reading
    if (result.reading) {
      if (result.reading.chapter != null) {
        this.setReadingPosition({
          chapter: result.reading.chapter,
          verse: result.reading.verse ?? 1,
          timestamp: Date.now(),
        });
      }
      if (result.reading.font_size) {
        this.setReadingSettings({
          fontSize: result.reading.font_size as FontSize,
        });
      }
    }

    // Theme
    if (result.theme) {
      if (result.theme.mode) {
        this.setThemeMode(result.theme.mode as Theme);
      }
      if (result.theme.theme_id) {
        this.setThemeId(result.theme.theme_id);
      }
      if (result.theme.font_family) {
        this.setFontFamily(result.theme.font_family as FontFamily);
      }
    }
  },
};

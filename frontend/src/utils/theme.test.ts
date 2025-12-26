import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isValidColor,
  validateTheme,
  themeToCss,
  applyTheme,
  removeTheme,
  saveThemeToStorage,
  loadThemeFromStorage,
} from "./theme";
import type { ThemeConfig } from "../types/theme";

describe("theme utilities", () => {
  describe("isValidColor", () => {
    it("should accept valid 3-digit hex colors", () => {
      expect(isValidColor("#fff")).toBe(true);
      expect(isValidColor("#FFF")).toBe(true);
      expect(isValidColor("#abc")).toBe(true);
    });

    it("should accept valid 6-digit hex colors", () => {
      expect(isValidColor("#ffffff")).toBe(true);
      expect(isValidColor("#FFFFFF")).toBe(true);
      expect(isValidColor("#ea580c")).toBe(true);
    });

    it("should accept valid 8-digit hex colors (with alpha)", () => {
      expect(isValidColor("#ffffff00")).toBe(true);
      expect(isValidColor("#ea580cff")).toBe(true);
    });

    it("should accept valid rgb colors", () => {
      expect(isValidColor("rgb(255, 255, 255)")).toBe(true);
      expect(isValidColor("rgb(234, 88, 12)")).toBe(true);
    });

    it("should accept valid rgba colors", () => {
      expect(isValidColor("rgba(255, 255, 255, 0.5)")).toBe(true);
      expect(isValidColor("rgba(234, 88, 12, 1)")).toBe(true);
    });

    it("should accept valid hsl colors", () => {
      expect(isValidColor("hsl(0, 100%, 50%)")).toBe(true);
      expect(isValidColor("hsl(180, 50%, 75%)")).toBe(true);
    });

    it("should accept valid hsla colors", () => {
      expect(isValidColor("hsla(0, 100%, 50%, 0.5)")).toBe(true);
      expect(isValidColor("hsla(180, 50%, 75%, 1)")).toBe(true);
    });

    it("should accept CSS variable references", () => {
      expect(isValidColor("var(--color-primary-500)")).toBe(true);
      expect(isValidColor("var(--surface-warm)")).toBe(true);
    });

    it("should reject invalid color formats", () => {
      expect(isValidColor("red")).toBe(false); // Named colors not supported
      expect(isValidColor("#gg0000")).toBe(false); // Invalid hex
      expect(isValidColor("#12345")).toBe(false); // Wrong length
      expect(isValidColor("")).toBe(false);
      expect(isValidColor("not-a-color")).toBe(false);
      // Note: rgb() format check is lenient - just validates structure, not values
    });
  });

  describe("validateTheme", () => {
    it("should validate a minimal valid theme", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
      };

      const result = validateTheme(theme);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a theme with colors", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: {
          primary: {
            500: "#ea580c",
            600: "#dc2626",
          },
        },
      };

      const result = validateTheme(theme);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject theme without id", () => {
      const theme = {
        name: "Test Theme",
      } as ThemeConfig;

      const result = validateTheme(theme);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Theme must have a valid 'id' string");
    });

    it("should reject theme without name", () => {
      const theme = {
        id: "test-theme",
      } as ThemeConfig;

      const result = validateTheme(theme);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Theme must have a valid 'name' string");
    });

    it("should reject theme with invalid color values", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: {
          primary: {
            500: "invalid-color",
          },
        },
      };

      const result = validateTheme(theme);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid color value for primary.500");
    });

    it("should validate theme with typography", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        typography: {
          display: "Georgia, serif",
          body: "system-ui, sans-serif",
        },
      };

      const result = validateTheme(theme);
      expect(result.valid).toBe(true);
    });
  });

  describe("themeToCss", () => {
    it("should generate CSS for color overrides", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: {
          primary: {
            500: "#ea580c",
            600: "#dc2626",
          },
        },
      };

      const css = themeToCss(theme);
      expect(css).toContain("--color-primary-500: #ea580c;");
      expect(css).toContain("--color-primary-600: #dc2626;");
    });

    it("should generate CSS for typography overrides", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        typography: {
          display: "Georgia, serif",
          body: "system-ui, sans-serif",
        },
      };

      const css = themeToCss(theme);
      expect(css).toContain("--font-family-display: Georgia, serif;");
      expect(css).toContain("--font-family-body: system-ui, sans-serif;");
    });

    it("should generate CSS for radius overrides", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        radius: {
          sm: "0.25rem",
          md: "0.5rem",
        },
      };

      const css = themeToCss(theme);
      expect(css).toContain("--radius-sm: 0.25rem;");
      expect(css).toContain("--radius-md: 0.5rem;");
    });

    it("should generate CSS for spacing unit override", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        spacing: {
          unit: "0.5rem",
        },
      };

      const css = themeToCss(theme);
      expect(css).toContain("--spacing-unit: 0.5rem;");
    });

    it("should return empty string for theme without overrides", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
      };

      const css = themeToCss(theme);
      expect(css).toBe("");
    });
  });

  describe("applyTheme and removeTheme", () => {
    beforeEach(() => {
      // Clean up any existing theme style elements
      const existing = document.getElementById("custom-theme-overrides");
      if (existing) {
        existing.remove();
      }
    });

    afterEach(() => {
      removeTheme();
    });

    it("should inject a style element with theme CSS", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: {
          primary: {
            500: "#ea580c",
          },
        },
      };

      applyTheme(theme);

      const styleEl = document.getElementById("custom-theme-overrides");
      expect(styleEl).not.toBeNull();
      expect(styleEl?.textContent).toContain("--color-primary-500: #ea580c;");
    });

    it("should not inject style for default theme", () => {
      const theme: ThemeConfig = {
        id: "default",
        name: "Default",
      };

      applyTheme(theme);

      const styleEl = document.getElementById("custom-theme-overrides");
      expect(styleEl).toBeNull();
    });

    it("should not inject style for null theme", () => {
      applyTheme(null);

      const styleEl = document.getElementById("custom-theme-overrides");
      expect(styleEl).toBeNull();
    });

    it("should remove existing theme when applying new one", () => {
      const theme1: ThemeConfig = {
        id: "theme-1",
        name: "Theme 1",
        colors: { primary: { 500: "#ff0000" } },
      };
      const theme2: ThemeConfig = {
        id: "theme-2",
        name: "Theme 2",
        colors: { primary: { 500: "#00ff00" } },
      };

      applyTheme(theme1);
      applyTheme(theme2);

      const styleEls = document.querySelectorAll("#custom-theme-overrides");
      expect(styleEls).toHaveLength(1);
      expect(styleEls[0].textContent).toContain("#00ff00");
      expect(styleEls[0].textContent).not.toContain("#ff0000");
    });

    it("should remove theme style element", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: { primary: { 500: "#ea580c" } },
      };

      applyTheme(theme);
      expect(document.getElementById("custom-theme-overrides")).not.toBeNull();

      removeTheme();
      expect(document.getElementById("custom-theme-overrides")).toBeNull();
    });
  });

  describe("saveThemeToStorage and loadThemeFromStorage", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should save theme to localStorage", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: { primary: { 500: "#ea580c" } },
      };

      saveThemeToStorage(theme);

      const stored = localStorage.getItem("geetanjali:custom-theme");
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(theme);
    });

    it("should not save default theme", () => {
      const theme: ThemeConfig = {
        id: "default",
        name: "Default",
      };

      saveThemeToStorage(theme);

      const stored = localStorage.getItem("geetanjali:custom-theme");
      expect(stored).toBeNull();
    });

    it("should remove theme when saving null", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
      };

      saveThemeToStorage(theme);
      expect(localStorage.getItem("geetanjali:custom-theme")).not.toBeNull();

      saveThemeToStorage(null);
      expect(localStorage.getItem("geetanjali:custom-theme")).toBeNull();
    });

    it("should load theme from localStorage", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: { primary: { 500: "#ea580c" } },
      };

      localStorage.setItem("geetanjali:custom-theme", JSON.stringify(theme));

      const loaded = loadThemeFromStorage();
      expect(loaded).toEqual(theme);
    });

    it("should return null when no theme stored", () => {
      const loaded = loadThemeFromStorage();
      expect(loaded).toBeNull();
    });

    it("should return null and clear invalid theme from storage", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Store invalid theme (missing required fields)
      localStorage.setItem(
        "geetanjali:custom-theme",
        JSON.stringify({ invalid: true })
      );

      const loaded = loadThemeFromStorage();
      expect(loaded).toBeNull();
      expect(localStorage.getItem("geetanjali:custom-theme")).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should return null and clear corrupted JSON from storage", () => {
      localStorage.setItem("geetanjali:custom-theme", "not-valid-json");

      const loaded = loadThemeFromStorage();
      expect(loaded).toBeNull();
      expect(localStorage.getItem("geetanjali:custom-theme")).toBeNull();
    });
  });
});

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
    it.each([
      // Hex formats
      ["#fff", true],
      ["#FFF", true],
      ["#ffffff", true],
      ["#ea580c", true],
      ["#ffffff00", true],
      // RGB/RGBA
      ["rgb(255, 255, 255)", true],
      ["rgba(234, 88, 12, 0.5)", true],
      // HSL/HSLA
      ["hsl(0, 100%, 50%)", true],
      ["hsla(180, 50%, 75%, 1)", true],
      // CSS variables
      ["var(--color-primary-500)", true],
      // Invalid formats
      ["red", false], // Named colors not supported
      ["#gg0000", false],
      ["#12345", false],
      ["", false],
      ["not-a-color", false],
    ])("isValidColor(%s) should return %s", (color, expected) => {
      expect(isValidColor(color)).toBe(expected);
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

    it("should validate theme with modeColors", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        modeColors: {
          light: {
            primary: { 500: "#ea580c" },
          },
          dark: {
            primary: { 500: "#f97316" },
          },
        },
      };

      const result = validateTheme(theme);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid modeColors values", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        modeColors: {
          dark: {
            primary: { 500: "not-a-color" },
          },
        },
      };

      const result = validateTheme(theme);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("modeColors.dark.primary.500");
    });
  });

  describe("themeToCss", () => {
    it("should generate CSS for various override types", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: { primary: { 500: "#ea580c" } },
        typography: { display: "Georgia, serif" },
        radius: { sm: "0.25rem" },
        spacing: { unit: "0.5rem" },
      };

      const css = themeToCss(theme);
      expect(css).toContain("--color-primary-500: #ea580c;");
      expect(css).toContain("--font-family-display: Georgia, serif;");
      expect(css).toContain("--radius-sm: 0.25rem;");
      expect(css).toContain("--spacing-unit: 0.5rem;");
    });

    it("should return empty string for theme without overrides", () => {
      const theme: ThemeConfig = { id: "test-theme", name: "Test Theme" };
      expect(themeToCss(theme)).toBe("");
    });

    it("should generate :root and .dark blocks for modeColors", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        colors: { warm: { 100: "#fef3c7" } }, // Shared
        modeColors: {
          light: { primary: { 500: "#ea580c" } },
          dark: { primary: { 500: "#f97316" } },
        },
      };

      const css = themeToCss(theme);
      expect(css).toContain(":root {");
      expect(css).toContain(".dark {");
      expect(css).toContain("--color-warm-100: #fef3c7;");
      // Light colors before .dark block
      expect(css.indexOf("--color-primary-500: #ea580c;")).toBeLessThan(
        css.indexOf(".dark {"),
      );
      // Dark colors after .dark block
      expect(css.indexOf("--color-primary-500: #f97316;")).toBeGreaterThan(
        css.indexOf(".dark {"),
      );
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

    it("should inject style with both :root and .dark for modeColors", () => {
      const theme: ThemeConfig = {
        id: "test-theme",
        name: "Test Theme",
        modeColors: {
          light: {
            primary: { 500: "#ea580c" },
          },
          dark: {
            primary: { 500: "#f97316" },
          },
        },
      };

      applyTheme(theme);

      const styleEl = document.getElementById("custom-theme-overrides");
      expect(styleEl).not.toBeNull();
      expect(styleEl?.textContent).toContain(":root {");
      expect(styleEl?.textContent).toContain(".dark {");
      expect(styleEl?.textContent).toContain("--color-primary-500: #ea580c;");
      expect(styleEl?.textContent).toContain("--color-primary-500: #f97316;");
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
        JSON.stringify({ invalid: true }),
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

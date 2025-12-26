/**
 * Built-in Theme Configurations (v1.17.0)
 *
 * Four distinct theme personalities for the Geetanjali app:
 * - Geetanjali (default): Warm amber/orange - ancient manuscript feel
 * - Serenity: Twilight violet/rose - contemplative, meditative
 * - Forest: Emerald/sage - grounded, natural peace
 * - High Contrast: Maximum accessibility
 *
 * Each theme defines mode-specific colors for optimal appearance
 * in both light and dark modes with WCAG AA compliant contrast.
 */

import type { ThemeConfig } from "../types/theme";

/**
 * Default theme - uses standard primitives (no overrides needed)
 * Geetanjali: Warm amber/orange inspired by ancient manuscripts
 */
export const defaultTheme: ThemeConfig = {
  id: "default",
  name: "Geetanjali",
  description: "Warm amber and orange inspired by ancient manuscripts",
};

/**
 * High Contrast theme
 * Maximum accessibility with strong contrast ratios
 */
export const highContrastTheme: ThemeConfig = {
  id: "high-contrast",
  name: "High Contrast",
  description: "Maximum clarity for better readability",
  modeColors: {
    light: {
      primary: {
        50: "#fff7ed",
        100: "#ffedd5",
        400: "#fb923c",
        500: "#c2410c",
        600: "#9a3412",
        700: "#7c2d12",
      },
      warm: {
        50: "#ffffff",
        100: "#fafafa",
        200: "#f5f5f5",
      },
      neutral: {
        50: "#ffffff",
        100: "#fafafa",
        200: "#f5f5f5",
        400: "#737373",
        500: "#525252",
        600: "#404040",
        800: "#171717",
        900: "#000000",
      },
      accent: {
        400: "#fb923c",
        500: "#f97316",
        600: "#ea580c",
      },
    },
    dark: {
      primary: {
        50: "#431407",
        100: "#7c2d12",
        400: "#fb923c",
        500: "#f97316",
        600: "#ea580c",
      },
      warm: {
        50: "#0a0a0a",
        100: "#171717",
        200: "#262626",
        800: "#e5e5e5",
        900: "#fafafa",
      },
      neutral: {
        50: "#000000",
        100: "#0a0a0a",
        200: "#171717",
        400: "#a3a3a3",
        500: "#d4d4d4",
        600: "#e5e5e5",
        800: "#f5f5f5",
        900: "#ffffff",
      },
      accent: {
        400: "#fb923c",
        500: "#f97316",
        600: "#ea580c",
      },
    },
  },
};

/**
 * Serenity theme
 * Twilight temple atmosphere - contemplative violet/rose tones
 * Perfect for evening reading and meditation
 */
export const serenityTheme: ThemeConfig = {
  id: "serenity",
  name: "Serenity",
  description: "Twilight violet tones for contemplative reading",
  modeColors: {
    light: {
      primary: {
        50: "#fdf4ff",
        100: "#fae8ff",
        200: "#f5d0fe",
        300: "#f0abfc",
        400: "#e879f9",
        500: "#a855f7",
        600: "#9333ea",
        700: "#7e22ce",
        800: "#6b21a8",
        900: "#581c87",
      },
      warm: {
        50: "#faf5ff",
        100: "#f3e8ff",
        200: "#e9d5ff",
        300: "#d8b4fe",
        400: "#c084fc",
        500: "#a855f7",
        600: "#9333ea",
        700: "#7e22ce",
        800: "#6b21a8",
        900: "#581c87",
      },
      neutral: {
        50: "#faf8fc",
        100: "#f4f0f7",
        200: "#ebe5f0",
        300: "#d4c9de",
        400: "#9f8fb3",
        500: "#6b5a7d",
        600: "#4c3d5c",
        800: "#2e2438",
        900: "#1e1527",
      },
      accent: {
        50: "#fdf2f8",
        100: "#fce7f3",
        400: "#f472b6",
        500: "#ec4899",
        600: "#db2777",
        700: "#be185d",
      },
    },
    dark: {
      primary: {
        50: "#2e1065",
        100: "#3b0764",
        200: "#581c87",
        300: "#7e22ce",
        400: "#a855f7",
        500: "#c084fc",
        600: "#d8b4fe",
        700: "#e9d5ff",
        800: "#f3e8ff",
        900: "#faf5ff",
      },
      warm: {
        50: "#1e1527",
        100: "#2e2438",
        200: "#3d3350",
        700: "#d8b4fe",
        800: "#e9d5ff",
        900: "#f3e8ff",
      },
      neutral: {
        50: "#1a1523",
        100: "#221c2e",
        200: "#2e2639",
        300: "#3d3350",
        400: "#8b7fa0",
        500: "#a89ebb",
        600: "#c5bdd3",
        800: "#ebe5f0",
        900: "#f8f6fa",
      },
      accent: {
        400: "#f472b6",
        500: "#ec4899",
        600: "#db2777",
      },
    },
  },
};

/**
 * Forest theme
 * Sacred grove atmosphere - grounded emerald/sage tones
 * Perfect for extended reading sessions and focus
 */
export const forestTheme: ThemeConfig = {
  id: "forest",
  name: "Forest",
  description: "Emerald and sage tones for peaceful focus",
  modeColors: {
    light: {
      primary: {
        50: "#ecfdf5",
        100: "#d1fae5",
        200: "#a7f3d0",
        300: "#6ee7b7",
        400: "#34d399",
        500: "#10b981",
        600: "#059669",
        700: "#047857",
        800: "#065f46",
        900: "#064e3b",
      },
      warm: {
        50: "#f0fdf4",
        100: "#dcfce7",
        200: "#bbf7d0",
        300: "#86efac",
        400: "#4ade80",
        500: "#22c55e",
        600: "#16a34a",
        700: "#15803d",
        800: "#166534",
        900: "#14532d",
      },
      neutral: {
        50: "#f7faf8",
        100: "#ecf4ef",
        200: "#dce8e0",
        300: "#b8d4c0",
        400: "#6b9a78",
        500: "#4a7258",
        600: "#3a5a46",
        800: "#1e3528",
        900: "#14261b",
      },
      accent: {
        50: "#f0fdfa",
        100: "#ccfbf1",
        400: "#2dd4bf",
        500: "#14b8a6",
        600: "#0d9488",
        700: "#0f766e",
      },
    },
    dark: {
      primary: {
        50: "#022c22",
        100: "#064e3b",
        200: "#065f46",
        300: "#047857",
        400: "#10b981",
        500: "#34d399",
        600: "#6ee7b7",
        700: "#a7f3d0",
        800: "#d1fae5",
        900: "#ecfdf5",
      },
      warm: {
        50: "#14261b",
        100: "#1e3528",
        200: "#274536",
        700: "#86efac",
        800: "#bbf7d0",
        900: "#dcfce7",
      },
      neutral: {
        50: "#0f1f17",
        100: "#162821",
        200: "#1e352b",
        300: "#274536",
        400: "#5a8a6a",
        500: "#7cb091",
        600: "#a3c9b3",
        800: "#dce8e0",
        900: "#f0f7f2",
      },
      accent: {
        400: "#2dd4bf",
        500: "#14b8a6",
        600: "#0d9488",
      },
    },
  },
};

/**
 * All built-in themes
 */
export const builtInThemes: ThemeConfig[] = [
  defaultTheme,
  highContrastTheme,
  serenityTheme,
  forestTheme,
];

/**
 * Get a built-in theme by ID
 */
export function getThemeById(id: string): ThemeConfig | undefined {
  return builtInThemes.find((theme) => theme.id === id);
}

/**
 * Check if a theme ID is a built-in theme
 */
export function isBuiltInTheme(id: string): boolean {
  return builtInThemes.some((theme) => theme.id === id);
}

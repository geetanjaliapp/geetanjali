/**
 * Built-in Theme Configurations (v1.16.0)
 *
 * Predefined themes that can be selected by users.
 * Each theme can define mode-specific colors for optimal appearance
 * in both light and dark modes.
 *
 * The default theme uses the standard primitives from tokens/primitives.css.
 * Other themes override specific values for light and/or dark modes.
 */

import type { ThemeConfig } from "../types/theme";

/**
 * Default theme - uses standard primitives (no overrides needed)
 * This is the "Geetanjali" warm amber/orange theme
 */
export const defaultTheme: ThemeConfig = {
  id: "default",
  name: "Geetanjali",
  description: "Warm amber and orange theme inspired by ancient manuscripts",
};

/**
 * High Contrast theme
 * Optimized for accessibility with stronger contrast ratios
 */
export const highContrastTheme: ThemeConfig = {
  id: "high-contrast",
  name: "High Contrast",
  description: "Enhanced contrast for better readability",
  modeColors: {
    light: {
      primary: {
        500: "#c2410c", // Darker orange for better contrast on light
        600: "#9a3412",
        700: "#7c2d12",
      },
      neutral: {
        50: "#ffffff",
        100: "#f5f5f5",
        200: "#e5e5e5",
        800: "#1a1a1a",
        900: "#0a0a0a",
      },
    },
    dark: {
      primary: {
        400: "#fb923c", // Brighter orange for dark mode
        500: "#f97316",
        600: "#ea580c",
      },
      neutral: {
        50: "#0a0a0a",
        100: "#171717",
        200: "#262626",
        800: "#e5e5e5",
        900: "#fafafa",
      },
    },
  },
};

/**
 * Sepia theme
 * Warm, paper-like tones for comfortable reading
 */
export const sepiaTheme: ThemeConfig = {
  id: "sepia",
  name: "Sepia",
  description: "Warm paper-like tones for comfortable reading",
  modeColors: {
    light: {
      primary: {
        50: "#fef7ed",
        100: "#feecd6",
        500: "#b45309",
        600: "#92400e",
        700: "#78350f",
      },
      warm: {
        50: "#fefcf3",
        100: "#fef9e7",
        200: "#fdf3d0",
      },
      neutral: {
        50: "#faf8f5",
        100: "#f5f0e8",
        200: "#ebe4d6",
        800: "#3d3529",
        900: "#2a241c",
      },
    },
    dark: {
      // Warm dark sepia - like aged paper in candlelight
      primary: {
        400: "#d97706",
        500: "#b45309",
        600: "#92400e",
      },
      warm: {
        700: "#44403c",
        800: "#292524",
        900: "#1c1917",
      },
      neutral: {
        50: "#1c1917",
        100: "#292524",
        200: "#44403c",
        800: "#e7e5e4",
        900: "#fafaf9",
      },
    },
  },
};

/**
 * Ocean theme
 * Cool blue tones for a calming experience
 */
export const oceanTheme: ThemeConfig = {
  id: "ocean",
  name: "Ocean",
  description: "Cool blue tones for a calming reading experience",
  modeColors: {
    light: {
      primary: {
        50: "#eff6ff",
        100: "#dbeafe",
        200: "#bfdbfe",
        300: "#93c5fd",
        400: "#60a5fa",
        500: "#3b82f6",
        600: "#2563eb",
        700: "#1d4ed8",
        800: "#1e40af",
        900: "#1e3a8a",
      },
      warm: {
        50: "#f0f9ff",
        100: "#e0f2fe",
        200: "#bae6fd",
        300: "#7dd3fc",
        400: "#38bdf8",
        500: "#0ea5e9",
        600: "#0284c7",
        700: "#0369a1",
        800: "#075985",
        900: "#0c4a6e",
      },
      accent: {
        50: "#ecfeff",
        100: "#cffafe",
        200: "#a5f3fc",
        300: "#67e8f9",
        400: "#22d3ee",
        500: "#06b6d4",
        600: "#0891b2",
        700: "#0e7490",
        800: "#155e75",
        900: "#164e63",
      },
    },
    dark: {
      // Deep ocean - darker blues with brighter accents
      primary: {
        50: "#1e3a5f",
        100: "#1e40af",
        200: "#1d4ed8",
        300: "#2563eb",
        400: "#3b82f6",
        500: "#60a5fa",
        600: "#93c5fd",
        700: "#bfdbfe",
        800: "#dbeafe",
        900: "#eff6ff",
      },
      warm: {
        50: "#0c4a6e",
        100: "#075985",
        200: "#0369a1",
        300: "#0284c7",
        400: "#0ea5e9",
        500: "#38bdf8",
        600: "#7dd3fc",
        700: "#bae6fd",
        800: "#e0f2fe",
        900: "#f0f9ff",
      },
      accent: {
        50: "#164e63",
        100: "#155e75",
        200: "#0e7490",
        300: "#0891b2",
        400: "#06b6d4",
        500: "#22d3ee",
        600: "#67e8f9",
        700: "#a5f3fc",
        800: "#cffafe",
        900: "#ecfeff",
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
  sepiaTheme,
  oceanTheme,
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

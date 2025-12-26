/**
 * Built-in Theme Configurations (v1.16.0)
 *
 * Predefined themes that can be selected by users.
 * The default theme uses the standard primitives from tokens/primitives.css.
 * Other themes override specific values.
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
  colors: {
    primary: {
      500: "#c2410c", // Darker orange for better contrast
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
};

/**
 * Sepia theme
 * Warm, paper-like tones for comfortable reading
 */
export const sepiaTheme: ThemeConfig = {
  id: "sepia",
  name: "Sepia",
  description: "Warm paper-like tones for comfortable reading",
  colors: {
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
};

/**
 * Ocean theme
 * Cool blue tones for a calming experience
 */
export const oceanTheme: ThemeConfig = {
  id: "ocean",
  name: "Ocean",
  description: "Cool blue tones for a calming reading experience",
  colors: {
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

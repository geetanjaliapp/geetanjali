/**
 * Built-in Theme Configurations (v1.17.1)
 *
 * Four distinct theme personalities for the Geetanjali app:
 * - Geetanjali (default): Warm amber/orange - ancient manuscript feel
 * - Serenity: Twilight violet/rose - contemplative, meditative
 * - Forest: Emerald/sage - grounded, natural peace
 * - High Contrast: Maximum accessibility
 *
 * IMPORTANT: Neutral scale mapping for text readability:
 * - Light mode: neutral-900 = dark text, neutral-50 = light background
 * - Dark mode: neutral-100 = LIGHT text, neutral-50 = dark background
 *
 * The semantic layer expects:
 * - --text-primary uses neutral-900 (light) / neutral-100 (dark)
 * - --text-secondary uses neutral-600 (light) / neutral-400 (dark)
 * - --text-muted uses neutral-400 (light) / neutral-600 (dark)
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
 * Uses pure black/white for maximum clarity
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
        500: "#ea580c",
        600: "#c2410c",
        700: "#9a3412",
      },
      warm: {
        50: "#ffffff",
        100: "#fafafa",
        200: "#f5f5f5",
        300: "#e5e5e5",
        400: "#a3a3a3",
        500: "#737373",
        600: "#525252",
        700: "#404040",
        800: "#262626",
        900: "#171717",
      },
      // Light mode: dark values at high numbers (for text)
      neutral: {
        50: "#ffffff",
        100: "#fafafa",
        200: "#f5f5f5",
        300: "#e5e5e5",
        400: "#525252", // text-muted: medium-dark
        500: "#404040", // text-tertiary: darker
        600: "#262626", // text-secondary: very dark
        700: "#171717",
        800: "#0a0a0a",
        900: "#000000", // text-primary: black
      },
      accent: {
        200: "#fed7aa",
        400: "#fb923c",
        500: "#f97316",
        600: "#ea580c",
        700: "#c2410c",
        800: "#9a3412",
        900: "#7c2d12",
      },
    },
    dark: {
      primary: {
        300: "#fdba74",
        400: "#fb923c",
        500: "#f97316",
        600: "#ea580c",
      },
      warm: {
        50: "#0a0a0a",
        100: "#171717",
        200: "#262626",
        300: "#404040",
        400: "#a3a3a3",
        500: "#d4d4d4",
        600: "#e5e5e5",
        700: "#f5f5f5",
        800: "#fafafa",
        900: "#ffffff",
      },
      // Dark mode: LIGHT values at LOW numbers (for text on dark bg)
      neutral: {
        50: "#000000",  // surface-base: pure black
        100: "#ffffff", // text-primary: pure white
        200: "#fafafa",
        300: "#f5f5f5",
        400: "#d4d4d4", // text-secondary: light gray
        500: "#a3a3a3", // text-tertiary: medium gray
        600: "#737373", // text-muted: medium-dark gray
        700: "#404040",
        800: "#262626", // surface-elevated
        900: "#171717",
      },
      accent: {
        200: "#fed7aa",
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
        50: "#faf5ff",   // fuchsia-50
        100: "#f3e8ff",  // violet-100
        200: "#e9d5ff",  // violet-200
        300: "#d8b4fe",  // violet-300
        400: "#c084fc",  // violet-400
        500: "#a855f7",  // violet-500
        600: "#9333ea",  // violet-600
        700: "#7e22ce",  // violet-700
        800: "#6b21a8",  // violet-800
        900: "#581c87",  // violet-900
      },
      // Light mode: dark text colors at high numbers
      neutral: {
        50: "#faf8fc",  // bg: soft lavender white
        100: "#f4f0f7",
        200: "#ebe5f0",
        300: "#d4c9de",
        400: "#78716c", // text-muted: warm gray
        500: "#57534e", // text-tertiary: darker warm gray
        600: "#44403c", // text-secondary: dark warm
        700: "#292524",
        800: "#1c1917",
        900: "#0c0a09", // text-primary: near black
      },
      accent: {
        200: "#fbcfe8",
        400: "#f472b6",
        500: "#ec4899",
        600: "#db2777",
        700: "#be185d",
        800: "#9d174d",
        900: "#831843",
      },
    },
    dark: {
      primary: {
        300: "#d8b4fe",
        400: "#c084fc",
        500: "#a855f7",
        600: "#9333ea",
      },
      warm: {
        50: "#1a1523",   // dark purple base
        100: "#2e1f3d",  // dark violet
        200: "#3d3350",  // muted violet
        300: "#5b21b6",  // violet-800
        400: "#c084fc",  // violet-400 (accent)
        500: "#d8b4fe",  // violet-300
        600: "#e9d5ff",  // violet-200
        700: "#f3e8ff",  // violet-100
        800: "#faf5ff",  // fuchsia-50
        900: "#fefcff",  // near white
      },
      // Dark mode: LIGHT text colors at LOW numbers
      neutral: {
        50: "#1a1523",  // surface-base: dark purple
        100: "#f5f5f4", // text-primary: light stone
        200: "#e7e5e4",
        300: "#d6d3d1",
        400: "#a8a29e", // text-secondary: medium stone
        500: "#78716c", // text-tertiary: darker stone
        600: "#57534e", // text-muted: dark stone
        700: "#3d3350",
        800: "#292524", // surface-elevated: dark
        900: "#1c1917",
      },
      accent: {
        200: "#fbcfe8",
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
        50: "#f0fdf4",   // green-50
        100: "#dcfce7",  // green-100
        200: "#bbf7d0",  // green-200
        300: "#86efac",  // green-300
        400: "#4ade80",  // green-400
        500: "#22c55e",  // green-500
        600: "#16a34a",  // green-600
        700: "#15803d",  // green-700
        800: "#166534",  // green-800
        900: "#14532d",  // green-900
      },
      // Light mode: dark text colors at high numbers
      neutral: {
        50: "#f7faf8",  // bg: soft sage white
        100: "#ecf4ef",
        200: "#dce8e0",
        300: "#b8d4c0",
        400: "#6b7280", // text-muted: gray
        500: "#4b5563", // text-tertiary: darker gray
        600: "#374151", // text-secondary: dark gray
        700: "#1f2937",
        800: "#111827",
        900: "#030712", // text-primary: near black
      },
      accent: {
        200: "#99f6e4",
        400: "#2dd4bf",
        500: "#14b8a6",
        600: "#0d9488",
        700: "#0f766e",
        800: "#115e59",
        900: "#134e4a",
      },
    },
    dark: {
      primary: {
        300: "#6ee7b7",
        400: "#34d399",
        500: "#10b981",
        600: "#059669",
      },
      warm: {
        50: "#0f1f17",   // deep forest base
        100: "#14261b",  // dark forest
        200: "#1e3528",  // forest shadow
        300: "#166534",  // green-800
        400: "#4ade80",  // green-400 (accent)
        500: "#86efac",  // green-300
        600: "#bbf7d0",  // green-200
        700: "#dcfce7",  // green-100
        800: "#f0fdf4",  // green-50
        900: "#f7fff9",  // near white
      },
      // Dark mode: LIGHT text colors at LOW numbers
      neutral: {
        50: "#0f1f17",  // surface-base: deep forest
        100: "#f3f4f6", // text-primary: light gray
        200: "#e5e7eb",
        300: "#d1d5db",
        400: "#9ca3af", // text-secondary: medium gray
        500: "#6b7280", // text-tertiary: darker gray
        600: "#4b5563", // text-muted: dark gray
        700: "#274536",
        800: "#1e352b", // surface-elevated: forest dark
        900: "#162821",
      },
      accent: {
        200: "#99f6e4",
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

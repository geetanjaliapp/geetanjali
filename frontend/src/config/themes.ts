/**
 * Built-in Theme Configurations (v1.18.0)
 *
 * Four distinct theme personalities for the Geetanjali app,
 * each with unique color palettes and typography associations:
 *
 * - Geetanjali (default): Warm amber/orange - temple lamp glow, ancient manuscripts
 * - Sutra: Monochrome black/white/slate - ink on paper, timeless clarity
 * - Serenity: Deep violet/lavender/rose - twilight temple, evening meditation
 * - Forest: Emerald/sage/teal - sacred grove, morning dew, natural peace
 *
 * Typography associations:
 * - Geetanjali: Mixed (Spectral headings + Source Sans body)
 * - Sutra: Serif (Spectral throughout - classical manuscript feel)
 * - Serenity: Mixed (elegant headings with calm body)
 * - Forest: Sans (Source Sans throughout - clean, modern, natural)
 *
 * IMPORTANT: Neutral scale mapping for text readability:
 * - Light mode: neutral-900 = dark text, neutral-50 = light background
 * - Dark mode: neutral-100 = LIGHT text, neutral-50 = dark background
 */

import type { ThemeConfig } from "../types/theme";

/**
 * Geetanjali (default)
 * The warmth of oil lamps in a temple, aged paper, gold leaf accents.
 * Sunrise colors that welcome readers to sacred wisdom.
 * Uses standard primitives - no overrides needed.
 */
export const defaultTheme: ThemeConfig = {
  id: "default",
  name: "Geetanjali",
  description: "Temple lamp glow, ancient manuscript warmth",
  defaultFontFamily: "mixed",
};

/**
 * Sutra theme
 * Sanskrit for "thread" or "discourse" - sacred aphoristic texts.
 * Clean ink on pristine paper, maximum readability.
 * Pure black/white with slate accents for subtle differentiation.
 */
export const sutraTheme: ThemeConfig = {
  id: "sutra",
  name: "Sutra",
  description: "Ink on paper, timeless clarity",
  defaultFontFamily: "serif",
  modeColors: {
    light: {
      // Slate primary for subtle interactions
      primary: {
        50: "#f8fafc",
        100: "#f1f5f9",
        200: "#e2e8f0",
        300: "#cbd5e1",
        400: "#94a3b8",
        500: "#64748b",
        600: "#475569",
        700: "#334155",
        800: "#1e293b",
        900: "#0f172a",
      },
      // Pure neutrals for warm surfaces
      warm: {
        50: "#fafafa",
        100: "#f5f5f5",
        200: "#e5e5e5",
        300: "#d4d4d4",
        400: "#a3a3a3",
        500: "#737373",
        600: "#525252",
        700: "#404040",
        800: "#262626",
        900: "#171717",
      },
      // Pure neutrals
      neutral: {
        50: "#fafafa",
        100: "#f5f5f5",
        200: "#e5e5e5",
        300: "#d4d4d4",
        400: "#737373",
        500: "#525252",
        600: "#404040",
        700: "#262626",
        800: "#171717",
        900: "#0a0a0a",
      },
      // Slate accents
      accent: {
        50: "#f8fafc",
        100: "#f1f5f9",
        200: "#e2e8f0",
        300: "#cbd5e1",
        400: "#94a3b8",
        500: "#64748b",
        600: "#475569",
        700: "#334155",
        800: "#1e293b",
        900: "#0f172a",
      },
    },
    dark: {
      primary: {
        50: "#0f172a",
        100: "#1e293b",
        200: "#334155",
        300: "#475569",
        400: "#94a3b8",
        500: "#cbd5e1",
        600: "#e2e8f0",
        700: "#f1f5f9",
        800: "#f8fafc",
        900: "#ffffff",
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
      neutral: {
        50: "#0a0a0a",
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
      accent: {
        50: "#0f172a",
        100: "#1e293b",
        200: "#e2e8f0",
        300: "#cbd5e1",
        400: "#94a3b8",
        500: "#64748b",
        600: "#475569",
        700: "#cbd5e1",
        800: "#e2e8f0",
        900: "#f8fafc",
      },
    },
  },
};

/**
 * Serenity theme
 * Twilight hour at a meditation hall, soft violet candlelight.
 * Deep contemplative purples with rose incense undertones.
 * Perfect for evening reading and peaceful reflection.
 */
export const serenityTheme: ThemeConfig = {
  id: "serenity",
  name: "Serenity",
  description: "Twilight violet, contemplative calm",
  defaultFontFamily: "mixed",
  modeColors: {
    light: {
      // Deep violet primary
      primary: {
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
      // Soft lavender warmth
      warm: {
        50: "#fdf4ff",
        100: "#fae8ff",
        200: "#f5d0fe",
        300: "#f0abfc",
        400: "#e879f9",
        500: "#d946ef",
        600: "#c026d3",
        700: "#a21caf",
        800: "#86198f",
        900: "#701a75",
      },
      // Stone neutrals with warm undertone
      neutral: {
        50: "#fafaf9",
        100: "#f5f5f4",
        200: "#e7e5e4",
        300: "#d6d3d1",
        400: "#78716c",
        500: "#57534e",
        600: "#44403c",
        700: "#292524",
        800: "#1c1917",
        900: "#0c0a09",
      },
      // Rose accents
      accent: {
        50: "#fff1f2",
        100: "#ffe4e6",
        200: "#fecdd3",
        300: "#fda4af",
        400: "#fb7185",
        500: "#f43f5e",
        600: "#e11d48",
        700: "#be123c",
        800: "#9f1239",
        900: "#881337",
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
        50: "#1a0a1f",
        100: "#2e1538",
        200: "#4a1d5c",
        300: "#86198f",
        400: "#d946ef",
        500: "#e879f9",
        600: "#f0abfc",
        700: "#f5d0fe",
        800: "#fae8ff",
        900: "#fdf4ff",
      },
      neutral: {
        50: "#1c1917",
        100: "#fafaf9",
        200: "#f5f5f4",
        300: "#e7e5e4",
        400: "#a8a29e",
        500: "#78716c",
        600: "#57534e",
        700: "#44403c",
        800: "#292524",
        900: "#1c1917",
      },
      accent: {
        50: "#881337",
        100: "#9f1239",
        200: "#fecdd3",
        300: "#fda4af",
        400: "#fb7185",
        500: "#f43f5e",
        600: "#e11d48",
        700: "#fda4af",
        800: "#fecdd3",
        900: "#fff1f2",
      },
    },
  },
};

/**
 * Forest theme
 * Early morning in a sacred grove, filtered sunlight through leaves.
 * Fresh emerald with sage undertones, grounding and alive.
 * Perfect for extended reading sessions and focused study.
 */
export const forestTheme: ThemeConfig = {
  id: "forest",
  name: "Forest",
  description: "Sacred grove, morning dew freshness",
  defaultFontFamily: "sans",
  modeColors: {
    light: {
      // Rich emerald primary
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
      // Sage warmth
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
      // Cool gray neutrals
      neutral: {
        50: "#f9fafb",
        100: "#f3f4f6",
        200: "#e5e7eb",
        300: "#d1d5db",
        400: "#6b7280",
        500: "#4b5563",
        600: "#374151",
        700: "#1f2937",
        800: "#111827",
        900: "#030712",
      },
      // Teal accents
      accent: {
        50: "#f0fdfa",
        100: "#ccfbf1",
        200: "#99f6e4",
        300: "#5eead4",
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
        50: "#052e16",
        100: "#14532d",
        200: "#166534",
        300: "#15803d",
        400: "#4ade80",
        500: "#86efac",
        600: "#bbf7d0",
        700: "#dcfce7",
        800: "#f0fdf4",
        900: "#f7fff9",
      },
      neutral: {
        50: "#111827",
        100: "#f3f4f6",
        200: "#e5e7eb",
        300: "#d1d5db",
        400: "#9ca3af",
        500: "#6b7280",
        600: "#4b5563",
        700: "#374151",
        800: "#1f2937",
        900: "#111827",
      },
      accent: {
        50: "#134e4a",
        100: "#115e59",
        200: "#99f6e4",
        300: "#5eead4",
        400: "#2dd4bf",
        500: "#14b8a6",
        600: "#0d9488",
        700: "#5eead4",
        800: "#ccfbf1",
        900: "#f0fdfa",
      },
    },
  },
};

/**
 * All built-in themes
 */
export const builtInThemes: ThemeConfig[] = [
  defaultTheme,
  sutraTheme,
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

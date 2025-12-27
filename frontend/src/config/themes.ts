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
 *
 * Light mode uses standard primitives - no overrides needed.
 * Dark mode requires contrast overrides for badges/chips to maintain
 * warm personality while ensuring proper visual distinction.
 */
export const defaultTheme: ThemeConfig = {
  id: "default",
  name: "Geetanjali",
  description: "Temple lamp glow, ancient manuscript warmth",
  defaultFontFamily: "mixed",
  modeColors: {
    dark: {
      // Geetanjali dark mode needs explicit badge overrides to:
      // 1. Maintain warm amber personality (not pure neutral gray)
      // 2. Provide visual distinction from card backgrounds
      // 3. Match the "temple lamp glow" aesthetic in dark mode
      contrast: {
        // Badge/chip colors - amber-tinted for warm personality
        // These are notably warmer than the neutral card background (#1f2937)
        badgeWarmBg: "#4a3d2a", // Amber-brown: distinct from neutral gray
        badgeWarmHover: "#5a4a35", // Slightly lighter on hover
        badgeWarmText: "#e7ddd0", // Warm off-white text
        chipSelectedBg: "#5a4a35", // Slightly lighter than badge
        chipSelectedText: "#d4c8b8", // Warm muted text
      },
    },
  },
};

/**
 * Sutra theme
 * Sanskrit for "thread" or "discourse" - sacred aphoristic texts.
 * Clean ink on pristine paper, maximum readability.
 * Pure black/white with slate accents for subtle differentiation.
 * Sharp, precise edges reflect scholarly clarity.
 */
export const sutraTheme: ThemeConfig = {
  id: "sutra",
  name: "Sutra",
  description: "Ink on paper, timeless clarity",
  defaultFontFamily: "serif",
  // Crisp, angular corners for scholarly precision
  radius: {
    sm: "0.125rem",
    md: "0.25rem",
    lg: "0.375rem",
    xl: "0.5rem",
    "2xl": "0.625rem",
  },
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
      // Warm surfaces with subtle cream tint for card differentiation
      // Slight warm undertone distinguishes cards from pure neutral page
      warm: {
        50: "#fafaf8", // Subtle cream tint (was #fafafa - pure neutral)
        100: "#f5f5f2", // Warm off-white
        200: "#e8e8e3", // Soft cream
        300: "#d4d4cd", // Warm gray
        400: "#a3a39c",
        500: "#737370",
        600: "#52524f",
        700: "#40403d",
        800: "#262624",
        900: "#171716",
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
      // Sutra Dark: Crisp monochrome with clear surface hierarchy
      // Key insight: 900 values must be DARK for semantic.css surface-base
      // 100-300 values must be LIGHT for text tokens
      primary: {
        50: "#0f172a",
        100: "#e2e8f0", // Light slate for text-primary
        200: "#cbd5e1", // For text-secondary
        300: "#94a3b8", // For text-tertiary
        400: "#64748b", // Mid-tone
        500: "#475569",
        600: "#334155",
        700: "#1e293b",
        800: "#0f172a",
        900: "#0a0a0a", // Darkest for surface-base
      },
      warm: {
        // Warm scale for dark mode - 900 must be dark for color-mix surfaces
        50: "#0a0a0a",
        100: "#171717",
        200: "#262626",
        300: "#363636", // Added intermediate
        400: "#525252",
        500: "#737373",
        600: "#a3a3a3",
        700: "#d4d4d4",
        800: "#e5e5e5",
        900: "#0a0a0a", // DARK - critical for surface-warm mixing
      },
      neutral: {
        // Proper dark mode scale: 100 light for text, 900 dark for surfaces
        50: "#0a0a0a", // Darkest background
        100: "#e5e5e5", // Light for text-primary (was #fafafa - too bright)
        200: "#d4d4d4", // For text-secondary
        300: "#a3a3a3", // For text-tertiary
        400: "#737373", // Mid-tone muted
        500: "#525252",
        600: "#404040",
        700: "#303030", // Lighter card surface
        800: "#1f1f1f", // Card/elevated
        900: "#0a0a0a", // Darkest - matches 50 for semantic compatibility
      },
      accent: {
        50: "#0f172a",
        100: "#e2e8f0", // Light for text
        200: "#cbd5e1",
        300: "#94a3b8",
        400: "#64748b",
        500: "#475569",
        600: "#334155",
        700: "#1e293b",
        800: "#0f172a",
        900: "#0a0a0a", // Dark for surfaces
      },
      // WCAG AA compliant: dark buttons with white text
      contrast: {
        onPrimary: "#ffffff",
        surfacePure: "#0a0a0a",

        // Dark slate buttons with clear hover states
        interactivePrimary: "#334155",
        interactivePrimaryHover: "#475569",
        interactivePrimaryActive: "#64748b",
        interactiveGhostText: "#cbd5e1",

        // Text colors - CRITICAL: explicitly set for proper dark mode readability
        // Using the intended text colors from neutral scale
        textPrimary: "#e5e5e5", // neutral-100: high contrast primary text
        textSecondary: "#d4d4d4", // neutral-200: clear secondary text
        textTertiary: "#a3a3a3", // neutral-300: visible tertiary text
        textMuted: "#737373", // neutral-400: muted but readable
        textLink: "#cbd5e1",
        textLinkHover: "#e2e8f0",

        // Surface colors - proper layering hierarchy
        surfacePage: "#0a0a0a", // darkest base
        surfaceCard: "#1a1a1a", // slightly elevated
        surfaceElevated: "#262626", // clearly elevated (forms, modals)
        surfaceMuted: "#171717", // subtle muted surface

        // Input/form elements - visible contrast with card background
        inputBg: "#1f1f1f", // distinct from card, lighter than page
        inputBorder: "#404040", // visible border

        // Border colors
        borderFocus: "#94a3b8",
        borderDefault: "#303030",

        // Menu/nav item colors
        menuItemSelectedBg: "#1e293b", // primary-700: subtle dark bg
        menuItemSelectedText: "#e2e8f0", // primary-100: light text
        menuItemHoverBg: "#262626", // neutral-200: subtle hover

        // Badge/chip colors - inverted scale: use dark bg + light text
        badgeWarmBg: "#262626", // warm-200: dark background
        badgeWarmHover: "#363636", // warm-300: slightly lighter on hover
        badgeWarmText: "#d4d4d4", // warm-700: light text
        chipSelectedBg: "#363636", // warm-300: slightly lighter dark bg
        chipSelectedText: "#a3a3a3", // warm-600: visible text

        // Reading mode - pure neutral for scholarly ink-on-paper feel
        surfaceReading: "#0a0a0a", // pure dark
        surfaceReadingHeader: "#0a0a0a", // matches page
        textReadingPrimary: "#e5e5e5", // neutral-200
        textReadingSecondary: "#d4d4d4", // neutral-300
        textReadingMuted: "#737373", // neutral-500
      },
    },
  },
};

/**
 * Serenity theme
 * Twilight hour at a meditation hall, soft violet candlelight.
 * Deep contemplative purples with rose incense undertones.
 * Perfect for evening reading and peaceful reflection.
 * Soft, flowing curves evoke gentle meditation.
 */
export const serenityTheme: ThemeConfig = {
  id: "serenity",
  name: "Serenity",
  description: "Twilight violet, contemplative calm",
  defaultFontFamily: "mixed",
  // Softer, more rounded corners for calming effect
  radius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.25rem",
  },
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
      // Serenity Dark: Muted violet twilight - calming, not garish
      // Desaturated purple tones for comfortable dark mode viewing
      primary: {
        50: "#1a1625", // Subtle purple-tinted charcoal (was #2e1065 - too saturated)
        100: "#e9d5ff", // Light lavender for text-primary
        200: "#d8b4fe", // For text-secondary
        300: "#c4a5e0", // Muted purple for text-tertiary (was #7e22ce)
        400: "#9370db", // Medium purple - less saturated (was #a855f7)
        500: "#7c5cad", // Muted violet
        600: "#6b4d96",
        700: "#5a3d7f",
        800: "#2d2438", // Soft purple-gray
        900: "#1a1625", // Darkest - matches 50
      },
      warm: {
        // Muted lavender warmth - NOT neon fuchsia
        50: "#1a1520", // Dark purple-brown
        100: "#2a2030",
        200: "#3a2d45",
        300: "#5c4a6e", // Muted purple (was #86198f - too bright)
        400: "#9678b0", // Soft lavender (was #d946ef - neon!)
        500: "#b095c8", // Gentle purple
        600: "#c8b0d8",
        700: "#e0cce8",
        800: "#f0e5f5",
        900: "#1a1520", // DARK - critical for surface-warm mixing
      },
      neutral: {
        // Stone-based neutrals with warm undertone
        50: "#1c1917", // Darkest - stone-900
        100: "#e7e5e4", // Light stone for text (was #fafaf9 - too bright)
        200: "#d6d3d1", // For text-secondary
        300: "#a8a29e", // For text-tertiary
        400: "#78716c", // Mid-tone
        500: "#57534e",
        600: "#44403c",
        700: "#353230", // Card surface
        800: "#292524", // Elevated surface
        900: "#1c1917", // Darkest - matches 50
      },
      accent: {
        // Rose accents - shifted away from error-red overlap
        50: "#2a1520",
        100: "#f5d0dc", // Light rose for text
        200: "#f0b8c8",
        300: "#e89aaf",
        400: "#d97892", // Muted rose (was #fb7185)
        500: "#c45a78",
        600: "#a8445e",
        700: "#8a3048",
        800: "#6c2038",
        900: "#2a1520", // Dark for surfaces
      },
      // WCAG AA compliant: dark buttons with white text
      contrast: {
        onPrimary: "#ffffff",
        surfacePure: "#1c1917",

        // Muted violet buttons - easier on eyes
        interactivePrimary: "#5a3d7f", // Muted purple
        interactivePrimaryHover: "#6b4d96",
        interactivePrimaryActive: "#7c5cad",
        interactiveGhostText: "#c4a5e0",

        // Text colors - lavender-tinted for Serenity theme
        textPrimary: "#e7e5e4", // stone-200: warm primary text
        textSecondary: "#d6d3d1", // stone-300: clear secondary
        textTertiary: "#a8a29e", // stone-400: visible tertiary
        textMuted: "#78716c", // stone-500: muted but readable
        textLink: "#c4a5e0", // Soft lavender
        textLinkHover: "#d8b4fe",

        // Surface colors - purple-tinted dark surfaces
        surfacePage: "#1c1917", // stone-900 base
        surfaceCard: "#262420", // warm dark card
        surfaceElevated: "#353230", // elevated with warmth
        surfaceMuted: "#211f1d", // subtle muted

        // Input/form elements
        inputBg: "#292524", // stone-800
        inputBorder: "#44403c", // stone-600

        // Border colors
        borderFocus: "#9370db",
        borderDefault: "#3d3a36",

        // Menu/nav item colors
        menuItemSelectedBg: "#2d2438", // primary-800: subtle purple bg
        menuItemSelectedText: "#e9d5ff", // primary-100: light lavender text
        menuItemHoverBg: "#353230", // neutral-700: subtle hover

        // Badge/chip colors - inverted scale: use dark bg + light text
        badgeWarmBg: "#3a2d45", // warm-200: dark purple background
        badgeWarmHover: "#5c4a6e", // warm-300: slightly lighter on hover
        badgeWarmText: "#e0cce8", // warm-700: soft lavender text
        chipSelectedBg: "#5c4a6e", // warm-300: slightly lighter purple bg
        chipSelectedText: "#c8b0d8", // warm-600: visible text

        // Reading mode - purple-tinted for twilight meditation feel
        surfaceReading: "#1c1917", // stone-900 with warm undertone
        surfaceReadingHeader: "#1c1917", // matches page
        textReadingPrimary: "#e7e5e4", // stone-200
        textReadingSecondary: "#d6d3d1", // stone-300
        textReadingMuted: "#78716c", // stone-500
      },
    },
  },
};

/**
 * Forest theme
 * Early morning in a sacred grove, filtered sunlight through leaves.
 * Fresh emerald with sage undertones, grounding and alive.
 * Perfect for extended reading sessions and focused study.
 * Organic, natural curves like leaves and branches.
 */
export const forestTheme: ThemeConfig = {
  id: "forest",
  name: "Forest",
  description: "Sacred grove, morning dew freshness",
  defaultFontFamily: "sans",
  // Natural, organic rounding - not too sharp, not too soft
  radius: {
    sm: "0.1875rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
  },
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
      // Forest Dark: Moonlit grove - natural, grounded, not neon
      // Earthy greens with subtle blue undertone for depth
      primary: {
        50: "#0c1810", // Dark forest floor
        100: "#a7f3d0", // Light emerald for text-primary
        200: "#6ee7b7", // For text-secondary
        300: "#4abe8a", // Muted emerald for text-tertiary (less saturated)
        400: "#10b981", // Emerald-500
        500: "#059669",
        600: "#047857",
        700: "#065f46",
        800: "#064e3b",
        900: "#0c1810", // Darkest - matches 50
      },
      warm: {
        // Moss/sage warmth - earthy, not lime-neon
        50: "#0a150e", // Dark moss
        100: "#142a1c",
        200: "#1e3f2a",
        300: "#2d5a3e", // Moss green (was #15803d)
        400: "#5a9b6f", // Sage (was #4ade80 - too bright)
        500: "#7ab88c", // Soft sage
        600: "#9ad0a8",
        700: "#bae4c5",
        800: "#dcf5e3",
        900: "#0a150e", // DARK - critical for surface-warm mixing
      },
      neutral: {
        // Cool gray with subtle green undertone
        50: "#0f1410", // Darkest - forest night (subtle green)
        100: "#e5e7eb", // Light gray for text (was #f3f4f6 - slight reduction)
        200: "#d1d5db", // For text-secondary
        300: "#9ca3af", // For text-tertiary
        400: "#6b7280", // Mid-tone
        500: "#4b5563",
        600: "#374151",
        700: "#283530", // Card surface with green tint
        800: "#1a2420", // Elevated surface
        900: "#0f1410", // Darkest - matches 50
      },
      accent: {
        // Teal accents - slightly softened
        50: "#0c1815",
        100: "#99f6e4", // Light teal for text
        200: "#5eead4",
        300: "#3bc9b2", // Muted teal (was #5eead4)
        400: "#2dd4bf",
        500: "#14b8a6",
        600: "#0d9488",
        700: "#0f766e",
        800: "#115e59",
        900: "#0c1815", // Dark for surfaces
      },
      // WCAG AA compliant: dark buttons with white text
      contrast: {
        onPrimary: "#ffffff",
        surfacePure: "#0f1410", // Forest night

        // Emerald buttons - natural tones
        interactivePrimary: "#065f46",
        interactivePrimaryHover: "#047857",
        interactivePrimaryActive: "#059669",
        interactiveGhostText: "#6ee7b7",

        // Text colors - cool gray with subtle green undertone
        textPrimary: "#e5e7eb", // gray-200: clear primary text
        textSecondary: "#d1d5db", // gray-300: visible secondary
        textTertiary: "#9ca3af", // gray-400: tertiary
        textMuted: "#6b7280", // gray-500: muted
        textLink: "#6ee7b7",
        textLinkHover: "#a7f3d0",

        // Surface colors - forest-tinted dark surfaces
        surfacePage: "#0f1410", // dark forest floor
        surfaceCard: "#1a2420", // elevated with green tint
        surfaceElevated: "#283530", // clearly elevated
        surfaceMuted: "#151c18", // subtle muted

        // Input/form elements
        inputBg: "#1f2b25", // forest-tinted input
        inputBorder: "#374840", // green-tinted border

        // Border colors
        borderFocus: "#10b981",
        borderDefault: "#2d3d35",

        // Menu/nav item colors
        menuItemSelectedBg: "#065f46", // primary-800: emerald bg
        menuItemSelectedText: "#a7f3d0", // primary-100: light emerald text
        menuItemHoverBg: "#283530", // neutral-700: subtle hover

        // Badge/chip colors - inverted scale: use dark bg + light text
        badgeWarmBg: "#1e3f2a", // warm-200: dark forest background
        badgeWarmHover: "#2d5a3e", // warm-300: slightly lighter on hover
        badgeWarmText: "#bae4c5", // warm-700: soft sage text
        chipSelectedBg: "#2d5a3e", // warm-300: slightly lighter forest bg
        chipSelectedText: "#9ad0a8", // warm-600: visible text

        // Reading mode - forest-tinted for natural grove feel
        surfaceReading: "#0f1410", // forest night (surfacePure)
        surfaceReadingHeader: "#0f1410", // matches page
        textReadingPrimary: "#e5e7eb", // gray-200: cool primary text
        textReadingSecondary: "#d1d5db", // gray-300: visible secondary
        textReadingMuted: "#6b7280", // gray-500: muted
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

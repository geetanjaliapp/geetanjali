/**
 * Font Configuration (v1.18.0)
 *
 * Theme-specific typography presets for the Geetanjali app.
 * Each theme has distinct font pairings to reinforce its personality:
 *
 * - Geetanjali: Spectral (display) + Source Sans 3 (body) - classical warmth
 * - Sutra: Literata (display) + Inter (body) - scholarly clarity
 * - Serenity: Cormorant Garamond (display) + Crimson Pro (body) - elegant calm
 * - Forest: Nunito (display) + Work Sans (body) - organic freshness
 *
 * User font preference (serif/sans/mixed) is independent from theme
 * and controls the general typography style.
 */

import type { FontFamily } from "../types/theme";

/**
 * Font family preset definitions
 * Each preset defines display (headings) and body fonts
 */
export interface FontPreset {
  /** Font family for headings/display text */
  display: string;
  /** Font family for body text */
  body: string;
  /** Human-readable label */
  label: string;
  /** Description of the font style */
  description: string;
}

/**
 * Theme font definition (simpler than FontPreset)
 */
export interface ThemeFontDef {
  /** Font for headings, titles, display text */
  display: string;
  /** Font for body text, paragraphs, UI */
  body: string;
}

/**
 * User-selectable font presets (independent of theme)
 *
 * These are the three options users can choose in Reading Preferences:
 * - serif: Traditional, book-like feel
 * - sans: Modern, clean feel
 * - mixed: Best of both (default)
 */
export const FONT_FAMILIES: Record<FontFamily, FontPreset> = {
  serif: {
    display: "'Spectral', Georgia, 'Times New Roman', serif",
    body: "'Spectral', Georgia, 'Times New Roman', serif",
    label: "Serif",
    description: "Traditional serif for classical reading",
  },
  sans: {
    display: "'Source Sans 3', system-ui, -apple-system, sans-serif",
    body: "'Source Sans 3', system-ui, -apple-system, sans-serif",
    label: "Sans",
    description: "Clean sans-serif for modern clarity",
  },
  mixed: {
    display: "'Spectral', Georgia, 'Times New Roman', serif",
    body: "'Source Sans 3', system-ui, -apple-system, sans-serif",
    label: "Mixed",
    description: "Serif headings with sans-serif body",
  },
};

/**
 * Theme-specific font presets
 *
 * Each theme has a distinct typographic personality.
 * These are applied automatically when switching themes.
 */
export const THEME_FONTS: Record<string, ThemeFontDef> = {
  // Geetanjali (default): Warm, classical Indian manuscript feel
  default: {
    display: "'Spectral', Georgia, 'Times New Roman', serif",
    body: "'Source Sans 3', system-ui, -apple-system, sans-serif",
  },

  // Sutra: Scholarly, clear ink-on-paper aesthetic
  // Literata: designed for eBooks, excellent readability
  // Inter: modern UI font with great x-height
  sutra: {
    display: "'Literata', Georgia, 'Times New Roman', serif",
    body: "'Inter', system-ui, -apple-system, sans-serif",
  },

  // Serenity: Elegant, contemplative twilight mood
  // Cormorant Garamond: graceful display font
  // Crimson Pro: refined body text
  serenity: {
    display: "'Cormorant Garamond', Garamond, Georgia, serif",
    body: "'Crimson Pro', Georgia, 'Times New Roman', serif",
  },

  // Forest: Organic, natural freshness
  // Nunito: friendly rounded sans
  // Work Sans: clean geometric sans
  forest: {
    display: "'Nunito', 'Segoe UI', system-ui, sans-serif",
    body: "'Work Sans', system-ui, -apple-system, sans-serif",
  },
};

/**
 * Default font family preference
 */
export const DEFAULT_FONT_FAMILY: FontFamily = "mixed";

/**
 * Font family options for UI selection
 */
export const FONT_FAMILY_OPTIONS: FontFamily[] = ["serif", "sans", "mixed"];

/**
 * Get theme-specific fonts for a theme ID
 */
export function getThemeFonts(themeId: string): ThemeFontDef {
  return THEME_FONTS[themeId] || THEME_FONTS.default;
}

/**
 * Get font family definition for a user preference
 */
export function getFontFamily(preference: FontFamily): FontPreset {
  return FONT_FAMILIES[preference] || FONT_FAMILIES.mixed;
}

/**
 * Sanskrit/Devanagari font stack (shared across all themes)
 * Noto Serif Devanagari provides excellent Sanskrit rendering
 */
export const SANSKRIT_FONT =
  "'Noto Serif Devanagari', 'Mangal', 'Kokila', serif";

/**
 * Monospace font stack (shared across all themes)
 * Used for code blocks, technical content
 */
export const MONO_FONT =
  "'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', monospace";

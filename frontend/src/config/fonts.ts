/**
 * Font Family Configuration (v1.17.0)
 *
 * Defines font family presets that users can choose from.
 * Font choice is independent from color theme selection.
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
 * Available font family presets
 */
export const FONT_FAMILIES: Record<FontFamily, FontPreset> = {
  serif: {
    display: "'Spectral', Georgia, serif",
    body: "'Spectral', Georgia, serif",
    label: "Serif",
    description: "Traditional serif for classical reading",
  },
  sans: {
    display: "'Source Sans 3', system-ui, sans-serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    label: "Sans",
    description: "Clean sans-serif for modern clarity",
  },
  mixed: {
    display: "'Spectral', Georgia, serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    label: "Mixed",
    description: "Serif headings with sans-serif body",
  },
};

/**
 * Default font family
 */
export const DEFAULT_FONT_FAMILY: FontFamily = "mixed";

/**
 * Font family options for UI selection
 */
export const FONT_FAMILY_OPTIONS: FontFamily[] = ["serif", "sans", "mixed"];

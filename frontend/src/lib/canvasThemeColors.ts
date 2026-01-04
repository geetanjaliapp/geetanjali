/**
 * Canvas Theme Colors - Utility for reading CSS variables as hex colors
 *
 * This module bridges the gap between CSS custom properties (used by the app's
 * theming system) and canvas rendering (which requires hex/rgb values).
 *
 * Usage:
 *   const colors = getCanvasThemeColors();
 *   ctx.fillStyle = colors.sanskrit;
 */

import { STORAGE_KEYS } from "./storage";

/**
 * Color palette for canvas-based image generation
 */
export interface CanvasThemeColors {
  background: {
    type: "solid" | "gradient";
    color?: string;
    gradient?: {
      from: string;
      to: string;
    };
  };
  om: string;
  sanskrit: string;
  verseRef: string;
  english: string;
  hindi: string;
  branding: string;
  divider: string;
  border: string;
}

/**
 * Get the computed value of a CSS variable
 */
function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Convert a CSS color value to a hex string for canvas use.
 * Handles: hex, rgb(), rgba(), color names, and CSS variables.
 */
function cssColorToHex(cssValue: string): string {
  // If it's already a hex color, return it
  if (cssValue.startsWith("#")) {
    return cssValue;
  }

  // If it references another variable, resolve it
  if (cssValue.startsWith("var(")) {
    const varName = cssValue.match(/var\((--[^,)]+)/)?.[1];
    if (varName) {
      return cssColorToHex(getCSSVariable(varName));
    }
  }

  // If it's a color-mix or other complex value, we need to compute it
  // Create a temporary element to resolve the color
  const temp = document.createElement("div");
  temp.style.color = cssValue;
  temp.style.display = "none";
  document.body.appendChild(temp);

  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // Parse rgb/rgba format
  const match = computed.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/,
  );
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  // Fallback - return as-is and let canvas handle it
  return cssValue || "#000000";
}

/**
 * Resolve a CSS variable to its hex value
 */
function resolveToken(tokenName: string, fallback: string): string {
  const value = getCSSVariable(tokenName);
  if (!value) return fallback;
  return cssColorToHex(value);
}

/**
 * Check if dark mode is currently active
 */
export function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * Get canvas-compatible colors from the current CSS theme.
 * This reads the active theme's CSS variables and converts them to hex values
 * that can be used with the Canvas API.
 *
 * Fallback values use Sacred Saffron / Turmeric Gold palette (v1.22.0)
 */
export function getCanvasThemeColors(): CanvasThemeColors {
  const dark = isDarkMode();

  // Get gradient colors for background
  // Fallbacks: Turmeric Gold (light) / Warm Charcoal (dark)
  const gradientFrom = resolveToken(
    "--gradient-warm-from",
    dark ? "#1A1614" : "#FFFDF5",
  );
  const gradientTo = resolveToken(
    "--gradient-warm-to",
    dark ? "#0F0D0C" : "#FFECB3",
  );

  // For Om, we need the base color without transparency
  // The decorative-om token has transparency, so we use the warm color directly
  // Fallbacks: Turmeric Gold warm-500 (light) / warm-400 (dark)
  const omColor = resolveToken(
    "--color-warm-500",
    dark ? "#E6B830" : "#D4A017",
  );

  return {
    background: {
      type: "gradient",
      gradient: {
        from: gradientFrom,
        to: gradientTo,
      },
    },
    om: omColor,
    // Fallbacks use Sacred Saffron / Turmeric Gold palette
    sanskrit: resolveToken("--text-sanskrit", dark ? "#FFD54F" : "#4A1F06"),
    verseRef: resolveToken("--text-accent", dark ? "#D4A017" : "#8B3E0E"),
    english: resolveToken("--text-primary", dark ? "#E8E4E0" : "#1A1614"),
    hindi: resolveToken("--text-secondary", dark ? "#C8C4C0" : "#57534E"),
    branding: resolveToken("--text-muted", dark ? "#8A8580" : "#78716C"),
    divider: resolveToken("--divider-warm", dark ? "#4A4540" : "#B08914"),
    border: resolveToken("--border-default", dark ? "#3D3835" : "#E7E5E4"),
  };
}

/**
 * Get a friendly name for the current theme (for UI display)
 */
export function getCurrentThemeName(): string {
  // Try to read from theme context storage
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.id) {
        // Capitalize first letter
        return parsed.id.charAt(0).toUpperCase() + parsed.id.slice(1);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return isDarkMode() ? "Dark" : "Light";
}

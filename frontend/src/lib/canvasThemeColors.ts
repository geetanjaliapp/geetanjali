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
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
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
 */
export function getCanvasThemeColors(): CanvasThemeColors {
  const dark = isDarkMode();

  // Get gradient colors for background
  const gradientFrom = resolveToken("--gradient-warm-from", dark ? "#1F2937" : "#FEF3C7");
  const gradientTo = resolveToken("--gradient-warm-to", dark ? "#111827" : "#FED7AA");

  // For Om, we need the base color without transparency
  // The decorative-om token has transparency, so we use the warm color directly
  const omColor = resolveToken("--color-warm-500", dark ? "#FBBF24" : "#F59E0B");

  return {
    background: {
      type: "gradient",
      gradient: {
        from: gradientFrom,
        to: gradientTo,
      },
    },
    om: omColor,
    sanskrit: resolveToken("--text-sanskrit", dark ? "#FCD34D" : "#78350F"),
    verseRef: resolveToken("--text-accent", dark ? "#F59E0B" : "#B45309"),
    english: resolveToken("--text-primary", dark ? "#F3F4F6" : "#1F2937"),
    hindi: resolveToken("--text-secondary", dark ? "#D1D5DB" : "#4B5563"),
    branding: resolveToken("--text-muted", dark ? "#6B7280" : "#9CA3AF"),
    divider: resolveToken("--divider-warm", dark ? "#4B5563" : "#D97706"),
    border: resolveToken("--border-default", dark ? "#374151" : "#E5E7EB"),
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

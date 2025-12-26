/**
 * Theme Utilities (v1.16.0)
 *
 * Functions for theme validation, CSS generation, and application.
 */

import type { ThemeConfig, ThemeColors, ColorScale, ContrastColors } from "../types/theme";
import { STORAGE_KEYS } from "../lib/storage";

/** Color scale names for iteration */
const COLOR_SCALES = [
  "primary",
  "warm",
  "neutral",
  "accent",
  "reading",
  "error",
  "success",
  "warning",
] as const;

/**
 * Validate a color value (hex, rgb, hsl, or CSS color name)
 */
export function isValidColor(value: string): boolean {
  // Basic validation - check for common color formats
  const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const rgbPattern = /^rgba?\([^)]+\)$/;
  const hslPattern = /^hsla?\([^)]+\)$/;
  const varPattern = /^var\(--[^)]+\)$/;

  return (
    hexPattern.test(value) ||
    rgbPattern.test(value) ||
    hslPattern.test(value) ||
    varPattern.test(value)
  );
}

/**
 * Validate a theme configuration
 */
export function validateTheme(theme: ThemeConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!theme.id || typeof theme.id !== "string") {
    errors.push("Theme must have a valid 'id' string");
  }

  if (!theme.name || typeof theme.name !== "string") {
    errors.push("Theme must have a valid 'name' string");
  }

  // Helper to validate a ThemeColors object
  const validateColors = (colors: ThemeColors, prefix: string) => {
    const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;
    for (const scaleName of COLOR_SCALES) {
      const scale = colors[scaleName];
      if (scale) {
        for (const shade of shades) {
          const value = scale[shade];
          if (value !== undefined && !isValidColor(value)) {
            errors.push(`Invalid color value for ${prefix}${scaleName}.${shade}: "${value}"`);
          }
        }
      }
    }
  };

  // Validate colors if provided
  if (theme.colors) {
    validateColors(theme.colors, "");
  }

  // Validate mode-specific colors if provided
  if (theme.modeColors) {
    if (theme.modeColors.light) {
      validateColors(theme.modeColors.light, "modeColors.light.");
    }
    if (theme.modeColors.dark) {
      validateColors(theme.modeColors.dark, "modeColors.dark.");
    }
  }

  // Validate typography if provided
  if (theme.typography) {
    const fontProps = ["display", "body", "sanskrit", "mono"] as const;
    for (const prop of fontProps) {
      const value = theme.typography[prop];
      if (value !== undefined && typeof value !== "string") {
        errors.push(`Typography.${prop} must be a string`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate CSS custom properties from a color scale
 */
function colorScaleToCss(name: string, scale: ColorScale): string[] {
  const properties: string[] = [];
  const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

  for (const shade of shades) {
    const value = scale[shade];
    if (value !== undefined) {
      properties.push(`--color-${name}-${shade}: ${value};`);
    }
  }

  return properties;
}

/**
 * Generate CSS custom properties from contrast colors
 * Includes primitive-level and semantic-level overrides
 */
function contrastColorsToCss(contrast: ContrastColors): string[] {
  const properties: string[] = [];

  // Primitive-level overrides
  if (contrast.onPrimary) {
    properties.push(`--color-on-primary: ${contrast.onPrimary};`);
  }
  if (contrast.onPrimaryMuted) {
    properties.push(`--color-on-primary-muted: ${contrast.onPrimaryMuted};`);
  } else if (contrast.onPrimary) {
    // Auto-generate muted variant if not specified
    properties.push(`--color-on-primary-muted: color-mix(in srgb, ${contrast.onPrimary} 80%, transparent);`);
  }
  if (contrast.onWarm) {
    properties.push(`--color-on-warm: ${contrast.onWarm};`);
  }
  if (contrast.surfacePure) {
    properties.push(`--color-surface-pure: ${contrast.surfacePure};`);
  }

  // Semantic-level overrides (for themes with inverted color scales)
  if (contrast.interactivePrimary) {
    properties.push(`--interactive-primary: ${contrast.interactivePrimary};`);
  }
  if (contrast.interactivePrimaryHover) {
    properties.push(`--interactive-primary-hover: ${contrast.interactivePrimaryHover};`);
  }
  if (contrast.interactivePrimaryActive) {
    properties.push(`--interactive-primary-active: ${contrast.interactivePrimaryActive};`);
  }
  if (contrast.textLink) {
    properties.push(`--text-link: ${contrast.textLink};`);
  }
  if (contrast.textLinkHover) {
    properties.push(`--text-link-hover: ${contrast.textLinkHover};`);
  }
  if (contrast.interactiveGhostText) {
    properties.push(`--interactive-ghost-text: ${contrast.interactiveGhostText};`);
  }
  if (contrast.borderFocus) {
    properties.push(`--border-focus: ${contrast.borderFocus};`);
  }

  return properties;
}

/**
 * Generate CSS custom properties from ThemeColors
 */
function colorsToCssProperties(colors: ThemeColors): string[] {
  const properties: string[] = [];
  for (const scaleName of COLOR_SCALES) {
    const scale = colors[scaleName];
    if (scale) {
      properties.push(...colorScaleToCss(scaleName, scale));
    }
  }
  // Add contrast colors if present
  if (colors.contrast) {
    properties.push(...contrastColorsToCss(colors.contrast));
  }
  return properties;
}

/**
 * Generate non-color CSS properties (typography, spacing, radius)
 */
function nonColorPropertiesToCss(theme: ThemeConfig): string[] {
  const properties: string[] = [];

  // Typography overrides
  if (theme.typography) {
    if (theme.typography.display) {
      properties.push(`--font-family-display: ${theme.typography.display};`);
    }
    if (theme.typography.body) {
      properties.push(`--font-family-body: ${theme.typography.body};`);
    }
    if (theme.typography.sanskrit) {
      properties.push(`--font-family-sanskrit: ${theme.typography.sanskrit};`);
    }
    if (theme.typography.mono) {
      properties.push(`--font-family-mono: ${theme.typography.mono};`);
    }
  }

  // Spacing overrides
  if (theme.spacing?.unit) {
    properties.push(`--spacing-unit: ${theme.spacing.unit};`);
  }

  // Radius overrides
  if (theme.radius) {
    if (theme.radius.sm) properties.push(`--radius-sm: ${theme.radius.sm};`);
    if (theme.radius.md) properties.push(`--radius-md: ${theme.radius.md};`);
    if (theme.radius.lg) properties.push(`--radius-lg: ${theme.radius.lg};`);
    if (theme.radius.xl) properties.push(`--radius-xl: ${theme.radius.xl};`);
    if (theme.radius["2xl"]) properties.push(`--radius-2xl: ${theme.radius["2xl"]};`);
  }

  return properties;
}

/**
 * Generate full CSS from a theme configuration
 * Supports mode-specific colors (light/dark variants)
 */
export function themeToCss(theme: ThemeConfig): string {
  const cssBlocks: string[] = [];

  // Collect light mode properties (shared colors + light-specific + non-color)
  const lightProperties: string[] = [];

  // Add shared colors (applies to both modes if no mode-specific override)
  if (theme.colors) {
    lightProperties.push(...colorsToCssProperties(theme.colors));
  }

  // Add light-specific colors (override shared)
  if (theme.modeColors?.light) {
    lightProperties.push(...colorsToCssProperties(theme.modeColors.light));
  }

  // Add non-color properties (always apply to :root)
  lightProperties.push(...nonColorPropertiesToCss(theme));

  // Generate :root block if we have any properties
  if (lightProperties.length > 0) {
    cssBlocks.push(`:root {\n  ${lightProperties.join("\n  ")}\n}`);
  }

  // Collect dark mode properties
  const darkProperties: string[] = [];

  // If theme has shared colors but no dark-specific, still apply shared to dark
  // (the .dark selector will use the :root primitives)
  // But if we have dark-specific colors, add them
  if (theme.modeColors?.dark) {
    darkProperties.push(...colorsToCssProperties(theme.modeColors.dark));
  }

  // Generate .dark block if we have dark-specific properties
  if (darkProperties.length > 0) {
    cssBlocks.push(`.dark {\n  ${darkProperties.join("\n  ")}\n}`);
  }

  return cssBlocks.join("\n\n");
}

/**
 * Legacy: Generate just the properties (for backward compatibility)
 * @deprecated Use themeToCss instead
 */
export function themeToProperties(theme: ThemeConfig): string {
  const properties: string[] = [];

  if (theme.colors) {
    properties.push(...colorsToCssProperties(theme.colors));
  }

  properties.push(...nonColorPropertiesToCss(theme));

  return properties.join("\n  ");
}

/**
 * Apply a theme to the document by injecting CSS custom properties
 * Supports mode-specific colors with :root and .dark selectors
 */
export function applyTheme(theme: ThemeConfig | null): void {
  const styleId = "custom-theme-overrides";

  // Remove existing theme style
  const existing = document.getElementById(styleId);
  if (existing) {
    existing.remove();
  }

  // If no theme or default theme, no overrides needed
  if (!theme || theme.id === "default") {
    return;
  }

  // Generate CSS (includes :root and .dark blocks as needed)
  const css = themeToCss(theme);
  if (!css) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Remove custom theme overrides
 */
export function removeTheme(): void {
  const styleId = "custom-theme-overrides";
  const existing = document.getElementById(styleId);
  if (existing) {
    existing.remove();
  }
}

/**
 * Save custom theme to localStorage
 */
export function saveThemeToStorage(theme: ThemeConfig | null): void {
  if (theme && theme.id !== "default") {
    localStorage.setItem(STORAGE_KEYS.customTheme, JSON.stringify(theme));
  } else {
    localStorage.removeItem(STORAGE_KEYS.customTheme);
  }
}

/**
 * Load custom theme from localStorage
 */
export function loadThemeFromStorage(): ThemeConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.customTheme);
    if (!stored) return null;

    const theme = JSON.parse(stored) as ThemeConfig;
    const { valid } = validateTheme(theme);
    if (!valid) {
      console.warn("Invalid theme in localStorage, removing");
      localStorage.removeItem(STORAGE_KEYS.customTheme);
      return null;
    }

    return theme;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.customTheme);
    return null;
  }
}

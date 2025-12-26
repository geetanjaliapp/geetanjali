/**
 * Theme Utilities (v1.16.0)
 *
 * Functions for theme validation, CSS generation, and application.
 */

import type { ThemeConfig, ColorScale } from "../types/theme";

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

  // Validate colors if provided
  if (theme.colors) {
    const colorScales = [
      "primary",
      "warm",
      "neutral",
      "accent",
      "reading",
      "error",
      "success",
      "warning",
    ] as const;

    for (const scaleName of colorScales) {
      const scale = theme.colors[scaleName];
      if (scale) {
        const shades = [
          "50",
          "100",
          "200",
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "900",
        ] as const;
        for (const shade of shades) {
          const value = scale[shade];
          if (value !== undefined && !isValidColor(value)) {
            errors.push(
              `Invalid color value for ${scaleName}.${shade}: "${value}"`
            );
          }
        }
      }
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
  const shades = [
    "50",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ] as const;

  for (const shade of shades) {
    const value = scale[shade];
    if (value !== undefined) {
      properties.push(`--color-${name}-${shade}: ${value};`);
    }
  }

  return properties;
}

/**
 * Generate CSS custom properties from a theme configuration
 */
export function themeToCss(theme: ThemeConfig): string {
  const properties: string[] = [];

  // Color overrides
  if (theme.colors) {
    if (theme.colors.primary) {
      properties.push(...colorScaleToCss("primary", theme.colors.primary));
    }
    if (theme.colors.warm) {
      properties.push(...colorScaleToCss("warm", theme.colors.warm));
    }
    if (theme.colors.neutral) {
      properties.push(...colorScaleToCss("neutral", theme.colors.neutral));
    }
    if (theme.colors.accent) {
      properties.push(...colorScaleToCss("accent", theme.colors.accent));
    }
    if (theme.colors.reading) {
      properties.push(...colorScaleToCss("reading", theme.colors.reading));
    }
    if (theme.colors.error) {
      properties.push(...colorScaleToCss("error", theme.colors.error));
    }
    if (theme.colors.success) {
      properties.push(...colorScaleToCss("success", theme.colors.success));
    }
    if (theme.colors.warning) {
      properties.push(...colorScaleToCss("warning", theme.colors.warning));
    }
  }

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
    if (theme.radius.sm) {
      properties.push(`--radius-sm: ${theme.radius.sm};`);
    }
    if (theme.radius.md) {
      properties.push(`--radius-md: ${theme.radius.md};`);
    }
    if (theme.radius.lg) {
      properties.push(`--radius-lg: ${theme.radius.lg};`);
    }
    if (theme.radius.xl) {
      properties.push(`--radius-xl: ${theme.radius.xl};`);
    }
    if (theme.radius["2xl"]) {
      properties.push(`--radius-2xl: ${theme.radius["2xl"]};`);
    }
  }

  return properties.join("\n  ");
}

/**
 * Apply a theme to the document by injecting CSS custom properties
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

  // Generate and inject CSS
  const css = themeToCss(theme);
  if (!css) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `:root {\n  ${css}\n}`;
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
 * localStorage key for custom theme
 */
export const CUSTOM_THEME_KEY = "geetanjali:custom-theme";

/**
 * Save custom theme to localStorage
 */
export function saveThemeToStorage(theme: ThemeConfig | null): void {
  if (theme && theme.id !== "default") {
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(theme));
  } else {
    localStorage.removeItem(CUSTOM_THEME_KEY);
  }
}

/**
 * Load custom theme from localStorage
 */
export function loadThemeFromStorage(): ThemeConfig | null {
  try {
    const stored = localStorage.getItem(CUSTOM_THEME_KEY);
    if (!stored) return null;

    const theme = JSON.parse(stored) as ThemeConfig;
    const { valid } = validateTheme(theme);
    if (!valid) {
      console.warn("Invalid theme in localStorage, removing");
      localStorage.removeItem(CUSTOM_THEME_KEY);
      return null;
    }

    return theme;
  } catch {
    localStorage.removeItem(CUSTOM_THEME_KEY);
    return null;
  }
}

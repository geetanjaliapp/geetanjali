/**
 * Theme Type Definitions (v1.17.0)
 *
 * Defines the structure for customizable themes.
 * Themes override CSS custom properties defined in tokens/primitives.css.
 *
 * Usage:
 * - Create a theme by defining overrides for primitive tokens
 * - Apply themes via ThemeProvider's customTheme prop
 * - Themes are applied as inline CSS custom properties on :root
 */

/**
 * Color scale with 10 shades (50-900)
 * Maps to --color-{name}-{shade} tokens
 */
export interface ColorScale {
  50?: string;
  100?: string;
  200?: string;
  300?: string;
  400?: string;
  500?: string;
  600?: string;
  700?: string;
  800?: string;
  900?: string;
}

/**
 * Typography configuration
 * Maps to --font-family-* and related tokens
 */
export interface ThemeTypography {
  /** Display/heading font family */
  display?: string;
  /** Body text font family */
  body?: string;
  /** Sanskrit/Devanagari font family */
  sanskrit?: string;
  /** Monospace font family */
  mono?: string;
}

/**
 * Spacing scale configuration
 * Maps to --spacing-* tokens
 */
export interface ThemeSpacing {
  /** Base spacing unit (default: 0.25rem) */
  unit?: string;
}

/**
 * Border radius configuration
 * Maps to --radius-* tokens
 */
export interface ThemeRadius {
  /** Small radius (default: 0.125rem) */
  sm?: string;
  /** Medium radius (default: 0.375rem) */
  md?: string;
  /** Large radius (default: 0.5rem) */
  lg?: string;
  /** Extra large radius (default: 0.75rem) */
  xl?: string;
  /** 2XL radius (default: 1rem) */
  "2xl"?: string;
}

/**
 * Color palette configuration
 * Each scale can be partially or fully overridden
 */
export interface ThemeColors {
  /** Primary brand color (default: orange) */
  primary?: ColorScale;
  /** Warm accent color (default: amber) */
  warm?: ColorScale;
  /** Neutral/gray scale */
  neutral?: ColorScale;
  /** Accent color for decorative elements */
  accent?: ColorScale;
  /** Reading mode background color */
  reading?: ColorScale;
  /** Error/danger color */
  error?: ColorScale;
  /** Success color */
  success?: ColorScale;
  /** Warning color */
  warning?: ColorScale;
}

/**
 * Mode-specific color configuration
 * Allows themes to define different colors for light and dark modes
 */
export interface ThemeModeColors {
  /** Colors to apply in light mode */
  light?: ThemeColors;
  /** Colors to apply in dark mode */
  dark?: ThemeColors;
}

/**
 * Complete theme configuration
 * All properties are optional - only override what you need
 *
 * Color precedence:
 * 1. modeColors.light/dark (mode-specific, highest priority)
 * 2. colors (applies to both modes, fallback)
 */
export interface ThemeConfig {
  /** Unique identifier for the theme */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Color palette overrides (applies to both light and dark modes) */
  colors?: ThemeColors;
  /** Mode-specific color overrides (takes precedence over colors) */
  modeColors?: ThemeModeColors;
  /** Typography overrides */
  typography?: ThemeTypography;
  /** Spacing overrides */
  spacing?: ThemeSpacing;
  /** Border radius overrides */
  radius?: ThemeRadius;
}

/**
 * Built-in theme IDs
 */
export type BuiltInThemeId = "default" | "high-contrast" | "serenity" | "forest";

/**
 * Font family preference
 * Separate from color theme for independent control
 */
export type FontFamily = "serif" | "sans" | "mixed";

/**
 * Theme mode (light/dark/system)
 * Separate from custom theme - controls which mode's tokens are active
 */
export type ThemeMode = "light" | "dark" | "system";

/**
 * Resolved theme mode (light or dark)
 */
export type ResolvedThemeMode = "light" | "dark";

/**
 * Full theme state
 */
export interface ThemeState {
  /** Current mode preference */
  mode: ThemeMode;
  /** Resolved mode after applying system preference */
  resolvedMode: ResolvedThemeMode;
  /** Active custom theme (null = default) */
  customTheme: ThemeConfig | null;
}

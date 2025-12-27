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
 * Contrast colors for text on colored backgrounds
 * Also supports semantic-level color overrides for themes with inverted scales
 *
 * IMPORTANT: These semantic overrides are essential for themes that structure
 * their color scales differently from the default Geetanjali theme. Without
 * these overrides, the semantic.css mappings (e.g., text-primary -> neutral-200)
 * may not produce readable results.
 */
export interface ContrastColors {
  /** Text color on primary-colored backgrounds (buttons, badges) */
  onPrimary?: string;
  /** Muted text color on primary-colored backgrounds */
  onPrimaryMuted?: string;
  /** Text color on warm-colored backgrounds */
  onWarm?: string;
  /** Pure surface color (white in light mode, dark in dark mode) */
  surfacePure?: string;

  /* ============================================
     SEMANTIC-LEVEL OVERRIDES
     For themes with inverted/different color scale structures
     ============================================ */

  /* Interactive element overrides */
  /** Override primary button background color */
  interactivePrimary?: string;
  /** Override primary button hover background */
  interactivePrimaryHover?: string;
  /** Override primary button active background */
  interactivePrimaryActive?: string;
  /** Override ghost button text color */
  interactiveGhostText?: string;

  /* Text color overrides - CRITICAL for dark mode readability */
  /** Override primary text color (main content) */
  textPrimary?: string;
  /** Override secondary text color (labels, supporting text) */
  textSecondary?: string;
  /** Override tertiary text color (less important text) */
  textTertiary?: string;
  /** Override muted text color (placeholders, disabled) */
  textMuted?: string;
  /** Override primary link color */
  textLink?: string;
  /** Override primary link hover color */
  textLinkHover?: string;

  /* Surface color overrides - for proper layering */
  /** Override base page background */
  surfacePage?: string;
  /** Override elevated surface (cards, modals) */
  surfaceElevated?: string;
  /** Override card surface */
  surfaceCard?: string;
  /** Override muted surface */
  surfaceMuted?: string;

  /* Input/form overrides */
  /** Override input background */
  inputBg?: string;
  /** Override input border */
  inputBorder?: string;

  /* Border overrides */
  /** Override focus ring color */
  borderFocus?: string;
  /** Override default border */
  borderDefault?: string;

  /* Menu/nav item colors */
  /** Override selected menu item background */
  menuItemSelectedBg?: string;
  /** Override selected menu item text */
  menuItemSelectedText?: string;
  /** Override menu item hover background */
  menuItemHoverBg?: string;

  /* Badge colors - for themes with inverted warm scales */
  /** Override warm badge background */
  badgeWarmBg?: string;
  /** Override warm badge hover background */
  badgeWarmHover?: string;
  /** Override warm badge text color */
  badgeWarmText?: string;
  /** Override principle badge background */
  badgePrincipleBg?: string;
  /** Override principle badge text color */
  badgePrincipleText?: string;
  /** Override selected chip background */
  chipSelectedBg?: string;
  /** Override selected chip text color */
  chipSelectedText?: string;

  /* Reading mode surface overrides - for theme-harmonious reading experience */
  /** Override reading mode base surface */
  surfaceReading?: string;
  /** Override reading mode header/nav background */
  surfaceReadingHeader?: string;
  /** Override reading mode primary text */
  textReadingPrimary?: string;
  /** Override reading mode secondary text */
  textReadingSecondary?: string;
  /** Override reading mode muted text */
  textReadingMuted?: string;
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
  /** Contrast colors for text on colored backgrounds */
  contrast?: ContrastColors;
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
  /** Suggested default font family for this theme */
  defaultFontFamily?: FontFamily;
}

/**
 * Built-in theme IDs
 */
export type BuiltInThemeId = "default" | "sutra" | "serenity" | "forest";

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

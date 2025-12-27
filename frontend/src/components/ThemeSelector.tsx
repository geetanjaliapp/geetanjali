/**
 * Theme Selector Component (v1.19.0)
 *
 * Card-based theme selector with color swatch previews.
 * Shows theme name, colors, and description for easy comparison.
 *
 * Layout: 2 columns on mobile, 4 columns on desktop
 * Following "platter style" - all options visible, not hidden.
 *
 * Themes:
 * - Geetanjali: Warm amber/orange (default)
 * - Sutra: Monochrome slate/black/white
 * - Serenity: Deep violet/lavender/rose
 * - Forest: Emerald/sage/teal
 */

import { useTheme } from "../contexts/ThemeContext";
import type { ThemeConfig } from "../types/theme";

/** Geetanjali (default) theme colors (matches primitives.css) */
const DEFAULT_COLORS = {
  primary: "#ea580c", // orange-600
  warm: "#fef3c7", // amber-100
  accent: "#f59e0b", // amber-500
};

/**
 * Get preview colors for a theme
 * Checks modeColors.light first (new format), then falls back to colors (legacy)
 */
function getThemePreviewColors(theme: ThemeConfig | null): {
  primary: string;
  warm: string;
  accent: string;
} {
  if (!theme) return DEFAULT_COLORS;

  // Check modeColors.light first (v1.16.0+ format), then fall back to colors
  const lightColors = theme.modeColors?.light;
  const sharedColors = theme.colors;

  return {
    primary:
      lightColors?.primary?.[600] ??
      lightColors?.primary?.[500] ??
      sharedColors?.primary?.[600] ??
      DEFAULT_COLORS.primary,
    warm:
      lightColors?.warm?.[100] ??
      lightColors?.warm?.[50] ??
      sharedColors?.warm?.[100] ??
      DEFAULT_COLORS.warm,
    accent:
      lightColors?.accent?.[500] ??
      lightColors?.accent?.[400] ??
      sharedColors?.accent?.[500] ??
      DEFAULT_COLORS.accent,
  };
}

/**
 * Theme card with color swatches and description
 */
function ThemeCard({
  theme,
  isSelected,
  onSelect,
}: {
  theme: ThemeConfig | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const colors = getThemePreviewColors(theme);
  const name = theme?.name ?? "Geetanjali";
  const description = theme?.description ?? "Temple lamp glow, ancient manuscript warmth";

  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${name} theme: ${description}${isSelected ? " (selected)" : ""}`}
      className={`
        w-full p-3 rounded-[var(--radius-card)] border-2 transition-[var(--transition-all)]
        text-left
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-[var(--surface-elevated)]
        ${
          isSelected
            ? "bg-[var(--chip-selected-bg)] border-[var(--chip-selected-ring)] ring-1 ring-[var(--chip-selected-ring)]"
            : "bg-[var(--surface-muted)] border-transparent hover:border-[var(--border-default)] hover:bg-[var(--surface-field)]"
        }
      `}
    >
      {/* Color swatches row */}
      <div className="flex gap-1 mb-2">
        <div
          className="h-5 flex-1 rounded-[var(--radius-skeleton)]"
          style={{ backgroundColor: colors.primary }}
          aria-hidden="true"
        />
        <div
          className="h-5 flex-1 rounded-[var(--radius-skeleton)]"
          style={{ backgroundColor: colors.warm }}
          aria-hidden="true"
        />
        <div
          className="h-5 flex-1 rounded-[var(--radius-skeleton)]"
          style={{ backgroundColor: colors.accent }}
          aria-hidden="true"
        />
      </div>

      {/* Theme name */}
      <div
        className={`text-sm font-medium mb-0.5 ${
          isSelected ? "text-[var(--chip-selected-text)]" : "text-[var(--text-primary)]"
        }`}
      >
        {name}
      </div>

      {/* Theme description */}
      <div
        className={`text-xs leading-tight ${
          isSelected ? "text-[var(--chip-selected-text)] opacity-80" : "text-[var(--text-muted)]"
        }`}
      >
        {description}
      </div>
    </button>
  );
}

/**
 * Theme Selector - card grid of theme options
 */
export function ThemeSelector() {
  const { customTheme, setCustomThemeById, availableThemes } = useTheme();

  const selectedId = customTheme?.id ?? "default";

  return (
    <div>
      <label
        id="theme-palette-label"
        className="text-sm text-[var(--text-secondary)] block mb-2"
      >
        Color Palette
      </label>
      <div
        role="radiogroup"
        aria-labelledby="theme-palette-label"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {/* Default theme */}
        <ThemeCard
          theme={null}
          isSelected={selectedId === "default"}
          onSelect={() => setCustomThemeById("default")}
        />

        {/* Other themes */}
        {availableThemes
          .filter((t) => t.id !== "default")
          .map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={selectedId === theme.id}
              onSelect={() => setCustomThemeById(theme.id)}
            />
          ))}
      </div>
    </div>
  );
}

export default ThemeSelector;

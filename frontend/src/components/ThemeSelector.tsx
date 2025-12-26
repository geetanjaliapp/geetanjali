/**
 * Theme Selector Component (v1.16.0)
 *
 * Displays available theme palettes and allows selection.
 * Shows color swatches for each theme.
 */

import { useTheme } from "../contexts/ThemeContext";
import type { ThemeConfig } from "../types/theme";
import { CheckIcon } from "./icons";

/** Default theme color values (matches primitives.css) */
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
 * Theme option card - unified component for all theme options
 */
function ThemeOptionCard({
  name,
  colors,
  isSelected,
  isDefault,
  onSelect,
}: {
  name: string;
  colors: { primary: string; warm: string; accent: string };
  isSelected: boolean;
  isDefault?: boolean;
  onSelect: () => void;
}) {
  const label = isDefault
    ? `${name} theme (default)${isSelected ? " (selected)" : ""}`
    : `${name} theme${isSelected ? " (selected)" : ""}`;

  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[var(--border-focus)] bg-[var(--surface-warm)] ring-2 ring-[var(--border-focus)] ring-offset-2 ring-offset-[var(--surface-elevated)]"
          : "border-[var(--border-default)] bg-[var(--surface-muted)] hover:border-[var(--border-warm)]"
      }`}
      aria-label={label}
    >
      {/* Color swatches */}
      <div className="flex gap-1">
        <div
          className="w-6 h-6 rounded-full shadow-sm"
          style={{ backgroundColor: colors.primary }}
          title="Primary"
        />
        <div
          className="w-6 h-6 rounded-full shadow-sm border border-[var(--border-default)]"
          style={{ backgroundColor: colors.warm }}
          title="Warm"
        />
        <div
          className="w-6 h-6 rounded-full shadow-sm"
          style={{ backgroundColor: colors.accent }}
          title="Accent"
        />
      </div>

      {/* Theme name */}
      <span
        className={`text-xs font-medium ${
          isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {name}
      </span>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--interactive-primary)] text-white rounded-full flex items-center justify-center">
          <CheckIcon className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

/**
 * Theme Selector - shows available themes as selectable cards
 */
export function ThemeSelector() {
  const { customTheme, setCustomThemeById, availableThemes } = useTheme();

  const selectedId = customTheme?.id ?? "default";

  return (
    <div>
      <label
        id="theme-palette-label"
        className="text-sm text-[var(--text-secondary)] block mb-1.5"
      >
        Color Palette
      </label>
      <div
        role="radiogroup"
        aria-labelledby="theme-palette-label"
        className="flex flex-wrap gap-2"
      >
        {/* Default theme */}
        <ThemeOptionCard
          name="Geetanjali"
          colors={DEFAULT_COLORS}
          isSelected={selectedId === "default"}
          isDefault
          onSelect={() => setCustomThemeById("default")}
        />

        {/* Other themes */}
        {availableThemes
          .filter((t) => t.id !== "default")
          .map((theme) => (
            <ThemeOptionCard
              key={theme.id}
              name={theme.name}
              colors={getThemePreviewColors(theme)}
              isSelected={selectedId === theme.id}
              onSelect={() => setCustomThemeById(theme.id)}
            />
          ))}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2">
        {customTheme
          ? customTheme.description || `Using ${customTheme.name} palette`
          : "Default warm amber and orange palette"}
      </p>
    </div>
  );
}

export default ThemeSelector;

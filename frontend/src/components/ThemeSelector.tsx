/**
 * Theme Selector Component (v1.16.0)
 *
 * Displays available theme palettes and allows selection.
 * Shows color swatches for each theme.
 */

import { useTheme } from "../contexts/ThemeContext";
import type { ThemeConfig } from "../types/theme";
import { CheckIcon } from "./icons";

/**
 * Get preview colors for a theme
 */
function getThemePreviewColors(theme: ThemeConfig): {
  primary: string;
  warm: string;
  accent: string;
} {
  // Default colors
  const defaults = {
    primary: "#ea580c", // orange-600
    warm: "#fef3c7", // amber-100
    accent: "#f59e0b", // amber-500
  };

  return {
    primary: theme.colors?.primary?.[600] ?? defaults.primary,
    warm: theme.colors?.warm?.[100] ?? defaults.warm,
    accent: theme.colors?.accent?.[500] ?? defaults.accent,
  };
}

/**
 * Single theme option card
 */
function ThemeOption({
  theme,
  isSelected,
  onSelect,
}: {
  theme: ThemeConfig;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const colors = getThemePreviewColors(theme);

  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[var(--border-focus)] bg-[var(--surface-warm)] ring-2 ring-[var(--border-focus)] ring-offset-2 ring-offset-[var(--surface-elevated)]"
          : "border-[var(--border-default)] bg-[var(--surface-muted)] hover:border-[var(--border-warm)]"
      }`}
      aria-pressed={isSelected}
      aria-label={`${theme.name} theme${isSelected ? " (selected)" : ""}`}
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
        {theme.name}
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
 * Default theme option (no color overrides)
 */
function DefaultThemeOption({
  isSelected,
  onSelect,
}: {
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[var(--border-focus)] bg-[var(--surface-warm)] ring-2 ring-[var(--border-focus)] ring-offset-2 ring-offset-[var(--surface-elevated)]"
          : "border-[var(--border-default)] bg-[var(--surface-muted)] hover:border-[var(--border-warm)]"
      }`}
      aria-pressed={isSelected}
      aria-label={`Geetanjali theme (default)${isSelected ? " (selected)" : ""}`}
    >
      {/* Color swatches - default warm amber/orange */}
      <div className="flex gap-1">
        <div
          className="w-6 h-6 rounded-full shadow-sm bg-orange-600"
          title="Primary"
        />
        <div
          className="w-6 h-6 rounded-full shadow-sm border border-[var(--border-default)] bg-amber-100"
          title="Warm"
        />
        <div
          className="w-6 h-6 rounded-full shadow-sm bg-amber-500"
          title="Accent"
        />
      </div>

      {/* Theme name */}
      <span
        className={`text-xs font-medium ${
          isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        }`}
      >
        Geetanjali
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
      <label className="text-sm text-[var(--text-secondary)] block mb-1.5">
        Color Palette
      </label>
      <div className="flex flex-wrap gap-2">
        {/* Default theme */}
        <DefaultThemeOption
          isSelected={selectedId === "default"}
          onSelect={() => setCustomThemeById("default")}
        />

        {/* Other themes (skip default since we show it specially) */}
        {availableThemes
          .filter((t) => t.id !== "default")
          .map((theme) => (
            <ThemeOption
              key={theme.id}
              theme={theme}
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

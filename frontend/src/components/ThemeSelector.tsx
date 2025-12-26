/**
 * Theme Selector Component (v1.17.0)
 *
 * Compact circular theme selector with conic gradient previews.
 * Shows theme colors at a glance with selected theme description below.
 */

import { useTheme } from "../contexts/ThemeContext";
import type { ThemeConfig } from "../types/theme";

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
 * Compact circular theme indicator with conic gradient
 */
function ThemeIndicator({
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

  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${name} theme${isSelected ? " (selected)" : ""}`}
      title={name}
      className={`
        w-9 h-9 rounded-full transition-all duration-150 ease-out
        border-2 shadow-sm
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-[var(--surface-elevated)]
        ${
          isSelected
            ? "border-[var(--border-focus)] scale-110 shadow-md"
            : "border-transparent hover:scale-105 hover:shadow"
        }
      `}
      style={{
        background: `conic-gradient(
          ${colors.primary} 0deg 120deg,
          ${colors.warm} 120deg 240deg,
          ${colors.accent} 240deg 360deg
        )`,
      }}
    />
  );
}

/**
 * Theme Selector - compact row of circular color indicators
 */
export function ThemeSelector() {
  const { customTheme, setCustomThemeById, availableThemes } = useTheme();

  const selectedId = customTheme?.id ?? "default";
  const selectedTheme =
    availableThemes.find((t) => t.id === selectedId) ?? null;

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
        className="flex items-center gap-2"
      >
        {/* Default theme */}
        <ThemeIndicator
          theme={null}
          isSelected={selectedId === "default"}
          onSelect={() => setCustomThemeById("default")}
        />

        {/* Other themes */}
        {availableThemes
          .filter((t) => t.id !== "default")
          .map((theme) => (
            <ThemeIndicator
              key={theme.id}
              theme={theme}
              isSelected={selectedId === theme.id}
              onSelect={() => setCustomThemeById(theme.id)}
            />
          ))}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2">
        <span className="font-medium text-[var(--text-secondary)]">
          {selectedTheme?.name ?? "Geetanjali"}
        </span>
        {" — "}
        {selectedTheme?.description ?? "Warm amber inspired by ancient manuscripts"}
      </p>
    </div>
  );
}

export default ThemeSelector;

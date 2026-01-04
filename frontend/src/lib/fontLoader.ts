/**
 * Font Loader Utility (v1.21.0)
 *
 * Manages lazy loading of theme-specific fonts to optimize initial page load.
 *
 * Strategy:
 * - Devanagari (Sanskrit) + Geetanjali (default) fonts loaded initially via index.css
 * - Other theme fonts (sutra, serenity, forest) loaded on-demand when theme changes
 * - Uses CSS dynamic imports for Vite-native code splitting
 * - Tracks loaded themes to prevent duplicate loading
 *
 * Font Architecture:
 * - /public/fonts/{theme}/*.woff2 - Self-hosted font files
 * - /src/styles/fonts/{theme}.css - @font-face declarations
 */

/**
 * Theme font CSS file paths (excluding default/geetanjali which is always loaded)
 *
 * Maps theme ID to dynamic import function.
 * Vite will code-split these and load on demand.
 */
const themeFontModules: Record<string, () => Promise<unknown>> = {
  sutra: () => import("../styles/fonts/sutra.css"),
  serenity: () => import("../styles/fonts/serenity.css"),
  forest: () => import("../styles/fonts/forest.css"),
};

/**
 * Tracks which theme fonts have been loaded.
 * 'default' and 'geetanjali' are always pre-loaded via index.css.
 */
const loadedThemes = new Set<string>(["default", "geetanjali"]);

/**
 * Tracks in-flight loading promises to prevent duplicate requests
 */
const loadingPromises = new Map<string, Promise<void>>();

/**
 * Load fonts for a specific theme.
 *
 * @param themeId - Theme identifier (default, geetanjali, sutra, serenity, forest)
 * @returns Promise that resolves when fonts are loaded (or immediately if already loaded)
 *
 * @example
 * ```ts
 * // In ThemeContext before applying theme
 * await loadThemeFonts('sutra');
 * setCustomThemeById('sutra');
 * ```
 */
export async function loadThemeFonts(themeId: string): Promise<void> {
  // Normalize theme ID - 'default' maps to 'geetanjali'
  const normalizedId = themeId === "default" ? "geetanjali" : themeId;

  // Already loaded - return immediately
  if (loadedThemes.has(normalizedId)) {
    return;
  }

  // Already loading - return existing promise
  if (loadingPromises.has(normalizedId)) {
    return loadingPromises.get(normalizedId);
  }

  // Get the loader for this theme
  const loader = themeFontModules[normalizedId];
  if (!loader) {
    // Unknown theme - might be custom, nothing to load
    console.warn(`[fontLoader] No font module for theme: ${normalizedId}`);
    return;
  }

  // Create loading promise
  const loadPromise = (async () => {
    try {
      await loader();
      loadedThemes.add(normalizedId);
    } finally {
      loadingPromises.delete(normalizedId);
    }
  })();

  loadingPromises.set(normalizedId, loadPromise);
  return loadPromise;
}

/**
 * Check if a theme's fonts are already loaded.
 *
 * @param themeId - Theme identifier
 * @returns true if fonts are loaded, false otherwise
 */
export function isThemeFontsLoaded(themeId: string): boolean {
  const normalizedId = themeId === "default" ? "geetanjali" : themeId;
  return loadedThemes.has(normalizedId);
}

/**
 * Preload fonts for a theme without blocking.
 * Useful for prefetching fonts on theme picker hover.
 *
 * @param themeId - Theme identifier to preload
 */
export function preloadThemeFonts(themeId: string): void {
  // Fire and forget - don't await
  loadThemeFonts(themeId).catch(() => {
    // Silently ignore preload failures
  });
}

/**
 * Get list of loaded theme font IDs.
 * Useful for debugging.
 */
export function getLoadedThemes(): string[] {
  return Array.from(loadedThemes);
}

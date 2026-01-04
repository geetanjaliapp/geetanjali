/**
 * Theme Context (v1.18.0)
 *
 * Provides theme state management with:
 * - Mode: 'light' | 'dark' | 'system'
 * - Custom theme: Optional theme configuration that overrides primitives
 * - Font family: Separate font preference (serif/sans/mixed)
 * - Cross-device sync: Syncs to backend for authenticated users
 * - Analytics: Tracks theme changes via Umami
 *
 * Persists to localStorage and respects prefers-color-scheme.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import type { ThemeConfig, FontFamily } from "../types/theme";
import type { Theme } from "../types";
import {
  applyTheme as applyCustomTheme,
  loadThemeFromStorage,
  saveThemeToStorage,
} from "../utils/theme";
import { getThemeById, builtInThemes } from "../config/themes";
import { THEME_FONTS, DEFAULT_FONT_FAMILY } from "../config/fonts";
import { STORAGE_KEYS, setStorageItemRaw } from "../lib/storage";
import { loadThemeFonts } from "../lib/fontLoader";
import { useAuth } from "./AuthContext";
import { syncEngine } from "../lib/syncEngine";

// Declare Umami types
declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

// Re-export Theme from types for backward compatibility
export type { Theme };
export type ResolvedTheme = "light" | "dark";

// Context type
interface ThemeContextType {
  /** Current theme mode setting (light/dark/system) */
  theme: Theme;
  /** Resolved theme mode after applying system preference */
  resolvedTheme: ResolvedTheme;
  /** Set theme mode preference */
  setTheme: (theme: Theme) => void;
  /** Cycle to next theme mode (light → dark → system → light) */
  cycleTheme: () => void;
  /** Active custom theme (null = default) */
  customTheme: ThemeConfig | null;
  /** Set custom theme by config (loads fonts before applying) */
  setCustomTheme: (theme: ThemeConfig | null) => Promise<void>;
  /** Set custom theme by ID (built-in themes, loads fonts before applying) */
  setCustomThemeById: (id: string) => Promise<void>;
  /** Available built-in themes */
  availableThemes: ThemeConfig[];
  /** Current font family preference */
  fontFamily: FontFamily;
  /** Set font family preference */
  setFontFamily: (family: FontFamily) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Get system preference
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  // Handle environments where matchMedia is not available (e.g., jsdom)
  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  return mediaQuery?.matches ? "dark" : "light";
}

// Get stored theme mode or default to system
function getStoredThemeMode(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

// Get stored custom theme ID
function getStoredThemeId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.themeId);
}

// Get stored font family
function getStoredFontFamily(): FontFamily {
  if (typeof window === "undefined") return DEFAULT_FONT_FAMILY;
  const stored = localStorage.getItem(STORAGE_KEYS.fontFamily);
  if (stored === "serif" || stored === "sans" || stored === "mixed") {
    return stored;
  }
  return DEFAULT_FONT_FAMILY;
}

// Get initial custom theme
function getInitialCustomTheme(): ThemeConfig | null {
  // First check for custom theme in storage
  const customTheme = loadThemeFromStorage();
  if (customTheme) return customTheme;

  // Then check for built-in theme ID
  const themeId = getStoredThemeId();
  if (themeId && themeId !== "default") {
    return getThemeById(themeId) || null;
  }

  return null;
}

// Resolve theme to light/dark
function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return getSystemTheme();
  }
  return theme;
}

// Apply theme mode to document (adds/removes .dark class)
function applyThemeMode(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Apply theme-specific fonts to document
function applyThemeFonts(themeId: string) {
  const styleId = "theme-fonts";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }

  const fonts = THEME_FONTS[themeId] || THEME_FONTS.default;
  style.textContent = `
    :root {
      --font-family-display: ${fonts.display};
      --font-family-body: ${fonts.body};
    }
  `;
}

// Update theme timestamp
function updateThemeTimestamp(): string {
  const now = new Date().toISOString();
  setStorageItemRaw(STORAGE_KEYS.themeUpdatedAt, now);
  return now;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { isAuthenticated } = useAuth();

  const [theme, setThemeState] = useState<Theme>(getStoredThemeMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredThemeMode()),
  );
  const [customTheme, setCustomThemeState] = useState<ThemeConfig | null>(
    getInitialCustomTheme,
  );
  const [fontFamily, setFontFamilyState] =
    useState<FontFamily>(getStoredFontFamily);

  // Refs for current values (to avoid stale closures in callbacks)
  const themeRef = useRef(theme);
  const customThemeRef = useRef(customTheme);
  const fontFamilyRef = useRef(fontFamily);

  // Keep refs in sync with state (must be in useEffect per React rules)
  useEffect(() => {
    themeRef.current = theme;
    customThemeRef.current = customTheme;
    fontFamilyRef.current = fontFamily;
  }, [theme, customTheme, fontFamily]);

  /**
   * Sync theme to server (via SyncEngine)
   *
   * Uses SyncEngine for debouncing and batching.
   */
  const syncToServer = useCallback(() => {
    if (!isAuthenticated) return;

    syncEngine.update("theme", {
      mode: themeRef.current,
      theme_id: customThemeRef.current?.id ?? "default",
      font_family: fontFamilyRef.current,
    });
  }, [isAuthenticated]);

  /**
   * Listen for storage changes from other tabs or PreferencesContext merge.
   * Updates React state when localStorage is updated externally.
   */
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || event.storageArea !== localStorage) return;

      // Theme mode changed
      if (event.key === STORAGE_KEYS.theme && event.newValue) {
        const newMode = event.newValue as Theme;
        if (newMode !== themeRef.current) {
          setThemeState(newMode);
          const resolved = resolveTheme(newMode);
          setResolvedTheme(resolved);
          applyThemeMode(resolved);
        }
      }

      // Theme ID changed
      if (event.key === STORAGE_KEYS.themeId) {
        const newThemeId = event.newValue || "default";
        const currentThemeId = customThemeRef.current?.id ?? "default";
        if (newThemeId !== currentThemeId) {
          // Load fonts for cross-tab theme sync (fire-and-forget for storage events)
          loadThemeFonts(newThemeId).then(() => {
            if (newThemeId === "default") {
              setCustomThemeState(null);
              applyCustomTheme(null);
            } else {
              const newTheme = getThemeById(newThemeId);
              if (newTheme) {
                setCustomThemeState(newTheme);
                applyCustomTheme(newTheme);
              }
            }
            applyThemeFonts(newThemeId);
          });
        }
      }

      // Font family changed
      if (event.key === STORAGE_KEYS.fontFamily && event.newValue) {
        const newFamily = event.newValue as FontFamily;
        if (newFamily !== fontFamilyRef.current) {
          setFontFamilyState(newFamily);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Set theme mode and persist
  const setTheme = useCallback(
    (newTheme: Theme) => {
      const previousTheme = themeRef.current;
      setThemeState(newTheme);
      setStorageItemRaw(STORAGE_KEYS.theme, newTheme);
      updateThemeTimestamp();
      const resolved = resolveTheme(newTheme);
      setResolvedTheme(resolved);
      applyThemeMode(resolved);

      // Track with Umami
      if (previousTheme !== newTheme) {
        window.umami?.track("theme_mode_change", {
          from: previousTheme,
          to: newTheme,
        });
      }

      // Sync to server if authenticated
      syncToServer();
    },
    [syncToServer],
  );

  // Cycle through theme modes: light → dark → system → light
  const cycleTheme = useCallback(() => {
    setTheme(
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light",
    );
  }, [theme, setTheme]);

  // Set custom theme by config
  const setCustomTheme = useCallback(
    async (newTheme: ThemeConfig | null) => {
      const previousThemeId = customThemeRef.current?.id ?? "default";
      const newThemeId = newTheme?.id ?? "default";

      // Load theme fonts before applying (prevents FOUT on theme switch)
      await loadThemeFonts(newThemeId);

      setCustomThemeState(newTheme);
      applyCustomTheme(newTheme);

      // Apply theme-specific fonts
      applyThemeFonts(newThemeId);
      updateThemeTimestamp();

      // Persist
      if (newTheme) {
        setStorageItemRaw(STORAGE_KEYS.themeId, newTheme.id);
        // Only save full config for non-built-in themes
        if (!getThemeById(newTheme.id)) {
          saveThemeToStorage(newTheme);
        } else {
          saveThemeToStorage(null);
        }
      } else {
        localStorage.removeItem(STORAGE_KEYS.themeId);
        saveThemeToStorage(null);
      }

      // Track with Umami
      if (previousThemeId !== newThemeId) {
        window.umami?.track("theme_palette_change", {
          from: previousThemeId,
          to: newThemeId,
        });
      }

      // Sync to server if authenticated
      syncToServer();
    },
    [syncToServer],
  );

  // Set custom theme by ID (built-in themes)
  const setCustomThemeById = useCallback(
    async (id: string) => {
      if (id === "default") {
        await setCustomTheme(null);
      } else {
        const theme = getThemeById(id);
        if (theme) {
          await setCustomTheme(theme);
        }
      }
    },
    [setCustomTheme],
  );

  // Set font family and persist (fonts are applied via theme-specific applyThemeFonts)
  const setFontFamily = useCallback(
    (family: FontFamily) => {
      const previousFamily = fontFamilyRef.current;
      setFontFamilyState(family);
      setStorageItemRaw(STORAGE_KEYS.fontFamily, family);
      updateThemeTimestamp();

      // Track with Umami
      if (previousFamily !== family) {
        window.umami?.track("font_family_change", {
          from: previousFamily,
          to: family,
        });
      }

      // Sync to server if authenticated
      syncToServer();
    },
    [syncToServer],
  );

  // Listen for system preference changes
  useEffect(() => {
    // Handle environments where matchMedia is not available (e.g., jsdom)
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Guard against environments where matchMedia returns undefined
    if (!mediaQuery) return;

    const handleChange = () => {
      if (theme === "system") {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyThemeMode(resolved);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Apply theme mode on mount (handles SSR hydration)
  useEffect(() => {
    applyThemeMode(resolvedTheme);
  }, [resolvedTheme]);

  // Apply custom theme and theme fonts on mount
  // Also load theme fonts if a non-default theme is persisted
  useEffect(() => {
    const themeId = customTheme?.id ?? "default";

    // Load fonts first (for non-default themes), then apply
    loadThemeFonts(themeId).then(() => {
      applyCustomTheme(customTheme);
      applyThemeFonts(themeId);
    });
  }, [customTheme]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      cycleTheme,
      customTheme,
      setCustomTheme,
      setCustomThemeById,
      availableThemes: builtInThemes,
      fontFamily,
      setFontFamily,
    }),
    [
      theme,
      resolvedTheme,
      setTheme,
      cycleTheme,
      customTheme,
      setCustomTheme,
      setCustomThemeById,
      fontFamily,
      setFontFamily,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

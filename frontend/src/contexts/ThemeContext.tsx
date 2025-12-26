/**
 * Theme Context (v1.17.0)
 *
 * Provides theme state management with:
 * - Mode: 'light' | 'dark' | 'system'
 * - Custom theme: Optional theme configuration that overrides primitives
 * - Font family: Separate font preference (serif/sans/mixed)
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
  type ReactNode,
} from "react";

import type { ThemeConfig, FontFamily } from "../types/theme";
import {
  applyTheme as applyCustomTheme,
  loadThemeFromStorage,
  saveThemeToStorage,
} from "../utils/theme";
import { getThemeById, builtInThemes } from "../config/themes";
import { FONT_FAMILIES, DEFAULT_FONT_FAMILY } from "../config/fonts";
import { STORAGE_KEYS } from "../lib/storage";

// Theme mode options
export type Theme = "light" | "dark" | "system";
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
  /** Set custom theme by config */
  setCustomTheme: (theme: ThemeConfig | null) => void;
  /** Set custom theme by ID (built-in themes) */
  setCustomThemeById: (id: string) => void;
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

// Apply font family to document via CSS custom properties
function applyFontFamily(family: FontFamily) {
  const styleId = "font-family-override";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }

  const fonts = FONT_FAMILIES[family];
  style.textContent = `
    :root {
      --font-family-display: ${fonts.display};
      --font-family-body: ${fonts.body};
    }
  `;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(getStoredThemeMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredThemeMode()),
  );
  const [customTheme, setCustomThemeState] = useState<ThemeConfig | null>(
    getInitialCustomTheme,
  );
  const [fontFamily, setFontFamilyState] =
    useState<FontFamily>(getStoredFontFamily);

  // Set theme mode and persist
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEYS.theme, newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyThemeMode(resolved);
  }, []);

  // Cycle through theme modes: light → dark → system → light
  const cycleTheme = useCallback(() => {
    setTheme(
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light",
    );
  }, [theme, setTheme]);

  // Set custom theme by config
  const setCustomTheme = useCallback((newTheme: ThemeConfig | null) => {
    setCustomThemeState(newTheme);
    applyCustomTheme(newTheme);

    // Persist
    if (newTheme) {
      localStorage.setItem(STORAGE_KEYS.themeId, newTheme.id);
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
  }, []);

  // Set custom theme by ID (built-in themes)
  const setCustomThemeById = useCallback(
    (id: string) => {
      if (id === "default") {
        setCustomTheme(null);
      } else {
        const theme = getThemeById(id);
        if (theme) {
          setCustomTheme(theme);
        }
      }
    },
    [setCustomTheme],
  );

  // Set font family and persist
  const setFontFamily = useCallback((family: FontFamily) => {
    setFontFamilyState(family);
    localStorage.setItem(STORAGE_KEYS.fontFamily, family);
    applyFontFamily(family);
  }, []);

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

  // Apply custom theme on mount
  useEffect(() => {
    applyCustomTheme(customTheme);
  }, [customTheme]);

  // Apply font family on mount
  useEffect(() => {
    applyFontFamily(fontFamily);
  }, [fontFamily]);

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

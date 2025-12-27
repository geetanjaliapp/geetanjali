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
import {
  applyTheme as applyCustomTheme,
  loadThemeFromStorage,
  saveThemeToStorage,
} from "../utils/theme";
import { getThemeById, builtInThemes } from "../config/themes";
import { THEME_FONTS, DEFAULT_FONT_FAMILY } from "../config/fonts";
import { STORAGE_KEYS, setStorageItemRaw } from "../lib/storage";
import { useAuth } from "./AuthContext";
import { preferencesApi } from "../lib/api";

// Declare Umami types
declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

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

// Get stored theme updated timestamp
function getStoredThemeUpdatedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.themeUpdatedAt);
}

// Update theme timestamp
function updateThemeTimestamp(): string {
  const now = new Date().toISOString();
  setStorageItemRaw(STORAGE_KEYS.themeUpdatedAt, now);
  return now;
}

// Sync configuration
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds debounce for theme sync
const MERGE_THROTTLE_MS = 10000; // 10 seconds throttle for merge calls

// Module-level timestamps for rate limiting
let lastMergeTimestamp = 0;
let lastSyncTimestamp = 0;

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { isAuthenticated, user } = useAuth();

  const [theme, setThemeState] = useState<Theme>(getStoredThemeMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredThemeMode()),
  );
  const [customTheme, setCustomThemeState] = useState<ThemeConfig | null>(
    getInitialCustomTheme,
  );
  const [fontFamily, setFontFamilyState] =
    useState<FontFamily>(getStoredFontFamily);

  // Track user ID to detect login/logout
  const previousUserIdRef = useRef<string | null>(null);
  // Debounce timer ref
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we're currently syncing to prevent duplicate calls
  const isSyncingRef = useRef(false);

  // Refs for current values (to avoid stale closures in callbacks)
  const themeRef = useRef(theme);
  const customThemeRef = useRef(customTheme);
  const fontFamilyRef = useRef(fontFamily);
  themeRef.current = theme;
  customThemeRef.current = customTheme;
  fontFamilyRef.current = fontFamily;

  /**
   * Sync theme to server (debounced)
   */
  const syncToServer = useCallback(() => {
    if (!isAuthenticated) return;

    // Clear existing timeout (debounce)
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce the sync
    syncTimeoutRef.current = setTimeout(async () => {
      if (isSyncingRef.current) return;

      // Throttle check
      const now = Date.now();
      if (now - lastSyncTimestamp < SYNC_DEBOUNCE_MS) {
        return;
      }
      lastSyncTimestamp = now;
      isSyncingRef.current = true;

      try {
        await preferencesApi.update({
          theme: {
            mode: themeRef.current,
            theme_id: customThemeRef.current?.id ?? "default",
            font_family: fontFamilyRef.current,
          },
        });
      } catch (error) {
        console.error("[ThemeContext] Sync failed:", error);
      } finally {
        isSyncingRef.current = false;
      }
    }, SYNC_DEBOUNCE_MS);
  }, [isAuthenticated]);

  /**
   * Merge local theme with server (used on login)
   */
  const mergeWithServer = useCallback(async () => {
    // Throttle to prevent 429 on rapid remounts
    const now = Date.now();
    if (now - lastMergeTimestamp < MERGE_THROTTLE_MS) {
      return;
    }
    if (isSyncingRef.current) return;
    lastMergeTimestamp = now;
    isSyncingRef.current = true;

    try {
      const localUpdatedAt = getStoredThemeUpdatedAt();

      const merged = await preferencesApi.merge({
        theme: {
          mode: themeRef.current,
          theme_id: customThemeRef.current?.id ?? "default",
          font_family: fontFamilyRef.current,
          updated_at: localUpdatedAt ?? undefined,
        },
      });

      // If server has newer theme, apply it
      if (merged.theme) {
        const serverMode = merged.theme.mode as Theme;
        const serverThemeId = merged.theme.theme_id;
        const serverFontFamily = merged.theme.font_family as FontFamily;

        // Only update if different from current
        if (serverMode !== themeRef.current) {
          setThemeState(serverMode);
          setStorageItemRaw(STORAGE_KEYS.theme, serverMode);
          const resolved = resolveTheme(serverMode);
          setResolvedTheme(resolved);
          applyThemeMode(resolved);
        }

        if (serverThemeId !== (customThemeRef.current?.id ?? "default")) {
          if (serverThemeId === "default") {
            setCustomThemeState(null);
            localStorage.removeItem(STORAGE_KEYS.themeId);
            saveThemeToStorage(null);
          } else {
            const serverTheme = getThemeById(serverThemeId);
            if (serverTheme) {
              setCustomThemeState(serverTheme);
              setStorageItemRaw(STORAGE_KEYS.themeId, serverThemeId);
            }
          }
          applyCustomTheme(
            serverThemeId === "default" ? null : getThemeById(serverThemeId) ?? null,
          );
          applyThemeFonts(serverThemeId);
        }

        if (serverFontFamily !== fontFamilyRef.current) {
          setFontFamilyState(serverFontFamily);
          setStorageItemRaw(STORAGE_KEYS.fontFamily, serverFontFamily);
        }
      }
    } catch (error) {
      console.error("[ThemeContext] Merge failed:", error);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  /**
   * Handle login: merge local theme with server
   */
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const wasLoggedOut = previousUserIdRef.current === null;
    const isNowLoggedIn = currentUserId !== null;

    // Detect login (was null, now has user ID)
    if (wasLoggedOut && isNowLoggedIn) {
      mergeWithServer();
    }

    // Detect logout - clear any pending sync
    if (previousUserIdRef.current !== null && currentUserId === null) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      isSyncingRef.current = false;
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id, mergeWithServer]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
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
    (newTheme: ThemeConfig | null) => {
      const previousThemeId = customThemeRef.current?.id ?? "default";
      const newThemeId = newTheme?.id ?? "default";

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
  useEffect(() => {
    applyCustomTheme(customTheme);
    const themeId = customTheme?.id ?? "default";
    applyThemeFonts(themeId);
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

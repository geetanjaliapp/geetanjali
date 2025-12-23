/**
 * Centralized localStorage/sessionStorage registry.
 *
 * All storage keys should be defined here to:
 * 1. Prevent typos and inconsistencies
 * 2. Enable complete data export
 * 3. Enable complete data deletion
 * 4. Document what each key stores
 *
 * Naming convention:
 * - User data (synced or important): geetanjali:keyName
 * - UI state (temporary): geetanjali:uiStateName
 * - Legacy keys: geetanjali_keyName (underscore)
 */

// ============================================================================
// localStorage Keys
// ============================================================================

export const STORAGE_KEYS = {
  // User data - synced to server for authenticated users
  favorites: "geetanjali_favorites", // Legacy underscore format
  learningGoals: "geetanjali:learningGoals",
  readingPosition: "geetanjali:readingPosition",
  readingSettings: "geetanjali:readingSettings", // Font size for Reading Mode

  // User preferences - local only (device-specific)
  theme: "geetanjali:theme",
  readingSectionPrefs: "geetanjali:readingSectionPrefs", // IAST/Hindi/English/Insight toggles
  recentSearches: "geetanjali:recentSearches",
  defaultVersesTab: "geetanjali:defaultVersesTab", // Default tab on Verses page (featured/for-you/all)
  verseDetailFontSize: "geetanjali:verseDetailFontSize", // Font size for VerseDetail page (normal/large)
  verseDetailSectionPrefs: "geetanjali:verseDetailSectionPrefs", // Section visibility prefs for VerseDetail

  // Newsletter state
  newsletterSubscribed: "geetanjali:newsletterSubscribed",
  newsletterCardDismissed: "geetanjali:newsletterCardDismissed",
  newsletterToastShown: "geetanjali:readingToastShown", // Rate limit for toast

  // Onboarding/UI state
  readingOnboardingSeen: "geetanjali:readingOnboardingSeen",
  syncToastSession: "geetanjali:syncToastSession",
  verseViewCount: "geetanjali:verseViewCount", // For newsletter nudge trigger

  // Feature-specific
  caseDraft: "geetanjali:caseDraft",
  featuredCasesCache: "geetanjali:featuredCases",
} as const;

// Dynamic keys (contain variable parts like slugs/IDs)
export const DYNAMIC_STORAGE_KEYS = {
  /** Public case view tracking: geetanjali:viewed:{slug} */
  publicCaseViewed: (slug: string) => `geetanjali:viewed:${slug}`,
} as const;

// ============================================================================
// sessionStorage Keys
// ============================================================================

export const SESSION_KEYS = {
  sessionId: "geetanjali_session_id",
  readingVersesRead: "geetanjali:readingVersesRead", // Verses read in current session
  chunkReloadAttempt: "geetanjali:chunkReloadAttempt", // Prevents infinite reload loops on chunk failure
} as const;

// ============================================================================
// localStorage Keys (Infrastructure)
// ============================================================================

export const INFRA_KEYS = {
  appVersion: "geetanjali:appVersion", // Tracks deployed version for cache invalidation
} as const;

// ============================================================================
// Storage Utilities
// ============================================================================

/**
 * Get all user data keys (for export)
 * Excludes temporary UI state that doesn't need to be exported
 */
export function getUserDataKeys(): string[] {
  return [
    STORAGE_KEYS.favorites,
    STORAGE_KEYS.learningGoals,
    STORAGE_KEYS.readingPosition,
    STORAGE_KEYS.readingSettings,
    STORAGE_KEYS.theme,
    STORAGE_KEYS.readingSectionPrefs,
    STORAGE_KEYS.recentSearches,
    STORAGE_KEYS.defaultVersesTab,
    STORAGE_KEYS.verseDetailFontSize,
    STORAGE_KEYS.newsletterSubscribed,
    STORAGE_KEYS.caseDraft,
  ];
}

/**
 * Get all keys that should be cleared on "Delete local data"
 * Includes user data + UI state, excludes caches
 */
export function getClearableKeys(): string[] {
  return [
    // User data
    STORAGE_KEYS.favorites,
    STORAGE_KEYS.learningGoals,
    STORAGE_KEYS.readingPosition,
    STORAGE_KEYS.readingSettings,
    STORAGE_KEYS.theme,
    STORAGE_KEYS.readingSectionPrefs,
    STORAGE_KEYS.recentSearches,
    STORAGE_KEYS.defaultVersesTab,
    STORAGE_KEYS.verseDetailFontSize,
    STORAGE_KEYS.verseDetailSectionPrefs,
    STORAGE_KEYS.caseDraft,
    // Newsletter state
    STORAGE_KEYS.newsletterSubscribed,
    STORAGE_KEYS.newsletterCardDismissed,
    STORAGE_KEYS.newsletterToastShown,
    // UI state
    STORAGE_KEYS.readingOnboardingSeen,
    STORAGE_KEYS.syncToastSession,
    STORAGE_KEYS.verseViewCount,
  ];
}

/**
 * Clear all geetanjali localStorage data.
 * Uses registry + prefix-based cleanup as safety net.
 */
export function clearAllLocalStorage(): void {
  // First, clear all known keys from registry
  getClearableKeys().forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  });

  // Safety net: clear any keys with geetanjali prefix that might have been missed
  try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((key) => {
      if (key.startsWith("geetanjali:") || key.startsWith("geetanjali_")) {
        // Don't clear cache keys (they'll regenerate)
        if (!key.includes("Cache") && !key.includes("featured")) {
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // Ignore errors (e.g., in private browsing)
  }
}

/**
 * Clear all geetanjali sessionStorage data.
 */
export function clearAllSessionStorage(): void {
  Object.values(SESSION_KEYS).forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  });
}

/**
 * Export all user data as a structured object.
 */
export function exportUserData(): Record<string, unknown> {
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    version: "1.1",
  };

  // Export each user data key
  const userKeys = getUserDataKeys();
  userKeys.forEach((key) => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        // Try to parse as JSON, fall back to string
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    } catch {
      // Ignore errors
    }
  });

  // Export dynamic keys (public case views)
  try {
    const viewedCases: Record<string, string> = {};
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("geetanjali:viewed:")) {
        const slug = key.replace("geetanjali:viewed:", "");
        const value = localStorage.getItem(key);
        if (value) viewedCases[slug] = value;
      }
    });
    if (Object.keys(viewedCases).length > 0) {
      data["viewedCases"] = viewedCases;
    }
  } catch {
    // Ignore errors
  }

  return data;
}

/**
 * Safe localStorage getter with JSON parsing
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch {
    // Ignore parse errors
  }
  return defaultValue;
}

/**
 * Safe localStorage setter with JSON serialization
 */
export function setStorageItem(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // QuotaExceededError or SecurityError
    return false;
  }
}

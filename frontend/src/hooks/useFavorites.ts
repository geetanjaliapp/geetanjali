/**
 * Hook for managing favorite verses in localStorage
 *
 * Features:
 * - Persisted favorites in localStorage
 * - Add/remove/toggle favorites
 * - Check if a verse is favorited
 * - Get all favorite IDs
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "geetanjali_favorites";
const MAX_FAVORITES = 100; // Reasonable limit to prevent localStorage bloat

interface UseFavoritesReturn {
  favorites: Set<string>;
  isFavorite: (verseId: string) => boolean;
  toggleFavorite: (verseId: string) => boolean;
  addFavorite: (verseId: string) => boolean;
  removeFavorite: (verseId: string) => void;
  clearFavorites: () => void;
  setAllFavorites: (items: string[]) => void;
  favoritesCount: number;
}

/**
 * Load favorites from localStorage
 */
function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (error) {
    console.error("[Favorites] Error loading from localStorage:", error);
  }
  return new Set();
}

/**
 * Save favorites to localStorage
 */
function saveFavorites(favorites: Set<string>): void {
  try {
    const array = Array.from(favorites);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
  } catch (error) {
    console.error("[Favorites] Error saving to localStorage:", error);
  }
}

/**
 * Hook for managing favorite verses
 *
 * @example
 * ```tsx
 * const { favorites, isFavorite, toggleFavorite } = useFavorites();
 *
 * // Check if verse is favorited
 * const isLiked = isFavorite('BG_2_47');
 *
 * // Toggle favorite status
 * const handleClick = () => toggleFavorite('BG_2_47');
 * ```
 */
export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Set<string>>(() =>
    loadFavorites(),
  );

  // Sync with localStorage on changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setFavorites(loadFavorites());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  /**
   * Check if a verse is favorited
   */
  const isFavorite = useCallback(
    (verseId: string): boolean => {
      return favorites.has(verseId);
    },
    [favorites],
  );

  /**
   * Add a verse to favorites
   * Returns false if already at max limit
   */
  const addFavorite = useCallback(
    (verseId: string): boolean => {
      if (favorites.has(verseId)) {
        return true; // Already favorited
      }

      if (favorites.size >= MAX_FAVORITES) {
        console.warn("[Favorites] Maximum favorites limit reached");
        return false;
      }

      setFavorites((prev) => {
        const newFavorites = new Set(prev);
        newFavorites.add(verseId);
        saveFavorites(newFavorites);
        return newFavorites;
      });

      // Track favorite event
      if (window.umami) {
        window.umami.track("favorite_add", { verse_id: verseId });
      }

      return true;
    },
    [favorites],
  );

  /**
   * Remove a verse from favorites
   */
  const removeFavorite = useCallback((verseId: string): void => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      newFavorites.delete(verseId);
      saveFavorites(newFavorites);
      return newFavorites;
    });

    // Track unfavorite event
    if (window.umami) {
      window.umami.track("favorite_remove", { verse_id: verseId });
    }
  }, []);

  /**
   * Toggle favorite status
   * Returns true if verse is now favorited, false if removed
   */
  const toggleFavorite = useCallback(
    (verseId: string): boolean => {
      if (favorites.has(verseId)) {
        removeFavorite(verseId);
        return false;
      } else {
        return addFavorite(verseId);
      }
    },
    [favorites, addFavorite, removeFavorite],
  );

  /**
   * Clear all favorites
   */
  const clearFavorites = useCallback((): void => {
    setFavorites(new Set());
    saveFavorites(new Set());

    // Track clear event
    if (window.umami) {
      window.umami.track("favorites_clear", {});
    }
  }, []);

  /**
   * Replace all favorites with a new set (used by sync merge)
   * This avoids race conditions from clear-then-add pattern
   */
  const setAllFavorites = useCallback((items: string[]): void => {
    const newFavorites = new Set(items.slice(0, MAX_FAVORITES));
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
    setAllFavorites,
    favoritesCount: favorites.size,
  };
}

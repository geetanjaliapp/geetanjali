/**
 * Hook for managing favorite verses in localStorage
 *
 * Features:
 * - Persisted favorites in localStorage
 * - Add/remove/toggle favorites
 * - Check if a verse is favorited
 * - Get all favorite IDs
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { setStorageItem, STORAGE_KEYS } from "../lib/storage";
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
    const stored = localStorage.getItem(STORAGE_KEYS.favorites);
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
  const array = Array.from(favorites);
  if (!setStorageItem(STORAGE_KEYS.favorites, array)) {
    console.error("[Favorites] Error saving to localStorage");
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

  // Ref to access current favorites without causing callback recreation
  // This enables stable callback references for React.memo optimization
  const favoritesRef = useRef(favorites);

  // Keep ref in sync with state. We write to ref during render (not read),
  // which is safe and allows callbacks to always access current value.
  // eslint-disable-next-line react-hooks/refs
  favoritesRef.current = favorites;

  // Sync with localStorage on changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.favorites) {
        setFavorites(loadFavorites());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  /**
   * Check if a verse is favorited
   * Stable reference - reads from ref to avoid recreation on favorites change
   */
  const isFavorite = useCallback((verseId: string): boolean => {
    return favoritesRef.current.has(verseId);
  }, []);

  /**
   * Add a verse to favorites
   * Returns false if already at max limit
   * Stable reference - reads from ref to avoid recreation on favorites change
   */
  const addFavorite = useCallback((verseId: string): boolean => {
    if (favoritesRef.current.has(verseId)) {
      return true; // Already favorited
    }

    if (favoritesRef.current.size >= MAX_FAVORITES) {
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
  }, []);

  /**
   * Remove a verse from favorites
   * Already stable - no dependencies
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
   * Stable reference - reads from ref to avoid recreation on favorites change
   */
  const toggleFavorite = useCallback(
    (verseId: string): boolean => {
      if (favoritesRef.current.has(verseId)) {
        removeFavorite(verseId);
        return false;
      } else {
        return addFavorite(verseId);
      }
    },
    [addFavorite, removeFavorite],
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

  // Memoize return value to prevent cascading re-renders
  return useMemo(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      clearFavorites,
      setAllFavorites,
      favoritesCount: favorites.size,
    }),
    [
      favorites,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      clearFavorites,
      setAllFavorites,
    ],
  );
}

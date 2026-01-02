/**
 * PreferencesContext - Unified preference management
 *
 * Provides single source of truth for all user preferences:
 * - Favorites
 * - Learning Goals
 * - Reading position and settings
 *
 * Features:
 * - Single login detection effect (replaces 3 separate effects)
 * - Unified sync status from SyncEngine
 * - Optimistic updates with background sync
 * - Cross-device sync for authenticated users
 *
 * Note: Theme preferences stay in ThemeContext (has CSS application logic)
 *
 * Part of v1.17.3 preference sync improvements.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { syncEngine, type SyncState } from "../lib/syncEngine";
import { preferencesStorage, type ReadingPosition, type FontSize } from "../lib/preferencesStorage";
import { STORAGE_KEYS } from "../lib/storage";
import type { Goal, Principle } from "../lib/api";

// ============================================================================
// TYPES
// ============================================================================

const MAX_FAVORITES = 100;

interface ReadingSettings {
  fontSize: FontSize;
}

interface GoalsState {
  selectedIds: string[];
  selectedGoals: Goal[];
  goalPrinciples: Principle[];
}

interface ReadingState {
  position: ReadingPosition | null;
  settings: ReadingSettings;
}

interface PreferencesContextValue {
  // Favorites
  favorites: Set<string>;
  favoritesCount: number;
  isFavorite: (verseId: string) => boolean;
  toggleFavorite: (verseId: string) => boolean;
  addFavorite: (verseId: string) => boolean;
  removeFavorite: (verseId: string) => void;

  // Goals
  goals: GoalsState;
  availableGoals: Goal[];
  toggleGoal: (goalId: string) => void;
  setGoals: (goalIds: string[]) => void;
  clearGoals: () => void;
  isGoalSelected: (goalId: string) => boolean;

  // Reading
  reading: ReadingState;
  saveReadingPosition: (chapter: number, verse: number) => void;
  setFontSize: (size: FontSize) => void;
  resetReadingProgress: () => void;

  // Sync
  sync: SyncState;
  resync: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface PreferencesProviderProps {
  children: ReactNode;
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const { goals: taxonomyGoals, getGoal, getPrinciplesForGoal } = useTaxonomy();

  // ══════════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════════

  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(preferencesStorage.getFavorites())
  );

  const [goalIds, setGoalIds] = useState<string[]>(
    () => preferencesStorage.getGoals()?.goalIds ?? []
  );

  const [readingPosition, setReadingPosition] = useState<ReadingPosition | null>(
    () => preferencesStorage.getReadingPosition()
  );

  const [readingSettings, setReadingSettings] = useState<ReadingSettings>(
    () => preferencesStorage.getReadingSettings()
  );

  const [syncState, setSyncState] = useState<SyncState>({
    status: "idle",
    lastSynced: null,
    pendingCount: 0,
    error: null,
  });

  // Refs for accessing current values without causing callback recreation
  const favoritesRef = useRef(favorites);
  const goalIdsRef = useRef(goalIds);

  // Update refs in effect to avoid updating during render
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    goalIdsRef.current = goalIds;
  }, [goalIds]);

  // ══════════════════════════════════════════════════════════════════════════
  // SYNC ENGINE SUBSCRIPTION
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return syncEngine.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  // Initialize handlers once
  useEffect(() => {
    const cleanupFlush = syncEngine.initFlushHandlers();
    const cleanupOnline = syncEngine.initOnlineHandlers();
    return () => {
      cleanupFlush();
      cleanupOnline();
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // MERGE (login) - declared before useEffect that uses it
  // ══════════════════════════════════════════════════════════════════════════

  const mergeWithServer = useCallback(async () => {
    const local = preferencesStorage.getAllForMerge();
    const merged = await syncEngine.merge(local);

    if (merged) {
      // Apply merged result to state
      if (merged.favorites?.items) {
        const newFavorites = new Set(merged.favorites.items);
        setFavorites(newFavorites);
        preferencesStorage.setFavorites(merged.favorites.items);
      }

      if (merged.learning_goals?.goal_ids) {
        setGoalIds(merged.learning_goals.goal_ids);
        preferencesStorage.setGoals(merged.learning_goals.goal_ids);
      }

      if (merged.reading) {
        if (merged.reading.chapter != null) {
          const pos: ReadingPosition = {
            chapter: merged.reading.chapter,
            verse: merged.reading.verse ?? 1,
            timestamp: Date.now(),
          };
          setReadingPosition(pos);
          preferencesStorage.setReadingPosition(pos);
        }
        if (merged.reading.font_size) {
          const settings = { fontSize: merged.reading.font_size as FontSize };
          setReadingSettings(settings);
          preferencesStorage.setReadingSettings(settings);
        }
      }
      // Theme is handled by ThemeContext (it also listens to merge)
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // SINGLE LOGIN DETECTION (replaces 3 separate effects)
  // ══════════════════════════════════════════════════════════════════════════

  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const wasLoggedOut = previousUserIdRef.current === null;
    const isNowLoggedIn = currentUserId !== null;

    if (wasLoggedOut && isNowLoggedIn) {
      // Single merge for ALL preference types
      // Note: mergeWithServer is async, so setState calls happen after await (not sync)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      mergeWithServer();
    }

    if (previousUserIdRef.current !== null && currentUserId === null) {
      // Logout - reset sync state
      syncEngine.reset();
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id, mergeWithServer]);

  // ══════════════════════════════════════════════════════════════════════════
  // FAVORITES ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  const isFavorite = useCallback((verseId: string): boolean => {
    return favoritesRef.current.has(verseId);
  }, []);

  const addFavorite = useCallback(
    (verseId: string): boolean => {
      if (favoritesRef.current.has(verseId)) {
        return true;
      }

      if (favoritesRef.current.size >= MAX_FAVORITES) {
        console.warn("[Preferences] Maximum favorites limit reached");
        return false;
      }

      setFavorites((prev) => {
        const newFavorites = new Set(prev);
        newFavorites.add(verseId);
        preferencesStorage.setFavorites(Array.from(newFavorites));
        return newFavorites;
      });

      if (isAuthenticated) {
        // Read latest and queue sync
        setTimeout(() => {
          syncEngine.update("favorites", { items: Array.from(favoritesRef.current) });
        }, 0);
      }

      return true;
    },
    [isAuthenticated]
  );

  const removeFavorite = useCallback(
    (verseId: string): void => {
      setFavorites((prev) => {
        const newFavorites = new Set(prev);
        newFavorites.delete(verseId);
        preferencesStorage.setFavorites(Array.from(newFavorites));
        return newFavorites;
      });

      if (isAuthenticated) {
        setTimeout(() => {
          syncEngine.update("favorites", { items: Array.from(favoritesRef.current) });
        }, 0);
      }
    },
    [isAuthenticated]
  );

  const toggleFavorite = useCallback(
    (verseId: string): boolean => {
      if (favoritesRef.current.has(verseId)) {
        removeFavorite(verseId);
        return false;
      } else {
        return addFavorite(verseId);
      }
    },
    [addFavorite, removeFavorite]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // GOALS ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  const isGoalSelected = useCallback(
    (goalId: string): boolean => {
      return goalIdsRef.current.includes(goalId);
    },
    []
  );

  const toggleGoal = useCallback(
    (goalId: string): void => {
      setGoalIds((prev) => {
        const isSelected = prev.includes(goalId);
        const newIds = isSelected
          ? prev.filter((id) => id !== goalId)
          : [...prev, goalId];

        preferencesStorage.setGoals(newIds);

        if (isAuthenticated) {
          syncEngine.update("goals", { goal_ids: newIds });
        }

        return newIds;
      });
    },
    [isAuthenticated]
  );

  const setGoalsAction = useCallback(
    (newGoalIds: string[]): void => {
      setGoalIds(newGoalIds);
      preferencesStorage.setGoals(newGoalIds);

      if (isAuthenticated) {
        syncEngine.update("goals", { goal_ids: newGoalIds });
      }
    },
    [isAuthenticated]
  );

  const clearGoals = useCallback((): void => {
    setGoalIds([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.learningGoals);
    } catch {
      // Ignore
    }

    if (isAuthenticated) {
      syncEngine.update("goals", { goal_ids: [] });
    }
  }, [isAuthenticated]);

  // Resolve goal IDs to Goal and Principle objects
  const selectedGoals = useMemo(
    () =>
      goalIds
        .map((id) => getGoal(id))
        .filter((g): g is Goal => g !== undefined),
    [goalIds, getGoal]
  );

  const goalPrinciples = useMemo(() => {
    const allPrinciples = goalIds.flatMap((id) => getPrinciplesForGoal(id));
    const seen = new Set<string>();
    return allPrinciples.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [goalIds, getPrinciplesForGoal]);

  // ══════════════════════════════════════════════════════════════════════════
  // READING ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  const saveReadingPosition = useCallback(
    (chapter: number, verse: number): void => {
      const pos: ReadingPosition = {
        chapter,
        verse,
        timestamp: Date.now(),
      };
      setReadingPosition(pos);
      preferencesStorage.setReadingPosition(pos);

      if (isAuthenticated) {
        syncEngine.update("reading", { chapter, verse });
      }
    },
    [isAuthenticated]
  );

  const setFontSizeAction = useCallback(
    (size: FontSize): void => {
      const newSettings = { ...readingSettings, fontSize: size };
      setReadingSettings(newSettings);
      preferencesStorage.setReadingSettings(newSettings);

      if (isAuthenticated) {
        syncEngine.update("reading", { font_size: size });
      }
    },
    [isAuthenticated, readingSettings]
  );

  const resetReadingProgress = useCallback((): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.readingPosition);
      localStorage.removeItem(STORAGE_KEYS.readingSettings);
    } catch {
      // Ignore
    }

    setReadingPosition(null);
    setReadingSettings({ fontSize: "medium" });

    if (isAuthenticated) {
      syncEngine.update("reading", {
        chapter: undefined,
        verse: undefined,
        font_size: "medium",
      });
    }
  }, [isAuthenticated]);

  // ══════════════════════════════════════════════════════════════════════════
  // RESYNC
  // ══════════════════════════════════════════════════════════════════════════

  const resync = useCallback(async (): Promise<void> => {
    if (isAuthenticated) {
      await mergeWithServer();
    }
  }, [isAuthenticated, mergeWithServer]);

  // ══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ══════════════════════════════════════════════════════════════════════════

  const value = useMemo<PreferencesContextValue>(
    () => ({
      // Favorites
      favorites,
      favoritesCount: favorites.size,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,

      // Goals
      goals: {
        selectedIds: goalIds,
        selectedGoals,
        goalPrinciples,
      },
      availableGoals: taxonomyGoals,
      toggleGoal,
      setGoals: setGoalsAction,
      clearGoals,
      isGoalSelected,

      // Reading
      reading: {
        position: readingPosition,
        settings: readingSettings,
      },
      saveReadingPosition,
      setFontSize: setFontSizeAction,
      resetReadingProgress,

      // Sync
      sync: syncState,
      resync,
    }),
    [
      favorites,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      goalIds,
      selectedGoals,
      goalPrinciples,
      taxonomyGoals,
      toggleGoal,
      setGoalsAction,
      clearGoals,
      isGoalSelected,
      readingPosition,
      readingSettings,
      saveReadingPosition,
      setFontSizeAction,
      resetReadingProgress,
      syncState,
      resync,
    ]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferencesContext(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferencesContext must be used within PreferencesProvider");
  }
  return context;
}

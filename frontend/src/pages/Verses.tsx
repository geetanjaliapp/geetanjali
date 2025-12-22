import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { VirtuosoGrid } from "react-virtuoso";
import { versesApi } from "../lib/api";
import type { Verse, SearchResult } from "../types";
import { Navbar, SearchInput, saveRecentSearch } from "../components";
import { Footer } from "../components/Footer";
import { VerseCard, VerseCardSkeleton } from "../components/VerseCard";
import type { VerseMatch } from "../components/VerseCard";
import { BackToTopButton } from "../components/BackToTopButton";
import {
  CloseIcon,
  ChevronDownIcon,
  SpinnerIcon,
  HeartIcon,
  StarIcon,
  SparklesIcon,
  GridIcon,
  SearchIcon,
  BookOpenIcon,
} from "../components/icons";
import { errorMessages } from "../lib/errorMessages";
import { useSEO, useSyncedFavorites, useSyncedGoal, useSearch, useTaxonomy } from "../hooks";
import { validateSearchQuery } from "../lib/contentFilter";
import { STORAGE_KEYS, getStorageItem } from "../lib/storage";

// Responsive page size: 16 for desktop (4x4 grid), 12 for mobile
const getVersesPerPage = () => {
  if (typeof window === "undefined") return 12;
  return window.innerWidth >= 1024 ? 16 : 12;
};

// Shared grid layout classes
const VERSE_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 items-start";

// Animation timing constants - only for initial load (virtualized items don't animate)
const SKELETON_COUNT = 8;

// VirtuosoGrid custom components for proper styling
const gridComponents = {
  List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ style, children, ...props }, ref) => (
      <div
        ref={ref}
        {...props}
        style={{ ...style, position: "relative", zIndex: 0 }}
        className={VERSE_GRID_CLASSES}
      >
        {children}
      </div>
    )
  ),
  Item: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className="h-auto">
      {children}
    </div>
  ),
};

// Filter modes: 'featured' shows curated verses, 'all' shows all 701 verses, 'favorites' shows user's favorites
// 'recommended' shows verses matching any of the user's selected learning goals
type FilterMode = "featured" | "all" | "favorites" | "recommended" | number; // number = specific chapter

/**
 * Get human-readable label for search strategy
 */
function getStrategyLabel(strategy: string): string {
  const labels: Record<string, string> = {
    canonical: "Exact Match",
    sanskrit: "Sanskrit Match",
    keyword: "Keyword Search",
    principle: "Topic Filter",
    semantic: "Semantic Search",
  };
  return labels[strategy] || strategy;
}

/**
 * Convert SearchResult match to VerseMatch for VerseCard
 */
function toVerseMatch(match: SearchResult["match"]): VerseMatch {
  return {
    type: match.type as VerseMatch["type"],
    highlight: match.highlight ?? undefined,
    field: match.field?.replace("_", " ") ?? undefined,
  };
}

export default function Verses() {
  useSEO({
    title: "Browse Verses",
    description:
      "Explore all 701 verses of the Bhagavad Geeta. Search by chapter, browse featured verses, and discover timeless wisdom.",
    canonical: "/verses",
  });

  // Favorites hook for heart icon and filtering (synced across devices)
  const { favorites, isFavorite, toggleFavorite, favoritesCount } =
    useSyncedFavorites();

  // Learning goals hook for "Recommended" filter
  const { selectedGoals } = useSyncedGoal();

  // Taxonomy hook for principles (single source of truth from backend)
  const { principles, getPrincipleShortLabel } = useTaxonomy();

  // Compute recommended principles: union of all principles from non-exploring goals
  const recommendedPrinciples = useMemo(() => {
    const principleSet = new Set<string>();
    selectedGoals.forEach((goal) => {
      // "exploring" goal has no principles - skip it
      if (goal.id !== "exploring" && goal.principles) {
        goal.principles.forEach((p) => principleSet.add(p));
      }
    });
    return Array.from(principleSet);
  }, [selectedGoals]);

  // Show "Recommended" tab only if user has selected non-exploring goals
  const showRecommendedTab = recommendedPrinciples.length > 0;

  const [searchParams, setSearchParams] = useSearchParams();

  // Search state
  const initialQuery = searchParams.get("q") || "";
  const [searchInputValue, setSearchInputValue] = useState(initialQuery);
  const [validationError, setValidationError] = useState<string | null>(() => {
    if (!initialQuery) return null;
    const validation = validateSearchQuery(initialQuery);
    return validation.valid
      ? null
      : validation.reason || "Invalid search query";
  });

  // Responsive page size for search results
  const searchPageSize = useMemo(() => getVersesPerPage(), []);

  // Search hook
  const {
    data: searchData,
    loading: searchLoading,
    loadingMore: searchLoadingMore,
    error: searchError,
    hasMore: searchHasMore,
    search,
    loadMore: searchLoadMore,
    clear: clearSearch,
  } = useSearch({ limit: searchPageSize });

  // Is search mode active? (includes validation error state)
  const isSearchMode = Boolean(
    searchInputValue.trim() || searchData || validationError,
  );

  // Sync search state with URL changes (e.g., clicking "Verses" in navbar)
  // Use a ref to track the previous URL query to detect actual navigation vs. user typing
  const currentUrlQuery = searchParams.get("q") || "";
  const prevUrlQueryRef = useRef(currentUrlQuery);
  useEffect(() => {
    const prevUrlQuery = prevUrlQueryRef.current;
    prevUrlQueryRef.current = currentUrlQuery;

    // Only sync when URL actually changed (navigation), not on every render
    if (currentUrlQuery === prevUrlQuery) return;

    // If URL no longer has query but we have search state, clear it
    if (!currentUrlQuery && (searchInputValue || searchData)) {
      setSearchInputValue("");
      setValidationError(null);
      clearSearch();
    }
    // If URL changed to a different query (e.g., browser back/forward), sync input
    else if (currentUrlQuery && currentUrlQuery !== searchInputValue) {
      setSearchInputValue(currentUrlQuery);
      // Trigger search if valid
      const validation = validateSearchQuery(currentUrlQuery);
      if (validation.valid) {
        setValidationError(null);
        search(currentUrlQuery);
      } else {
        setValidationError(validation.reason || "Invalid search query");
        clearSearch();
      }
    }
  }, [currentUrlQuery, searchInputValue, searchData, clearSearch, search]);

  const [verses, setVerses] = useState<Verse[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Responsive page size: 16 for desktop (4x4), 12 for mobile
  const pageSize = useMemo(() => getVersesPerPage(), []);

  // Parse initial filter from URL, falling back to user's default preference
  const getInitialFilter = (): FilterMode => {
    const chapter = searchParams.get("chapter");
    if (chapter) return parseInt(chapter);
    const showAll = searchParams.get("all");
    if (showAll === "true") return "all";
    const showFavs = searchParams.get("favorites");
    if (showFavs === "true") return "favorites";
    const showRec = searchParams.get("recommended");
    if (showRec === "true") return "recommended";

    // No URL params - use user's default preference
    const defaultTab = getStorageItem<string>(STORAGE_KEYS.defaultVersesTab, "default");
    if (defaultTab === "for-you") return "recommended";
    if (defaultTab === "favorites") return "favorites";
    if (defaultTab === "all") return "all";
    if (defaultTab === "featured") return "featured";
    // "default" or unrecognized values fall through to system default (featured)
    return "featured";
  };

  const getInitialPrinciple = (): string | null => {
    return searchParams.get("topic");
  };

  const [filterMode, setFilterMode] = useState<FilterMode>(getInitialFilter);
  const [selectedPrinciple, setSelectedPrinciple] = useState<string | null>(
    getInitialPrinciple,
  );
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);

  // Ref for auto-scrolling to selected principle pill
  const principlesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected principle pill when it changes (e.g., from URL param)
  useEffect(() => {
    if (selectedPrinciple && principlesContainerRef.current) {
      const container = principlesContainerRef.current;
      const selectedButton = container.querySelector(
        `[data-principle-id="${selectedPrinciple}"]`,
      ) as HTMLElement | null;

      if (selectedButton) {
        // Scroll the button into view with some padding
        const containerRect = container.getBoundingClientRect();
        const buttonRect = selectedButton.getBoundingClientRect();

        // Check if button is outside visible area
        if (
          buttonRect.left < containerRect.left ||
          buttonRect.right > containerRect.right
        ) {
          selectedButton.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        }
      }
    }
  }, [selectedPrinciple, principles]); // Also depend on principles loading

  // Sync filter state with URL changes (e.g., clicking "Verses" in navbar resets filters)
  useEffect(() => {
    const urlTopic = searchParams.get("topic");
    const urlChapter = searchParams.get("chapter");
    const urlAll = searchParams.get("all");
    const urlFavorites = searchParams.get("favorites");
    const urlRecommended = searchParams.get("recommended");

    // Sync principle filter
    if (urlTopic !== selectedPrinciple) {
      setSelectedPrinciple(urlTopic);
    }

    // Sync filter mode
    const newFilterMode: FilterMode = urlChapter
      ? parseInt(urlChapter)
      : urlAll === "true"
        ? "all"
        : urlFavorites === "true"
          ? "favorites"
          : urlRecommended === "true"
            ? "recommended"
            : "featured";

    if (newFilterMode !== filterMode) {
      setFilterMode(newFilterMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only depend on searchParams, not state (to avoid infinite loops)

  // Derived state
  const selectedChapter = typeof filterMode === "number" ? filterMode : null;
  const showFeatured = filterMode === "featured";
  const showAll = filterMode === "all";
  const showFavorites = filterMode === "favorites";
  const showRecommended = filterMode === "recommended";

  // Filter verses by favorites when in favorites mode
  const displayedVerses = useMemo(() => {
    if (showFavorites) {
      return verses.filter((v) => favorites.has(v.canonical_id));
    }
    return verses;
  }, [verses, showFavorites, favorites]);

  // Principles for the pill row (ordered by backend - single source of truth)
  // principles array comes from useTaxonomy hook

  // Memoized load functions
  const loadCount = useCallback(async () => {
    // For favorites mode, count is just the localStorage favorites count
    if (filterMode === "favorites" && !selectedPrinciple) {
      setTotalCount(favoritesCount);
      return;
    }
    try {
      // For recommended mode, use the user's goal principles
      if (filterMode === "recommended" && recommendedPrinciples.length > 0) {
        const count = await versesApi.count(
          undefined,
          undefined,
          recommendedPrinciples.join(","),
        );
        setTotalCount(count);
        return;
      }

      // When topic is selected, it's a standalone filter (don't combine with filterMode)
      const chapter = selectedPrinciple
        ? undefined
        : typeof filterMode === "number"
          ? filterMode
          : undefined;
      const featured = selectedPrinciple
        ? undefined
        : filterMode === "featured"
          ? true
          : undefined;
      const count = await versesApi.count(
        chapter,
        featured,
        selectedPrinciple || undefined,
      );
      setTotalCount(count);
    } catch {
      setTotalCount(null);
    }
  }, [filterMode, selectedPrinciple, favoritesCount, recommendedPrinciples]);

  const loadVerses = useCallback(
    async (reset: boolean = false) => {
      // For favorites mode, fetch each favorited verse by ID
      if (filterMode === "favorites") {
        if (!reset) {
          // No pagination for favorites
          setLoadingMore(false);
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const favoriteIds = Array.from(favorites);
          if (favoriteIds.length === 0) {
            setVerses([]);
            setLoading(false);
            setHasMore(false);
            return;
          }

          // Fetch all favorited verses in parallel
          const versePromises = favoriteIds.map(
            (id) => versesApi.get(id).catch(() => null), // Handle deleted/invalid verses gracefully
          );
          const results = await Promise.all(versePromises);
          const validVerses = results.filter((v): v is Verse => v !== null);

          setVerses(validVerses);
          setHasMore(false); // No pagination for favorites
        } catch (err) {
          setError(errorMessages.verseLoad(err));
        } finally {
          setLoading(false);
          setLoadingMore(false);
        }
        return;
      }

      try {
        if (reset) {
          setLoading(true);
          // Don't clear verses immediately - keep showing old cards with opacity
          setHasMore(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        // For recommended mode, use the user's goal principles (loadMore handles pagination)
        if (filterMode === "recommended" && recommendedPrinciples.length > 0 && reset) {
          const data = await versesApi.list(
            0,
            pageSize,
            undefined,
            undefined,
            recommendedPrinciples.join(","),
          );
          setVerses(data);
          setHasMore(data.length === pageSize);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        // When topic is selected, it's a standalone filter (don't combine with filterMode)
        const chapter = selectedPrinciple
          ? undefined
          : typeof filterMode === "number"
            ? filterMode
            : undefined;
        const featured = selectedPrinciple
          ? undefined
          : filterMode === "featured"
            ? true
            : undefined;
        const skip = reset ? 0 : undefined;

        const data = await versesApi.list(
          skip ?? 0,
          pageSize,
          chapter,
          featured,
          selectedPrinciple || undefined,
        );

        if (reset) {
          setVerses(data);
        } else {
          setVerses((prev) => [...prev, ...data]);
        }

        setHasMore(data.length === pageSize);
      } catch (err) {
        setError(errorMessages.verseLoad(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterMode, selectedPrinciple, pageSize, favorites, recommendedPrinciples],
  );

  useEffect(() => {
    // Only load browse results if not in search mode
    if (!isSearchMode) {
      loadVerses(true);
      loadCount();
    }
  }, [loadVerses, loadCount, isSearchMode]);

  // Trigger search if query in URL on mount
  useEffect(() => {
    if (initialQuery && !validationError) {
      search(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Close chapter dropdown on Escape key
  useEffect(() => {
    if (!showChapterDropdown) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowChapterDropdown(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showChapterDropdown]);

  // Option D: Escape key clears search and returns to browse mode
  useEffect(() => {
    if (!isSearchMode) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchInputValue("");
        setValidationError(null);
        clearSearch();
        // Reset URL to current filter state
        const params: Record<string, string> = {};
        if (typeof filterMode === "number") {
          params.chapter = filterMode.toString();
        } else if (filterMode === "all") {
          params.all = "true";
        } else if (filterMode === "favorites") {
          params.favorites = "true";
        }
        if (selectedPrinciple) {
          params.topic = selectedPrinciple;
        }
        setSearchParams(params);
        // Clear focus from search input
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [
    isSearchMode,
    clearSearch,
    filterMode,
    selectedPrinciple,
    setSearchParams,
  ]);

  // Escape key clears filters when in browse mode (not search mode)
  useEffect(() => {
    // Only handle escape for filters when not in search mode and a filter is active
    const hasActiveFilter =
      selectedPrinciple || selectedChapter || filterMode !== "featured";
    if (isSearchMode || !hasActiveFilter) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Reset to default state
        setFilterMode("featured");
        setSelectedPrinciple(null);
        setSearchParams({});
        // Clear focus from any filter button
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [
    isSearchMode,
    selectedPrinciple,
    selectedChapter,
    filterMode,
    setSearchParams,
  ]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      // For recommended mode, use the user's goal principles
      if (filterMode === "recommended" && recommendedPrinciples.length > 0) {
        const data = await versesApi.list(
          verses.length,
          pageSize,
          undefined,
          undefined,
          recommendedPrinciples.join(","),
        );

        setVerses((prev) => {
          const existingIds = new Set(prev.map((v) => v.id));
          const newVerses = data.filter((v) => !existingIds.has(v.id));
          return [...prev, ...newVerses];
        });
        setHasMore(data.length === pageSize);
        setLoadingMore(false);
        return;
      }

      // When topic is selected, it's a standalone filter (don't combine with filterMode)
      const chapter = selectedPrinciple
        ? undefined
        : typeof filterMode === "number"
          ? filterMode
          : undefined;
      const featured = selectedPrinciple
        ? undefined
        : filterMode === "featured"
          ? true
          : undefined;

      const data = await versesApi.list(
        verses.length,
        pageSize,
        chapter,
        featured,
        selectedPrinciple || undefined,
      );

      // Deduplicate when adding new verses
      setVerses((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const newVerses = data.filter((v) => !existingIds.has(v.id));
        return [...prev, ...newVerses];
      });
      setHasMore(data.length === pageSize);
    } catch (err) {
      setError(errorMessages.verseLoad(err));
    } finally {
      setLoadingMore(false);
    }
  }, [filterMode, selectedPrinciple, verses.length, loadingMore, pageSize, recommendedPrinciples]);

  const updateSearchParams = (filter: FilterMode, principle: string | null) => {
    const params: Record<string, string> = {};
    if (typeof filter === "number") {
      params.chapter = filter.toString();
    } else if (filter === "all") {
      params.all = "true";
    } else if (filter === "favorites") {
      params.favorites = "true";
    } else if (filter === "recommended") {
      params.recommended = "true";
    }
    if (principle) {
      params.topic = principle;
    }
    setSearchParams(params);
  };

  const handleFilterSelect = (filter: FilterMode) => {
    // Clear search mode when selecting a filter
    if (isSearchMode) {
      setSearchInputValue("");
      setValidationError(null);
      clearSearch();
    }
    setFilterMode(filter);
    setSelectedPrinciple(null); // Clear topic on mode change
    updateSearchParams(filter, null);
  };

  const handlePrincipleSelect = (principle: string | null) => {
    // Clear search mode when selecting a principle
    if (isSearchMode) {
      setSearchInputValue("");
      setValidationError(null);
      clearSearch();
    }
    setSelectedPrinciple(principle);
    // Reset filterMode to "featured" when selecting a topic (filters are independent)
    // This ensures the "Filtering by:" banner doesn't show stale chapter info
    if (principle) {
      setFilterMode("featured");
      updateSearchParams("featured", principle);
    } else {
      updateSearchParams(filterMode, principle);
    }
  };

  // Search handlers
  const handleSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();

      // Option E: Empty input submission resets to browse mode
      if (!trimmed) {
        if (isSearchMode) {
          setSearchInputValue("");
          setValidationError(null);
          clearSearch();
          // Reset URL to current filter state
          const params: Record<string, string> = {};
          if (typeof filterMode === "number") {
            params.chapter = filterMode.toString();
          } else if (filterMode === "all") {
            params.all = "true";
          } else if (filterMode === "favorites") {
            params.favorites = "true";
          }
          if (selectedPrinciple) {
            params.topic = selectedPrinciple;
          }
          setSearchParams(params);
        }
        return;
      }

      // Clear previous validation error
      setValidationError(null);

      // Validate query
      const validation = validateSearchQuery(trimmed);
      if (!validation.valid) {
        setValidationError(validation.reason || "Invalid search query");
        clearSearch();
        return;
      }

      // Update URL with search query
      setSearchParams({ q: trimmed });

      // Save to recent searches
      saveRecentSearch(trimmed);

      // Execute search
      search(trimmed);
    },
    [
      search,
      setSearchParams,
      clearSearch,
      isSearchMode,
      filterMode,
      selectedPrinciple,
    ],
  );

  const handleClearSearch = useCallback(() => {
    setSearchInputValue("");
    setValidationError(null);
    clearSearch();
    // Remove query from URL, keep other params
    const params: Record<string, string> = {};
    if (typeof filterMode === "number") {
      params.chapter = filterMode.toString();
    } else if (filterMode === "all") {
      params.all = "true";
    } else if (filterMode === "favorites") {
      params.favorites = "true";
    }
    if (selectedPrinciple) {
      params.topic = selectedPrinciple;
    }
    setSearchParams(params);
  }, [clearSearch, filterMode, selectedPrinciple, setSearchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
      {/* Screen reader announcements for search results */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isSearchMode && !searchLoading && searchData && (
          searchData.total === 0
            ? `No results found for "${searchData.query}"`
            : `${searchData.total} result${searchData.total !== 1 ? 's' : ''} found for "${searchData.query}"`
        )}
      </div>

      <Navbar />

      {/* Page Header - scrolls away, content-first */}
      <div className="py-4 sm:py-6 text-center">
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900 dark:text-gray-100">
          Explore the Bhagavad Geeta
        </h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
          701 verses of timeless wisdom
        </p>
      </div>

      {/* Sticky Search + Filter Bar */}
      <div className="sticky top-14 sm:top-16 z-10 bg-amber-50/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-sm border-b border-amber-200/50 dark:border-gray-700/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
          {/* Row 1: Search Input - compact */}
          <div className="max-w-2xl mx-auto mb-2 sm:mb-3">
            <SearchInput
              value={searchInputValue}
              onChange={(value) => {
                setSearchInputValue(value);
                if (validationError) {
                  setValidationError(null);
                }
              }}
              onSearch={handleSearch}
              onClear={handleClearSearch}
              loading={searchLoading}
              showExamples={true}
              autoFocus={false}
              className="[&_input]:py-2 [&_input]:sm:py-2.5 [&_button]:py-2 [&_button]:sm:py-2.5"
            />
          </div>

          {/* Row 2: Mode Filters - Segmented Control + Chapter Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            {/* Segmented Control: Featured | All | Favorites */}
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5 shadow-sm">
              {/* Featured Segment */}
              <button
                onClick={() => handleFilterSelect("featured")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${
                  showFeatured && !selectedPrinciple && !isSearchMode
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <StarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Featured</span>
              </button>

              {/* Recommended Segment - only visible when user has selected learning goals */}
              {showRecommendedTab && (
                <>
                  {/* Divider */}
                  <div className="w-px bg-gray-200 dark:bg-gray-600 my-1" />

                  <button
                    onClick={() => handleFilterSelect("recommended")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${
                      showRecommended && !selectedPrinciple && !isSearchMode
                        ? "bg-orange-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    title="Verses matching your learning goals"
                  >
                    <SparklesIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">For You</span>
                  </button>
                </>
              )}

              {/* Divider */}
              <div className="w-px bg-gray-200 dark:bg-gray-600 my-1" />

              {/* Favorites Segment */}
              <button
                onClick={() => handleFilterSelect("favorites")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${
                  showFavorites && !selectedPrinciple && !isSearchMode
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <HeartIcon
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  filled={showFavorites || favoritesCount > 0}
                />
                <span className="hidden sm:inline">Favorites</span>
                {/* Count badge */}
                <span
                  className={`text-[10px] sm:text-xs tabular-nums ${
                    showFavorites && !selectedPrinciple && !isSearchMode
                      ? "text-white/80"
                      : favoritesCount > 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {favoritesCount}
                </span>
              </button>

              {/* Divider */}
              <div className="w-px bg-gray-200 dark:bg-gray-600 my-1" />

              {/* All Segment */}
              <button
                onClick={() => handleFilterSelect("all")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${
                  showAll && !selectedPrinciple && !isSearchMode
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <GridIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">All</span>
              </button>
            </div>

            {/* Chapter Dropdown - Separate */}
            <div className="relative">
              <button
                onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                  selectedChapter && !selectedPrinciple && !isSearchMode
                    ? "bg-orange-600 text-white border-orange-600 shadow-md"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <BookOpenIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {selectedChapter ? `Chapter ${selectedChapter}` : "Chapter"}
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${showChapterDropdown ? "rotate-180" : ""}`}
                />
              </button>

              {showChapterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowChapterDropdown(false)}
                  />
                  <div className="absolute left-0 mt-2 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 w-48 sm:w-64">
                    <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(
                        (chapter) => (
                          <button
                            key={chapter}
                            onClick={() => {
                              handleFilterSelect(chapter);
                              setShowChapterDropdown(false);
                            }}
                            className={`h-8 sm:h-9 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                              selectedChapter === chapter
                                ? "bg-orange-600 text-white shadow-md"
                                : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 border border-gray-200 dark:border-gray-600"
                            }`}
                          >
                            {chapter}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 3: Topic/Principle Pills - scrollable */}
          <div className="relative">
            {/* Scroll fade indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-amber-50/95 dark:from-gray-900/95 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-amber-50/95 dark:from-gray-900/95 to-transparent z-10 pointer-events-none" />

            <div
              ref={principlesContainerRef}
              className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 px-1 scrollbar-hide"
            >
              {principles.map((principle) => (
                <button
                  key={principle.id}
                  data-principle-id={principle.id}
                  onClick={() =>
                    handlePrincipleSelect(
                      selectedPrinciple === principle.id ? null : principle.id,
                    )
                  }
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${
                    selectedPrinciple === principle.id && !isSearchMode
                      ? "bg-amber-600 text-white shadow-md"
                      : "bg-amber-100/80 dark:bg-gray-700 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-gray-600 border border-amber-200/50 dark:border-gray-600"
                  }`}
                >
                  {principle.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Filter Banner (Browse mode) or Search Results Header (Search mode) */}
      <div className="bg-amber-50/80 dark:bg-gray-800/50 border-b border-amber-100 dark:border-gray-700 min-h-[36px] sm:min-h-[40px]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          {isSearchMode ? (
            /* Search Results Header */
            <div className="flex items-center justify-between">
              {searchLoading ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Searching...
                </span>
              ) : searchData ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {searchData.total === 0 ? (
                      "No results found"
                    ) : (
                      <>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {searchData.total}
                        </span>
                        {searchHasMore && searchData.total_count && (
                          <>
                            <span className="text-gray-400 dark:text-gray-500">
                              {" "}
                              of{" "}
                            </span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {searchData.total_count}
                            </span>
                          </>
                        )}{" "}
                        result
                        {(searchData.total_count ?? searchData.total) !== 1 &&
                          "s"}{" "}
                        for "{searchData.query}"
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {searchData.total > 0 && (
                      <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-full font-medium">
                        {getStrategyLabel(searchData.strategy)}
                      </span>
                    )}
                    <button
                      onClick={handleClearSearch}
                      className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium underline underline-offset-2"
                    >
                      Clear search
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Enter a search query
                </span>
              )}
            </div>
          ) : selectedChapter || selectedPrinciple ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                Filtering by:
              </span>

              {/* Chapter filter tag */}
              {selectedChapter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 text-xs sm:text-sm font-medium">
                  Chapter {selectedChapter}
                  <button
                    onClick={() => handleFilterSelect("featured")}
                    className="ml-0.5 hover:bg-orange-200 dark:hover:bg-orange-800/40 rounded-full p-0.5 transition-colors"
                    aria-label="Clear chapter filter"
                  >
                    <CloseIcon />
                  </button>
                </span>
              )}

              {/* Principle filter tag */}
              {selectedPrinciple && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium">
                  {getPrincipleShortLabel(selectedPrinciple)}
                  <button
                    onClick={() => handlePrincipleSelect(null)}
                    className="ml-0.5 hover:bg-amber-200 dark:hover:bg-amber-800/40 rounded-full p-0.5 transition-colors"
                    aria-label="Clear topic filter"
                  >
                    <CloseIcon />
                  </button>
                </span>
              )}

              {/* Count + Clear all */}
              <div className="flex items-center gap-2 ml-auto">
                {totalCount !== null && (
                  <span className="text-xs sm:text-sm text-amber-600/70 dark:text-amber-400/70">
                    {totalCount} verse{totalCount !== 1 ? "s" : ""}
                  </span>
                )}
                <button
                  onClick={() => {
                    setFilterMode("featured");
                    setSelectedPrinciple(null);
                    updateSearchParams("featured", null);
                  }}
                  className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium underline underline-offset-2"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : showRecommended ? (
            <div className="flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-xs sm:text-sm text-amber-600/70 dark:text-amber-400/70">
                {totalCount !== null ? `${totalCount} ` : ""}
                verses for your goals
              </span>
            </div>
          ) : showFavorites ? (
            <div className="flex items-center gap-1.5">
              <HeartIcon className="w-3.5 h-3.5 text-red-400" filled />
              <span className="text-xs sm:text-sm text-amber-600/70 dark:text-amber-400/70">
                {totalCount !== null ? `${totalCount} ` : ""}
                favorite{totalCount !== 1 ? "s" : ""}
              </span>
            </div>
          ) : showFeatured ? (
            <div className="flex items-center gap-1.5">
              <StarIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span className="text-xs sm:text-sm text-amber-600/70 dark:text-amber-400/70">
                {totalCount !== null ? `${totalCount} ` : ""}
                featured verses
              </span>
            </div>
          ) : showAll ? (
            <div className="flex items-center gap-1.5">
              <GridIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span className="text-xs sm:text-sm text-amber-600/70 dark:text-amber-400/70">
                {totalCount !== null ? `${totalCount} ` : ""}
                verses
              </span>
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-amber-600/70 dark:text-amber-400/70">
              {totalCount !== null ? `${totalCount} ` : ""}
              verses
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Error States */}
          {(validationError || searchError || error) && (
            <div className="mb-4 sm:mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              <p className="font-semibold text-sm sm:text-base">
                {validationError ? "Invalid search" : "Error"}
              </p>
              <p className="text-xs sm:text-sm">
                {validationError || searchError || error}
              </p>
            </div>
          )}

          {/* Search Content */}
          {isSearchMode ? (
            <>
              {/* Search Loading Skeleton */}
              {searchLoading && !searchData && (
                <div className={VERSE_GRID_CLASSES}>
                  {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                    <VerseCardSkeleton key={i} />
                  ))}
                </div>
              )}

              {/* Search Results Grid */}
              {searchData && searchData.results.length > 0 && (
                <>
                  {/* Consultation Suggestion Banner */}
                  {searchData.suggestion && (
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-orange-800 dark:text-orange-300">
                          {searchData.suggestion.message}
                        </p>
                        <Link
                          to={`/cases/new?prefill=${encodeURIComponent(searchData.query)}`}
                          className="inline-flex items-center justify-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
                        >
                          {searchData.suggestion.cta}
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Virtualized Search Results Grid */}
                  {/* isolate creates a new stacking context so grid stays below sticky header */}
                  <div className={`isolate transition-opacity duration-200 ${searchLoading ? "opacity-50" : "opacity-100"}`}>
                    <VirtuosoGrid
                      useWindowScroll
                      totalCount={searchData.results.length}
                      overscan={200}
                      components={gridComponents}
                      itemContent={(index) => {
                        const result = searchData.results[index];
                        if (!result) return null;
                        return (
                          <VerseCard
                            verse={
                              {
                                ...result,
                                id: result.canonical_id,
                                consulting_principles: result.principles,
                                created_at: "",
                              } as Verse
                            }
                            displayMode="compact"
                            showSpeaker={false}
                            showCitation={true}
                            showTranslation={false}
                            showTranslationPreview={!result.match.highlight}
                            onPrincipleClick={handlePrincipleSelect}
                            linkTo={`/verses/${result.canonical_id}?from=search`}
                            isFavorite={isFavorite(result.canonical_id)}
                            onToggleFavorite={toggleFavorite}
                            match={toVerseMatch(result.match)}
                          />
                        );
                      }}
                    />
                  </div>

                  {/* Load More / End of Search Results */}
                  {searchData.results.length > 0 && (
                    <div className="pt-12 sm:pt-16 pb-4">
                      {searchHasMore ? (
                        <button
                          onClick={searchLoadMore}
                          disabled={searchLoadingMore}
                          className="w-full group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300/50 dark:via-amber-600/30 to-amber-300/70 dark:to-amber-600/50" />
                            <div
                              className={`flex flex-col items-center transition-all duration-300 ${searchLoadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}
                            >
                              {searchLoadingMore ? (
                                <SpinnerIcon className="w-6 h-6 text-amber-500 dark:text-amber-400 mb-1.5" />
                              ) : (
                                <span className="text-amber-400/70 dark:text-amber-500/60 text-xl mb-1">
                                  ॰
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 text-base font-medium text-amber-700/80 dark:text-amber-400/80 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                                {searchLoadingMore ? (
                                  "Loading"
                                ) : (
                                  <>
                                    Load More
                                    <ChevronDownIcon className="w-4 h-4" />
                                  </>
                                )}
                              </span>
                              {!searchLoadingMore && searchData.total_count && (
                                <span className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">
                                  {searchData.total_count - searchData.results.length} more
                                </span>
                              )}
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-300/50 dark:via-amber-600/30 to-amber-300/70 dark:to-amber-600/50" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200/40 dark:via-amber-600/20 to-amber-200/60 dark:to-amber-600/40" />
                          <div className="flex flex-col items-center">
                            <SearchIcon className="w-5 h-5 text-amber-300/70 dark:text-amber-500/50" />
                            <span className="text-xs text-amber-600/70 dark:text-amber-500/60 mt-1">
                              {searchData.total_count ?? searchData.results.length} results
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-200/40 dark:via-amber-600/20 to-amber-200/60 dark:to-amber-600/40" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Empty Search Results */}
              {searchData && searchData.results.length === 0 && (
                <div className="text-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-2xl border border-amber-100 dark:border-gray-700">
                  <div className="text-4xl text-amber-300/60 dark:text-amber-500/50 mb-4">
                    ॐ
                  </div>
                  <h3 className="text-lg font-serif text-gray-700 dark:text-gray-300 mb-2">
                    No verses found
                  </h3>

                  {/* Show consultation CTA if query looks like a personal question */}
                  {searchData.suggestion ||
                  searchData.query.split(" ").length >= 5 ? (
                    <>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                        Your question sounds like you're seeking personal
                        guidance. Our consultation feature can provide tailored
                        insights from the Geeta.
                      </p>
                      <Link
                        to={`/cases/new?prefill=${encodeURIComponent(searchData.query)}`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 transition-colors shadow-lg hover:shadow-xl mb-6"
                      >
                        Get Personal Guidance
                      </Link>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                      Try different keywords or a verse reference (e.g.,
                      "2.47").
                    </p>
                  )}

                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <button
                      onClick={() => handleSearch("karma")}
                      className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-sm rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                    >
                      Try "karma"
                    </button>
                    <button
                      onClick={() => handleSearch("2.47")}
                      className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-sm rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                    >
                      Try "2.47"
                    </button>
                    <button
                      onClick={handleClearSearch}
                      className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-sm rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
                    >
                      Browse all verses
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Browse Mode Content */
            <>
              {/* Loading State - Skeleton Cards */}
              {loading && verses.length === 0 && !showFavorites ? (
                <div className={VERSE_GRID_CLASSES}>
                  {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                    <VerseCardSkeleton key={i} />
                  ))}
                </div>
              ) : displayedVerses.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <div className="max-w-md mx-auto">
                    {/* Decorative element */}
                    <div className="mb-4 flex justify-center">
                      {showFavorites ? (
                        <HeartIcon className="w-10 h-10 sm:w-12 sm:h-12 text-red-300/60 dark:text-red-400/40" />
                      ) : showRecommended ? (
                        <SparklesIcon className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300/60 dark:text-amber-500/40" />
                      ) : showFeatured ? (
                        <StarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300/60 dark:text-amber-500/40" />
                      ) : (
                        <span className="text-4xl sm:text-5xl text-amber-300/60 dark:text-amber-500/40">ॐ</span>
                      )}
                    </div>

                    <h3 className="text-lg sm:text-xl font-serif text-gray-700 dark:text-gray-300 mb-2">
                      {showFavorites ? "No favorites yet" : showRecommended ? "No recommendations yet" : "No verses found"}
                    </h3>

                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6">
                      {showFavorites ? (
                        <>
                          Browse verses and tap the{" "}
                          <HeartIcon className="w-4 h-4 inline-block align-text-bottom text-red-400" />{" "}
                          to save your favorites.
                        </>
                      ) : showRecommended ? (
                        <>
                          No verses match your current learning goals. Try selecting different goals in{" "}
                          <a href="/settings#goals" className="text-orange-600 dark:text-orange-400 underline">Settings</a>.
                        </>
                      ) : selectedPrinciple && selectedChapter ? (
                        <>
                          No verses in Chapter {selectedChapter} match the "
                          {getPrincipleShortLabel(selectedPrinciple)}"
                          principle.
                        </>
                      ) : selectedPrinciple ? (
                        <>
                          No verses found with the "
                          {getPrincipleShortLabel(selectedPrinciple)}" principle
                          in this selection.
                        </>
                      ) : selectedChapter ? (
                        <>
                          No featured verses found in Chapter {selectedChapter}.
                        </>
                      ) : (
                        <>Try adjusting your filters to discover more verses.</>
                      )}
                    </p>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                      {showFavorites ? (
                        <button
                          onClick={() => handleFilterSelect("featured")}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                        >
                          Browse featured verses
                        </button>
                      ) : (
                        <>
                          {(selectedChapter || selectedPrinciple) && (
                            <button
                              onClick={() => {
                                setFilterMode("featured");
                                setSelectedPrinciple(null);
                                updateSearchParams("featured", null);
                              }}
                              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                            >
                              Clear filters
                            </button>
                          )}
                          <button
                            onClick={() => handleFilterSelect("all")}
                            className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            Browse all 701 verses
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Virtualized Verse Grid - renders only visible items for performance */}
                  {/* isolate creates a new stacking context so grid stays below sticky header */}
                  <div className={`isolate transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
                    <VirtuosoGrid
                      useWindowScroll
                      totalCount={displayedVerses.length}
                      overscan={200}
                      components={gridComponents}
                      itemContent={(index) => {
                        const verse = displayedVerses[index];
                        if (!verse) return null;
                        return (
                          <VerseCard
                            verse={verse}
                            displayMode="compact"
                            showSpeaker={false}
                            showCitation={true}
                            showTranslation={false}
                            showTranslationPreview={true}
                            onPrincipleClick={handlePrincipleSelect}
                            linkTo={`/verses/${verse.canonical_id}?from=browse`}
                            isFavorite={isFavorite(verse.canonical_id)}
                            onToggleFavorite={toggleFavorite}
                          />
                        );
                      }}
                    />
                  </div>

                  {/* Load More / End of Results - positioned after grid with generous spacing */}
                  {displayedVerses.length > 0 && (
                    <div className="pt-12 sm:pt-16 pb-4">
                      {hasMore ? (
                        <button
                          onClick={loadMore}
                          disabled={loadingMore}
                          className="w-full group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300/50 dark:via-amber-600/30 to-amber-300/70 dark:to-amber-600/50" />
                            <div
                              className={`flex flex-col items-center transition-all duration-300 ${loadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}
                            >
                              {loadingMore ? (
                                <SpinnerIcon className="w-6 h-6 text-amber-500 dark:text-amber-400 mb-1.5" />
                              ) : (
                                <span className="text-amber-400/70 dark:text-amber-500/60 text-xl mb-1">
                                  ॰
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 text-base font-medium text-amber-700/80 dark:text-amber-400/80 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                                {loadingMore ? (
                                  "Loading"
                                ) : (
                                  <>
                                    Load More
                                    <ChevronDownIcon className="w-4 h-4" />
                                  </>
                                )}
                              </span>
                              {!loadingMore && totalCount && (
                                <span className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">
                                  {totalCount - verses.length} more
                                </span>
                              )}
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-300/50 dark:via-amber-600/30 to-amber-300/70 dark:to-amber-600/50" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200/40 dark:via-amber-600/20 to-amber-200/60 dark:to-amber-600/40" />
                          <div className="flex flex-col items-center">
                            {showFavorites ? (
                              <HeartIcon className="w-5 h-5 text-red-300/70 dark:text-red-400/50" filled />
                            ) : showRecommended ? (
                              <SparklesIcon className="w-5 h-5 text-amber-300/70 dark:text-amber-500/50" />
                            ) : showFeatured ? (
                              <StarIcon className="w-5 h-5 text-amber-300/70 dark:text-amber-500/50" />
                            ) : (
                              <span className="text-amber-300/60 dark:text-amber-500/40 text-xl">ॐ</span>
                            )}
                            <span className="text-xs text-amber-600/70 dark:text-amber-500/60 mt-1">
                              {displayedVerses.length}{" "}
                              {showFavorites ? "favorite" : showRecommended ? "recommended" : showFeatured ? "featured" : "verse"}
                              {displayedVerses.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-200/40 dark:via-amber-600/20 to-amber-200/60 dark:to-amber-600/40" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom padding for FAB on mobile */}
      <div className="h-16 sm:hidden" />

      {/* Footer */}
      <Footer />

      {/* Back to Top Button */}
      <BackToTopButton />
    </div>
  );
}

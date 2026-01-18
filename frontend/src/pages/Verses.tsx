import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { versesApi } from "../lib/api";
import type { Verse } from "../types";
import { Navbar, SearchInput, saveRecentSearch } from "../components";
import { Footer } from "../components/Footer";
import { VerseCardSkeleton } from "../components/VerseCard";
import { FloatingAudioBar } from "../components/audio";
import { BackToTopButton } from "../components/BackToTopButton";
import {
  BrowseVerseGrid,
  SearchVerseGrid,
  getColumnCount,
  getStrategyLabel,
} from "../components/verse";
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
  TagIcon,
} from "../components/icons";
import { TopicSelector } from "../components/TopicSelector";
import { errorMessages } from "../lib/errorMessages";
import {
  useSEO,
  usePreferences,
  useSearch,
  useTaxonomy,
} from "../hooks";
import { validateSearchQuery } from "../lib/contentFilter";
import { STORAGE_KEYS, getStorageItem } from "../lib/storage";

// Page size: 12 works cleanly with 2, 3, and 4 column layouts
const VERSES_PER_PAGE = 12;

// Shared grid layout classes
const VERSE_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 items-start";

// Animation timing constants - only for initial load (matches VERSES_PER_PAGE)
const SKELETON_COUNT = 12;

// Filter modes: 'featured' shows curated verses, 'all' shows all 701 verses, 'favorites' shows user's favorites
// 'recommended' shows verses matching any of the user's selected learning goals
type FilterMode = "featured" | "all" | "favorites" | "recommended" | number; // number = specific chapter

export default function Verses() {
  useSEO({
    title: "Browse Verses",
    description:
      "Explore all 701 verses of the Bhagavad Geeta. Search by chapter, browse featured verses, and discover timeless wisdom.",
    canonical: "/verses",
  });

  // Preferences hook for favorites and goals (synced across devices)
  const {
    favorites,
    isFavorite,
    toggleFavorite,
    favoritesCount,
    goals: { selectedGoals },
  } = usePreferences();

  // Ref to access favorites without causing loadVerses callback recreation
  // This prevents re-render loops when favorites Set changes
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  // Taxonomy hook for principle label lookup
  const { getPrincipleShortLabel } = useTaxonomy();

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

  // Page size for search results
  const searchPageSize = VERSES_PER_PAGE;

  // Column count for grid virtualization - updates on resize
  const [columnCount, setColumnCount] = useState(getColumnCount);
  useEffect(() => {
    const handleResize = () => setColumnCount(getColumnCount());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Page size for browse results
  const pageSize = VERSES_PER_PAGE;

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
    const defaultTab = getStorageItem<string>(
      STORAGE_KEYS.defaultVersesTab,
      "default",
    );
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
  const [showTopicSelector, setShowTopicSelector] = useState(false);

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

    // Only sync filter mode if URL has explicit filter params
    // This prevents overriding user's defaultVersesTab preference when navigating to /verses
    const hasFilterParams = urlChapter || urlAll || urlFavorites || urlRecommended;
    if (hasFilterParams) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only depend on searchParams to avoid infinite loops with filterMode
  }, [searchParams]);

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
      // For favorites mode, fetch all favorited verses in a single batch request
      if (filterMode === "favorites") {
        if (!reset) {
          // No pagination for favorites
          setLoadingMore(false);
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const favoriteIds = Array.from(favoritesRef.current);
          if (favoriteIds.length === 0) {
            setVerses([]);
            setLoading(false);
            setHasMore(false);
            return;
          }

          // Batch fetch all favorited verses in a single request
          const validVerses = await versesApi.getBatch(favoriteIds);

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
        if (
          filterMode === "recommended" &&
          recommendedPrinciples.length > 0 &&
          reset
        ) {
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
    [filterMode, selectedPrinciple, pageSize, recommendedPrinciples],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount with initial query from URL
  }, []);

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
  }, [
    filterMode,
    selectedPrinciple,
    verses.length,
    loadingMore,
    pageSize,
    recommendedPrinciples,
  ]);

  const updateSearchParams = useCallback(
    (filter: FilterMode, principle: string | null) => {
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
    },
    [setSearchParams],
  );

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

  const handlePrincipleSelect = useCallback(
    (principle: string | null) => {
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
    },
    [isSearchMode, clearSearch, filterMode, updateSearchParams],
  );

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
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      {/* Screen reader announcements for search results */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isSearchMode &&
          !searchLoading &&
          searchData &&
          (searchData.total === 0
            ? `No results found for "${searchData.query}"`
            : `${searchData.total} result${searchData.total !== 1 ? "s" : ""} found for "${searchData.query}"`)}
      </div>

      <Navbar />

      {/* Page Header - scrolls away, content-first */}
      <div className="py-4 sm:py-6 text-center">
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)]">
          Explore the Bhagavad Geeta
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-1">
          701 verses of timeless wisdom
        </p>
      </div>

      {/* Sticky Search + Filter Bar */}
      <div className="sticky top-14 sm:top-16 z-10 bg-[var(--surface-sticky)] backdrop-blur-xs shadow-[var(--shadow-button)] border-b border-[var(--border-warm-subtle)]">
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
              className="[&_input]:py-2 sm:[&_input]:py-2.5 [&_button]:py-2 sm:[&_button]:py-2.5"
            />
          </div>

          {/* Row 2: Mode Filters - Segmented Control + Chapter Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            {/* Segmented Control: Featured | All | Favorites */}
            <div className="inline-flex rounded-[var(--radius-button)] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-0.5 shadow-[var(--shadow-button)]">
              {/* Featured Segment */}
              <button
                onClick={() => handleFilterSelect("featured")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                  showFeatured && !selectedPrinciple && !isSearchMode
                    ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                }`}
              >
                <StarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Featured</span>
              </button>

              {/* Recommended Segment - only visible when user has selected learning goals */}
              {showRecommendedTab && (
                <>
                  {/* Divider */}
                  <div className="w-px bg-[var(--border-default)] my-1" />

                  <button
                    onClick={() => handleFilterSelect("recommended")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                      showRecommended && !selectedPrinciple && !isSearchMode
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                    }`}
                    title="Verses matching your learning goals"
                  >
                    <SparklesIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">For You</span>
                  </button>
                </>
              )}

              {/* Divider */}
              <div className="w-px bg-[var(--border-default)] my-1" />

              {/* Favorites Segment */}
              <button
                onClick={() => handleFilterSelect("favorites")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                  showFavorites && !selectedPrinciple && !isSearchMode
                    ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
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
                      ? "text-[var(--chip-selected-text)]"
                      : favoritesCount > 0
                        ? "text-[var(--icon-favorite)]"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {favoritesCount}
                </span>
              </button>

              {/* Divider */}
              <div className="w-px bg-[var(--border-default)] my-1" />

              {/* All Segment */}
              <button
                onClick={() => handleFilterSelect("all")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                  showAll && !selectedPrinciple && !isSearchMode
                    ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
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
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[var(--radius-button)] text-sm font-medium transition-[var(--transition-color)] border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                  selectedChapter && !selectedPrinciple && !isSearchMode
                    ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] border-[var(--chip-selected-ring)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                    : "bg-[var(--surface-elevated)] text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
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
                  <div className="absolute left-0 mt-2 p-2 sm:p-3 bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] border border-[var(--border-default)] z-20 w-64 sm:w-80">
                    <div className="grid grid-cols-6 gap-2">
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(
                        (chapter) => (
                          <button
                            key={chapter}
                            onClick={() => {
                              handleFilterSelect(chapter);
                              setShowChapterDropdown(false);
                            }}
                            className={`h-10 sm:h-11 rounded-[var(--radius-button)] text-xs sm:text-sm font-medium transition-[var(--transition-all)] ${
                              selectedChapter === chapter
                                ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-[var(--chip-selected-ring)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)] active:bg-[var(--badge-warm-hover)]"
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

            {/* Topic Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTopicSelector(!showTopicSelector)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[var(--radius-button)] text-sm font-medium transition-[var(--transition-color)] border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                  selectedPrinciple && !isSearchMode
                    ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] border-[var(--chip-selected-ring)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                    : "bg-[var(--surface-elevated)] text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                }`}
              >
                <TagIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {selectedPrinciple
                  ? getPrincipleShortLabel(selectedPrinciple)
                  : "Topic"}
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${showTopicSelector ? "rotate-180" : ""}`}
                />
              </button>

              <TopicSelector
                selectedTopic={selectedPrinciple}
                onSelect={handlePrincipleSelect}
                onClose={() => setShowTopicSelector(false)}
                isOpen={showTopicSelector}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Active Filter Banner (Browse mode) or Search Results Header (Search mode) */}
      <div className="bg-[var(--surface-sticky)] border-b border-[var(--border-warm-subtle)] min-h-[36px] sm:min-h-[40px]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          {isSearchMode ? (
            /* Search Results Header */
            <div className="flex items-center justify-between">
              {searchLoading ? (
                <span className="text-sm text-[var(--text-tertiary)]">
                  Searching...
                </span>
              ) : searchData ? (
                <>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {searchData.total === 0 ? (
                      "No results found"
                    ) : (
                      <>
                        <span className="font-medium text-[var(--text-primary)]">
                          {searchData.total}
                        </span>
                        {searchHasMore && searchData.total_count && (
                          <>
                            <span className="text-[var(--text-muted)]">
                              {" "}
                              of{" "}
                            </span>
                            <span className="font-medium text-[var(--text-primary)]">
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
                      <span className="text-xs text-[var(--badge-warm-text)] bg-[var(--badge-warm-bg)] px-2.5 py-1 rounded-[var(--radius-chip)] font-medium">
                        {getStrategyLabel(searchData.strategy)}
                      </span>
                    )}
                    <button
                      onClick={handleClearSearch}
                      className="text-xs sm:text-sm text-[var(--text-accent)] hover:text-[var(--badge-warm-text)] font-medium underline underline-offset-2"
                    >
                      Clear search
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-sm text-[var(--text-tertiary)]">
                  Enter a search query
                </span>
              )}
            </div>
          ) : selectedChapter || selectedPrinciple ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-[var(--text-accent)]">
                Filtering by:
              </span>

              {/* Chapter filter tag */}
              {selectedChapter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-chip)] bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)] text-xs sm:text-sm font-medium">
                  Chapter {selectedChapter}
                  <button
                    onClick={() => handleFilterSelect("featured")}
                    className="ml-0.5 hover:bg-[var(--badge-primary-hover)] rounded-[var(--radius-chip)] p-0.5 transition-[var(--transition-color)]"
                    aria-label="Clear chapter filter"
                  >
                    <CloseIcon />
                  </button>
                </span>
              )}

              {/* Principle filter tag */}
              {selectedPrinciple && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-chip)] bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] text-xs sm:text-sm font-medium">
                  {getPrincipleShortLabel(selectedPrinciple)}
                  <button
                    onClick={() => handlePrincipleSelect(null)}
                    className="ml-0.5 hover:bg-[var(--badge-warm-hover)] rounded-[var(--radius-chip)] p-0.5 transition-[var(--transition-color)]"
                    aria-label="Clear topic filter"
                  >
                    <CloseIcon />
                  </button>
                </span>
              )}

              {/* Count + Clear all */}
              <div className="flex items-center gap-2 ml-auto">
                {totalCount !== null && (
                  <span className="text-xs sm:text-sm text-[var(--text-accent-muted)]">
                    {totalCount} verse{totalCount !== 1 ? "s" : ""}
                  </span>
                )}
                <button
                  onClick={() => {
                    setFilterMode("featured");
                    setSelectedPrinciple(null);
                    updateSearchParams("featured", null);
                  }}
                  className="text-xs sm:text-sm text-[var(--text-accent)] hover:text-[var(--badge-warm-text)] font-medium underline underline-offset-2"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : showRecommended ? (
            <div className="flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5 text-[var(--text-accent)]" />
              <span className="text-xs sm:text-sm text-[var(--text-accent-muted)]">
                {totalCount !== null ? `${totalCount} ` : ""}
                verses for your goals
              </span>
            </div>
          ) : showFavorites ? (
            <div className="flex items-center gap-1.5">
              <HeartIcon
                className="w-3.5 h-3.5 text-[var(--decorative-heart)]"
                filled
              />
              <span className="text-xs sm:text-sm text-[var(--text-accent-muted)]">
                {totalCount !== null ? `${totalCount} ` : ""}
                favorite{totalCount !== 1 ? "s" : ""}
              </span>
            </div>
          ) : showFeatured ? (
            <div className="flex items-center gap-1.5">
              <StarIcon className="w-3.5 h-3.5 text-[var(--text-accent)]" />
              <span className="text-xs sm:text-sm text-[var(--text-accent-muted)]">
                {totalCount !== null ? `${totalCount} ` : ""}
                featured verses
              </span>
            </div>
          ) : showAll ? (
            <div className="flex items-center gap-1.5">
              <GridIcon className="w-3.5 h-3.5 text-[var(--text-accent)]" />
              <span className="text-xs sm:text-sm text-[var(--text-accent-muted)]">
                {totalCount !== null ? `${totalCount} ` : ""}
                verses
              </span>
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-[var(--text-accent-muted)]">
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
            <div className="mb-4 sm:mb-6 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-[var(--status-error-text)] px-4 py-3 rounded-[var(--radius-button)]">
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
                    <div className="bg-linear-to-r from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] border border-[var(--border-warm)] rounded-[var(--radius-card)] p-4 mb-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-[var(--badge-primary-text)]">
                          {searchData.suggestion.message}
                        </p>
                        <Link
                          to={`/cases/new?prefill=${encodeURIComponent(searchData.query)}`}
                          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] text-sm font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-[var(--transition-color)] whitespace-nowrap"
                        >
                          {searchData.suggestion.cta}
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Search Results Grid - virtualized only for large datasets */}
                  <SearchVerseGrid
                    results={searchData.results}
                    columnCount={columnCount}
                    loading={searchLoading}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    onPrincipleClick={handlePrincipleSelect}
                  />

                  {/* Search Load More / End of Results */}
                  {searchData.results.length > 0 && (
                    <div className="py-6">
                      {searchHasMore ? (
                        <button
                          onClick={searchLoadMore}
                          disabled={searchLoadingMore}
                          className="w-full group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-linear-to-r from-transparent via-[var(--divider-warm)] to-[var(--divider-warm)]" />
                            <div
                              className={`flex flex-col items-center transition-all duration-300 ${searchLoadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}
                            >
                              {searchLoadingMore ? (
                                <SpinnerIcon className="w-6 h-6 text-[var(--text-accent)] mb-1.5" />
                              ) : (
                                <span className="text-[var(--decorative-om)] text-xl mb-1">
                                  ॰
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 text-base font-medium text-[var(--text-accent)] group-hover:text-[var(--badge-warm-text)] transition-[var(--transition-color)]">
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
                                <span className="text-xs text-[var(--text-accent-muted)] mt-1">
                                  {searchData.total_count -
                                    searchData.results.length}{" "}
                                  more
                                </span>
                              )}
                            </div>
                            <div className="flex-1 h-px bg-linear-to-l from-transparent via-[var(--divider-warm)] to-[var(--divider-warm)]" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-px bg-linear-to-r from-transparent via-[var(--divider-warm-subtle)] to-[var(--divider-warm-subtle)]" />
                          <div className="flex flex-col items-center">
                            <SearchIcon className="w-5 h-5 text-[var(--decorative-om)]" />
                            <span className="text-xs text-[var(--text-accent-muted)] mt-1">
                              {searchData.total_count ??
                                searchData.results.length}{" "}
                              results
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-linear-to-l from-transparent via-[var(--divider-warm-subtle)] to-[var(--divider-warm-subtle)]" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Empty Search Results */}
              {searchData && searchData.results.length === 0 && (
                <div className="text-center py-12 bg-[var(--surface-warm-subtle)] rounded-[var(--radius-modal)] border border-[var(--border-warm-subtle)]">
                  <div className="text-4xl text-[var(--decorative-om)] mb-4">
                    ॐ
                  </div>
                  <h3 className="text-lg font-serif text-[var(--text-primary)] mb-2">
                    No verses found
                  </h3>

                  {/* Show consultation CTA if query looks like a personal question */}
                  {searchData.suggestion ||
                  searchData.query.split(" ").length >= 5 ? (
                    <>
                      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
                        Your question sounds like you're seeking personal
                        guidance. Our consultation feature can provide tailored
                        insights from the Geeta.
                      </p>
                      <Link
                        to={`/cases/new?prefill=${encodeURIComponent(searchData.query)}`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-card)] hover:opacity-90 transition-[var(--transition-color)] shadow-[var(--shadow-dropdown)] hover:shadow-[var(--shadow-modal)] mb-6"
                      >
                        Get Personal Guidance
                      </Link>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-tertiary)] mb-6 max-w-sm mx-auto">
                      Try different keywords or a verse reference (e.g.,
                      "2.47").
                    </p>
                  )}

                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <button
                      onClick={() => handleSearch("karma")}
                      className="px-3 py-1.5 bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] text-sm rounded-[var(--radius-chip)] hover:bg-[var(--badge-warm-hover)] transition-[var(--transition-color)]"
                    >
                      Try "karma"
                    </button>
                    <button
                      onClick={() => handleSearch("2.47")}
                      className="px-3 py-1.5 bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] text-sm rounded-[var(--radius-chip)] hover:bg-[var(--badge-warm-hover)] transition-[var(--transition-color)]"
                    >
                      Try "2.47"
                    </button>
                    <button
                      onClick={handleClearSearch}
                      className="px-3 py-1.5 bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)] text-sm rounded-[var(--radius-chip)] hover:bg-[var(--badge-primary-hover)] transition-[var(--transition-color)]"
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
                        <HeartIcon className="w-10 h-10 sm:w-12 sm:h-12 text-[var(--decorative-heart)]" />
                      ) : showRecommended ? (
                        <SparklesIcon className="w-10 h-10 sm:w-12 sm:h-12 text-[var(--decorative-om)]" />
                      ) : showFeatured ? (
                        <StarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-[var(--decorative-om)]" />
                      ) : (
                        <span className="text-4xl sm:text-5xl text-[var(--decorative-om)]">
                          ॐ
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg sm:text-xl font-serif text-[var(--text-primary)] mb-2">
                      {showFavorites
                        ? "No favorites yet"
                        : showRecommended
                          ? "No recommendations yet"
                          : "No verses found"}
                    </h3>

                    <p className="text-sm sm:text-base text-[var(--text-tertiary)] mb-6">
                      {showFavorites ? (
                        <>
                          Browse verses and tap the{" "}
                          <HeartIcon className="w-4 h-4 inline-block align-text-bottom text-[var(--decorative-heart)]" />{" "}
                          to save your favorites.
                        </>
                      ) : showRecommended ? (
                        <>
                          No verses match your current learning goals. Try
                          selecting different goals in{" "}
                          <a
                            href="/settings#goals"
                            className="text-[var(--interactive-ghost-text)] underline"
                          >
                            Settings
                          </a>
                          .
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
                          className="px-4 py-2 bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] rounded-[var(--radius-button)] text-sm font-medium hover:opacity-90 transition-[var(--transition-color)]"
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
                              className="px-4 py-2 bg-[var(--interactive-contextual)] text-[var(--interactive-contextual-text)] rounded-[var(--radius-button)] text-sm font-medium hover:opacity-90 transition-[var(--transition-color)]"
                            >
                              Clear filters
                            </button>
                          )}
                          <button
                            onClick={() => handleFilterSelect("all")}
                            className="px-4 py-2 bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded-[var(--radius-button)] text-sm font-medium border border-[var(--border-default)] hover:bg-[var(--surface-muted)] transition-[var(--transition-color)]"
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
                  {/* Verse Grid - virtualized only for large datasets */}
                  <BrowseVerseGrid
                    verses={displayedVerses}
                    columnCount={columnCount}
                    loading={loading}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    onPrincipleClick={handlePrincipleSelect}
                  />

                  {/* Load More / End of Results */}
                  {displayedVerses.length > 0 && (
                    <div className="py-6">
                      {hasMore ? (
                        <button
                          onClick={loadMore}
                          disabled={loadingMore}
                          className="w-full group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-linear-to-r from-transparent via-[var(--divider-warm)] to-[var(--divider-warm)]" />
                            <div
                              className={`flex flex-col items-center transition-all duration-300 ${loadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}
                            >
                              {loadingMore ? (
                                <SpinnerIcon className="w-6 h-6 text-[var(--text-accent)] mb-1.5" />
                              ) : (
                                <span className="text-[var(--decorative-om)] text-xl mb-1">
                                  ॰
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 text-base font-medium text-[var(--text-accent)] group-hover:text-[var(--badge-warm-text)] transition-[var(--transition-color)]">
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
                                <span className="text-xs text-[var(--text-accent-muted)] mt-1">
                                  {totalCount - verses.length} more
                                </span>
                              )}
                            </div>
                            <div className="flex-1 h-px bg-linear-to-l from-transparent via-[var(--divider-warm)] to-[var(--divider-warm)]" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-px bg-linear-to-r from-transparent via-[var(--divider-warm-subtle)] to-[var(--divider-warm-subtle)]" />
                          <div className="flex flex-col items-center">
                            {showFavorites ? (
                              <HeartIcon
                                className="w-5 h-5 text-[var(--decorative-heart)]"
                                filled
                              />
                            ) : showRecommended ? (
                              <SparklesIcon className="w-5 h-5 text-[var(--decorative-om)]" />
                            ) : showFeatured ? (
                              <StarIcon className="w-5 h-5 text-[var(--decorative-om)]" />
                            ) : (
                              <span className="text-[var(--decorative-om)] text-xl">
                                ॐ
                              </span>
                            )}
                            <span className="text-xs text-[var(--text-accent-muted)] mt-1">
                              {displayedVerses.length}{" "}
                              {showFavorites
                                ? "favorite"
                                : showRecommended
                                  ? "recommended"
                                  : showFeatured
                                    ? "featured"
                                    : "verse"}
                              {displayedVerses.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-linear-to-l from-transparent via-[var(--divider-warm-subtle)] to-[var(--divider-warm-subtle)]" />
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

      {/* Floating Audio Bar - shows when audio is playing */}
      <FloatingAudioBar />

      {/* Back to Top Button */}
      <BackToTopButton />
    </div>
  );
}

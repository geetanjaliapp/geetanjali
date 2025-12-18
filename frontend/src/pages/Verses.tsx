import { useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { versesApi } from "../lib/api";
import type { Verse } from "../types";
import { Navbar } from "../components";
import { Footer } from "../components/Footer";
import { VerseCard, VerseCardSkeleton } from "../components/VerseCard";
import { BackToTopButton } from "../components/BackToTopButton";
import { CloseIcon, ChevronDownIcon, SpinnerIcon, HeartIcon } from "../components/icons";
import { errorMessages } from "../lib/errorMessages";
import { useSEO, useFavorites, useShare } from "../hooks";
import {
  PRINCIPLE_TAXONOMY,
  getPrincipleShortLabel,
} from "../constants/principles";

// Responsive page size: 16 for desktop (4x4 grid), 12 for mobile
const getVersesPerPage = () => {
  if (typeof window === "undefined") return 12;
  return window.innerWidth >= 1024 ? 16 : 12;
};

// Shared grid layout classes
const VERSE_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 items-start";

// Animation timing constants
const CARD_ANIMATION_DELAY_MS = 30;
const CARD_ANIMATION_MAX_DELAY_MS = 300;
const SKELETON_COUNT = 8;

// Filter pill styling patterns (focus-visible for keyboard-only focus rings)
const FILTER_PILL_BASE =
  "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2";
const FILTER_PILL_ACTIVE = "bg-orange-600 text-white shadow-md";
const FILTER_PILL_INACTIVE =
  "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600";

// Filter modes: 'featured' shows curated verses, 'all' shows all 701 verses, 'favorites' shows user's favorites
type FilterMode = "featured" | "all" | "favorites" | number; // number = specific chapter

export default function Verses() {
  useSEO({
    title: "Browse Verses",
    description:
      "Explore all 701 verses of the Bhagavad Geeta. Search by chapter, browse featured verses, and discover timeless wisdom.",
    canonical: "/verses",
  });

  // Favorites hook for heart icon and filtering
  const { favorites, isFavorite, toggleFavorite, favoritesCount } = useFavorites();

  // Share hook for share button
  const { share, copied: shareCopied } = useShare();

  const [searchParams, setSearchParams] = useSearchParams();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Responsive page size: 16 for desktop (4x4), 12 for mobile
  const pageSize = useMemo(() => getVersesPerPage(), []);

  // Parse initial filter from URL
  const getInitialFilter = (): FilterMode => {
    const chapter = searchParams.get("chapter");
    if (chapter) return parseInt(chapter);
    const showAll = searchParams.get("all");
    if (showAll === "true") return "all";
    const showFavs = searchParams.get("favorites");
    if (showFavs === "true") return "favorites";
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

  // Derived state
  const selectedChapter = typeof filterMode === "number" ? filterMode : null;
  const showFeatured = filterMode === "featured";
  const showAll = filterMode === "all";
  const showFavorites = filterMode === "favorites";

  // Filter verses by favorites when in favorites mode
  const displayedVerses = useMemo(() => {
    if (showFavorites) {
      return verses.filter((v) => favorites.has(v.canonical_id));
    }
    return verses;
  }, [verses, showFavorites, favorites]);

  // All principle IDs for the pill row
  const principleIds = Object.keys(PRINCIPLE_TAXONOMY);

  // Memoized load functions
  const loadCount = useCallback(async () => {
    // For favorites mode, count is just the localStorage favorites count
    if (filterMode === "favorites") {
      setTotalCount(favoritesCount);
      return;
    }
    try {
      const chapter = typeof filterMode === "number" ? filterMode : undefined;
      const featured = filterMode === "featured" ? true : undefined;
      const count = await versesApi.count(
        chapter,
        featured,
        selectedPrinciple || undefined,
      );
      setTotalCount(count);
    } catch {
      setTotalCount(null);
    }
  }, [filterMode, selectedPrinciple, favoritesCount]);

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
          const versePromises = favoriteIds.map((id) =>
            versesApi.get(id).catch(() => null) // Handle deleted/invalid verses gracefully
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

        const chapter = typeof filterMode === "number" ? filterMode : undefined;
        const featured = filterMode === "featured" ? true : undefined;
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
    [filterMode, selectedPrinciple, pageSize, favorites],
  );

  useEffect(() => {
    loadVerses(true);
    loadCount();
  }, [loadVerses, loadCount]);

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

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const chapter = typeof filterMode === "number" ? filterMode : undefined;
      const featured = filterMode === "featured" ? true : undefined;

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
  }, [filterMode, selectedPrinciple, verses.length, loadingMore, pageSize]);

  const updateSearchParams = (filter: FilterMode, principle: string | null) => {
    const params: Record<string, string> = {};
    if (typeof filter === "number") {
      params.chapter = filter.toString();
    } else if (filter === "all") {
      params.all = "true";
    } else if (filter === "favorites") {
      params.favorites = "true";
    }
    if (principle) {
      params.topic = principle;
    }
    setSearchParams(params);
  };

  const handleFilterSelect = (filter: FilterMode) => {
    setFilterMode(filter);
    setSelectedPrinciple(null); // Clear topic on mode change
    updateSearchParams(filter, null);
  };

  const handlePrincipleSelect = (principle: string | null) => {
    setSelectedPrinciple(principle);
    updateSearchParams(filterMode, principle);
  };

  // Share handler for verse cards
  const handleShare = useCallback(
    async (verse: Verse) => {
      const verseRef = `${verse.chapter}.${verse.verse}`;
      const url = `${window.location.origin}/verses/${verse.canonical_id}`;
      const text = verse.translation_en || verse.paraphrase_en || "";

      await share({
        title: `Bhagavad Geeta ${verseRef}`,
        text: text ? `"${text}"` : undefined,
        url,
      });
    },
    [share],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
      <Navbar />

      {/* Page Header */}
      <div className="py-6 sm:py-8 text-center">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 dark:text-gray-100 mb-2">
            Explore the Bhagavad Geeta
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
            701 verses of timeless wisdom
          </p>
        </div>
      </div>

      {/* Sticky Filter Bar - Below navbar */}
      <div className="sticky top-14 sm:top-16 z-10 bg-amber-50/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-sm border-b border-amber-200/50 dark:border-gray-700/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          {/* Filter Pills - Responsive Layout */}
          <div className="flex gap-1.5 sm:gap-2 items-center">
            {/* Featured */}
            <button
              onClick={() => handleFilterSelect("featured")}
              className={`${FILTER_PILL_BASE} ${showFeatured ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
            >
              Featured
            </button>
            {/* All */}
            <button
              onClick={() => handleFilterSelect("all")}
              className={`${FILTER_PILL_BASE} ${showAll ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
            >
              All
            </button>

            {/* Favorites */}
            <button
              onClick={() => handleFilterSelect("favorites")}
              className={`${FILTER_PILL_BASE} flex items-center gap-1.5 ${showFavorites ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
            >
              <HeartIcon className="w-4 h-4" filled={showFavorites || favoritesCount > 0} />
              <span className="hidden sm:inline">Favorites</span>
              {favoritesCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  showFavorites
                    ? "bg-white/20 text-white"
                    : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                }`}>
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Chapter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                className={`${FILTER_PILL_BASE} flex items-center gap-1.5 ${selectedChapter ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
              >
                {selectedChapter ? `Chapter ${selectedChapter}` : "Chapter"}
                <ChevronDownIcon
                  className={`w-4 h-4 transition-transform ${showChapterDropdown ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown Panel */}
              {showChapterDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowChapterDropdown(false)}
                  />
                  {/* Panel */}
                  <div className="absolute left-0 mt-2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 w-56 sm:w-72">
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(
                        (chapter) => (
                          <button
                            key={chapter}
                            onClick={() => {
                              handleFilterSelect(chapter);
                              setShowChapterDropdown(false);
                            }}
                            className={`h-10 rounded-lg text-sm font-medium transition-all ${
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

          {/* Topic Pills Row - with scroll fade indicators */}
          <div className="mt-3 sm:mt-4 relative">
            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-1 w-6 bg-gradient-to-r from-amber-50/95 dark:from-gray-900/95 to-transparent z-10 pointer-events-none sm:hidden" />
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-amber-50/95 dark:from-gray-900/95 to-transparent z-10 pointer-events-none sm:hidden" />

            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:-mx-6 sm:px-6 scrollbar-hide">
              {principleIds.map((principleId) => (
                <button
                  key={principleId}
                  onClick={() =>
                    handlePrincipleSelect(
                      selectedPrinciple === principleId ? null : principleId,
                    )
                  }
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    selectedPrinciple === principleId
                      ? "bg-amber-600 text-white shadow-md"
                      : "bg-amber-50 dark:bg-gray-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-gray-700 border border-amber-200 dark:border-gray-600"
                  }`}
                >
                  {getPrincipleShortLabel(principleId)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Filter Banner - Fixed height to prevent layout shift */}
      <div className="bg-amber-50/80 dark:bg-gray-800/50 border-b border-amber-100 dark:border-gray-700 min-h-[36px] sm:min-h-[40px]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          {selectedChapter || selectedPrinciple ? (
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
          ) : (
            <div className="text-xs sm:text-sm text-amber-600/70 dark:text-amber-400/70">
              {totalCount !== null ? `${totalCount} ` : ""}
              {showFeatured ? "featured verses" : "verses"}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Error State */}
          {error && (
            <div className="mb-4 sm:mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              <p className="font-semibold text-sm sm:text-base">
                Error loading verses
              </p>
              <p className="text-xs sm:text-sm">{error}</p>
            </div>
          )}

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
                <div className="text-4xl sm:text-5xl text-amber-300/60 dark:text-amber-500/40 mb-4">
                  {showFavorites ? "♡" : "ॐ"}
                </div>

                <h3 className="text-lg sm:text-xl font-serif text-gray-700 dark:text-gray-300 mb-2">
                  {showFavorites ? "No favorites yet" : "No verses found"}
                </h3>

                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6">
                  {showFavorites ? (
                    <>
                      Browse verses and tap the{" "}
                      <HeartIcon className="w-4 h-4 inline-block align-text-bottom text-red-400" />{" "}
                      to save your favorites.
                    </>
                  ) : selectedPrinciple && selectedChapter ? (
                    <>
                      No verses in Chapter {selectedChapter} match the "
                      {getPrincipleShortLabel(selectedPrinciple)}" principle.
                    </>
                  ) : selectedPrinciple ? (
                    <>
                      No verses found with the "
                      {getPrincipleShortLabel(selectedPrinciple)}" principle in
                      this selection.
                    </>
                  ) : selectedChapter ? (
                    <>No featured verses found in Chapter {selectedChapter}.</>
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
              {/* Verse Grid */}
              <div
                className={`${VERSE_GRID_CLASSES} transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}
              >
                {displayedVerses.map((verse, index) => (
                  <div
                    key={verse.id}
                    className="animate-fade-in"
                    style={{
                      animationDelay: `${Math.min(index * CARD_ANIMATION_DELAY_MS, CARD_ANIMATION_MAX_DELAY_MS)}ms`,
                    }}
                  >
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
                      onShare={handleShare}
                      shareCopied={shareCopied}
                    />
                  </div>
                ))}
              </div>

              {/* Load More / End of Results */}
              <div className="mt-8 sm:mt-12">
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Left decorative line */}
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300/50 dark:via-amber-600/30 to-amber-300/70 dark:to-amber-600/50" />

                      {/* Center content */}
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

                      {/* Right decorative line */}
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-300/50 dark:via-amber-600/30 to-amber-300/70 dark:to-amber-600/50" />
                    </div>
                  </button>
                ) : (
                  displayedVerses.length > 0 && (
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200/40 dark:via-amber-600/20 to-amber-200/60 dark:to-amber-600/40" />
                      <div className="flex flex-col items-center">
                        <span className="text-amber-300/60 dark:text-amber-500/40 text-xl">
                          {showFavorites ? "♡" : "ॐ"}
                        </span>
                        <span className="text-xs text-amber-600/70 dark:text-amber-500/60 mt-1">
                          {displayedVerses.length} {showFavorites ? "favorite" : "verse"}{displayedVerses.length !== 1 ? "s" : ""}{showFavorites ? "" : " explored"}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-200/40 dark:via-amber-600/20 to-amber-200/60 dark:to-amber-600/40" />
                    </div>
                  )
                )}
              </div>
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

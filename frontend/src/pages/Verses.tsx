import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { versesApi } from "../lib/api";
import type { Verse } from "../types";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { VerseCard, VerseCardSkeleton } from "../components/VerseCard";
import { BackToTopButton } from "../components/BackToTopButton";
import { CloseIcon, ChevronDownIcon, SpinnerIcon } from "../components/icons";
import { errorMessages } from "../lib/errorMessages";
import { useSEO } from "../hooks";
import { PRINCIPLE_TAXONOMY, getPrincipleShortLabel } from "../constants/principles";

// Responsive page size: 16 for desktop (4x4 grid), 12 for mobile
const getVersesPerPage = () => {
  if (typeof window === "undefined") return 12;
  return window.innerWidth >= 1024 ? 16 : 12;
};

// Shared grid layout classes
const VERSE_GRID_CLASSES = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4";

// Animation timing constants
const CARD_ANIMATION_DELAY_MS = 30;
const CARD_ANIMATION_MAX_DELAY_MS = 300;
const SKELETON_COUNT = 8;

// Filter pill styling patterns
const FILTER_PILL_BASE = "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0";
const FILTER_PILL_ACTIVE = "bg-orange-600 text-white shadow-md";
const FILTER_PILL_INACTIVE = "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300";

// Filter modes: 'featured' shows curated verses, 'all' shows all 701 verses
type FilterMode = "featured" | "all" | number; // number = specific chapter

export default function Verses() {
  useSEO({
    title: "Browse Verses",
    description:
      "Explore all 701 verses of the Bhagavad Geeta. Search by chapter, browse featured verses, and discover timeless wisdom.",
    canonical: "/verses",
  });

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
    return "featured";
  };

  const getInitialPrinciple = (): string | null => {
    return searchParams.get("topic");
  };

  const [filterMode, setFilterMode] = useState<FilterMode>(getInitialFilter);
  const [selectedPrinciple, setSelectedPrinciple] = useState<string | null>(getInitialPrinciple);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);

  // Derived state
  const selectedChapter = typeof filterMode === "number" ? filterMode : null;
  const showFeatured = filterMode === "featured";
  const showAll = filterMode === "all";

  // All principle IDs for the pill row
  const principleIds = Object.keys(PRINCIPLE_TAXONOMY);

  // Memoized load functions
  const loadCount = useCallback(async () => {
    try {
      const chapter = typeof filterMode === "number" ? filterMode : undefined;
      const featured = filterMode === "featured" ? true : undefined;
      const count = await versesApi.count(chapter, featured, selectedPrinciple || undefined);
      setTotalCount(count);
    } catch {
      setTotalCount(null);
    }
  }, [filterMode, selectedPrinciple]);

  const loadVerses = useCallback(
    async (reset: boolean = false) => {
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
    [filterMode, selectedPrinciple, pageSize],
  );

  useEffect(() => {
    loadVerses(true);
    loadCount();
  }, [loadVerses, loadCount]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />

      {/* Page Header - Contemplative intro */}
      <div className="bg-gradient-to-b from-amber-50/80 to-transparent py-6 sm:py-8 text-center">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-3xl sm:text-4xl text-amber-400/70 mb-2">ॐ</div>
          <h1 className="text-xl sm:text-2xl font-serif text-amber-900 mb-1">
            Explore the Bhagavad Geeta
          </h1>
          <p className="text-sm text-gray-600">
            701 verses of timeless wisdom
          </p>
        </div>
      </div>

      {/* Sticky Filter Bar - Below navbar */}
      <div className="sticky top-14 sm:top-16 z-10 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200">
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
                  <div className="absolute left-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-gray-200 z-20 w-64 sm:w-72">
                    <div className="grid grid-cols-6 gap-2">
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
                                : "bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-700 border border-gray-200"
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
            <div className="absolute left-0 top-0 bottom-1 w-6 bg-gradient-to-r from-white/95 to-transparent z-10 pointer-events-none sm:hidden" />
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-white/95 to-transparent z-10 pointer-events-none sm:hidden" />

            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:-mx-6 sm:px-6 scrollbar-hide">
              {principleIds.map((principleId) => (
                <button
                  key={principleId}
                  onClick={() =>
                    handlePrincipleSelect(
                      selectedPrinciple === principleId ? null : principleId
                    )
                  }
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    selectedPrinciple === principleId
                      ? "bg-amber-600 text-white shadow-md"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
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
      <div className="bg-amber-50/80 border-b border-amber-100 min-h-[36px] sm:min-h-[40px]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          {(selectedChapter || selectedPrinciple) ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-amber-700">Filtering by:</span>

              {/* Chapter filter tag */}
              {selectedChapter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs sm:text-sm font-medium">
                  Chapter {selectedChapter}
                  <button
                    onClick={() => handleFilterSelect("featured")}
                    className="ml-0.5 hover:bg-orange-200 rounded-full p-0.5 transition-colors"
                    aria-label="Clear chapter filter"
                  >
                    <CloseIcon />
                  </button>
                </span>
              )}

              {/* Principle filter tag */}
              {selectedPrinciple && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs sm:text-sm font-medium">
                  {getPrincipleShortLabel(selectedPrinciple)}
                  <button
                    onClick={() => handlePrincipleSelect(null)}
                    className="ml-0.5 hover:bg-amber-200 rounded-full p-0.5 transition-colors"
                    aria-label="Clear topic filter"
                  >
                    <CloseIcon />
                  </button>
                </span>
              )}

              {/* Count + Clear all */}
              <div className="flex items-center gap-2 ml-auto">
                {totalCount !== null && (
                  <span className="text-xs sm:text-sm text-amber-600/70">
                    {totalCount} verse{totalCount !== 1 ? "s" : ""}
                  </span>
                )}
                <button
                  onClick={() => {
                    setFilterMode("featured");
                    setSelectedPrinciple(null);
                    updateSearchParams("featured", null);
                  }}
                  className="text-xs sm:text-sm text-amber-600 hover:text-amber-800 font-medium underline underline-offset-2"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-amber-600/70">
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
            <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="font-semibold text-sm sm:text-base">
                Error loading verses
              </p>
              <p className="text-xs sm:text-sm">{error}</p>
            </div>
          )}

          {/* Loading State - Skeleton Cards */}
          {loading && verses.length === 0 ? (
            <div className={VERSE_GRID_CLASSES}>
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <VerseCardSkeleton key={i} />
              ))}
            </div>
          ) : verses.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <div className="max-w-md mx-auto">
                {/* Decorative element */}
                <div className="text-4xl sm:text-5xl text-amber-300/60 mb-4">
                  ॐ
                </div>

                <h3 className="text-lg sm:text-xl font-serif text-gray-700 mb-2">
                  No verses found
                </h3>

                <p className="text-sm sm:text-base text-gray-500 mb-6">
                  {selectedPrinciple && selectedChapter ? (
                    <>No verses in Chapter {selectedChapter} match the "{getPrincipleShortLabel(selectedPrinciple)}" principle.</>
                  ) : selectedPrinciple ? (
                    <>No verses found with the "{getPrincipleShortLabel(selectedPrinciple)}" principle in this selection.</>
                  ) : selectedChapter ? (
                    <>No featured verses found in Chapter {selectedChapter}.</>
                  ) : (
                    <>Try adjusting your filters to discover more verses.</>
                  )}
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
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
                    className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Browse all 701 verses
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Verse Grid */}
              <div className={`${VERSE_GRID_CLASSES} transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
                {verses.map((verse, index) => (
                  <Link
                    key={verse.id}
                    to={`/verses/${verse.canonical_id}`}
                    className="transition-all hover:shadow-lg animate-fade-in"
                    style={{ animationDelay: `${Math.min(index * CARD_ANIMATION_DELAY_MS, CARD_ANIMATION_MAX_DELAY_MS)}ms` }}
                  >
                    <VerseCard
                      verse={verse}
                      displayMode="compact"
                      showSpeaker={false}
                      showCitation={true}
                      showTranslation={false}
                      showTranslationPreview={true}
                      onPrincipleClick={handlePrincipleSelect}
                    />
                  </Link>
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
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-amber-300/70" />

                      {/* Center content */}
                      <div className={`flex flex-col items-center transition-all duration-300 ${loadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}>
                        {loadingMore ? (
                          <SpinnerIcon className="w-5 h-5 text-amber-500 mb-1" />
                        ) : (
                          <span className="text-amber-400/80 text-lg mb-0.5">॰</span>
                        )}
                        <span className="text-sm font-medium text-amber-700/80 group-hover:text-amber-800 transition-colors">
                          {loadingMore ? "Loading" : "Continue"}
                        </span>
                        {!loadingMore && totalCount && (
                          <span className="text-xs text-amber-600/50 mt-0.5">
                            {totalCount - verses.length} more
                          </span>
                        )}
                      </div>

                      {/* Right decorative line */}
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-300/50 to-amber-300/70" />
                    </div>
                  </button>
                ) : verses.length > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-amber-200/60" />
                    <div className="flex flex-col items-center">
                      <span className="text-amber-300/60 text-xl">ॐ</span>
                      <span className="text-xs text-amber-600/40 mt-1">
                        {verses.length} verses explored
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-200/40 to-amber-200/60" />
                  </div>
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

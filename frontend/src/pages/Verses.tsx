import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { versesApi } from "../lib/api";
import type { Verse } from "../types";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { VerseCard } from "../components/VerseCard";
import { errorMessages } from "../lib/errorMessages";
import { useSEO } from "../hooks";
import { PRINCIPLE_TAXONOMY, getPrincipleShortLabel } from "../constants/principles";

const VERSES_PER_PAGE = 20;

// Skeleton card for loading state
function VerseCardSkeleton() {
  return (
    <div className="bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-200 shadow-sm animate-pulse">
      {/* Verse Reference skeleton */}
      <div className="flex justify-center mb-2 sm:mb-3">
        <div className="h-4 w-16 bg-amber-200/60 rounded" />
      </div>

      {/* Sanskrit lines skeleton */}
      <div className="space-y-2 flex flex-col items-center">
        <div className="h-4 w-4/5 bg-amber-200/50 rounded" />
        <div className="h-4 w-3/4 bg-amber-200/50 rounded" />
        <div className="h-4 w-4/5 bg-amber-200/50 rounded" />
        <div className="h-4 w-2/3 bg-amber-200/50 rounded" />
      </div>

      {/* Divider skeleton */}
      <div className="my-2 sm:my-3 border-t border-amber-200/30" />

      {/* Translation skeleton */}
      <div className="space-y-1.5 flex flex-col items-center">
        <div className="h-3 w-11/12 bg-gray-200/60 rounded" />
        <div className="h-3 w-4/5 bg-gray-200/60 rounded" />
        <div className="h-3 w-3/4 bg-gray-200/60 rounded" />
      </div>

      {/* Tags skeleton */}
      <div className="mt-2 sm:mt-3 flex justify-center gap-1">
        <div className="h-5 w-14 bg-amber-100 rounded-full" />
        <div className="h-5 w-12 bg-amber-100 rounded-full" />
      </div>
    </div>
  );
}

// Back to Top button component
function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-white border border-gray-300 rounded-full shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all flex items-center justify-center"
      aria-label="Back to top"
    >
      <svg
        className="w-5 h-5 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  );
}

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
          VERSES_PER_PAGE,
          chapter,
          featured,
          selectedPrinciple || undefined,
        );

        if (reset) {
          setVerses(data);
        } else {
          setVerses((prev) => [...prev, ...data]);
        }

        setHasMore(data.length === VERSES_PER_PAGE);
      } catch (err) {
        setError(errorMessages.verseLoad(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterMode, selectedPrinciple],
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
        VERSES_PER_PAGE,
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
      setHasMore(data.length === VERSES_PER_PAGE);
    } catch (err) {
      setError(errorMessages.verseLoad(err));
    } finally {
      setLoadingMore(false);
    }
  }, [filterMode, selectedPrinciple, verses.length, loadingMore]);

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

  const getFilterDescription = () => {
    const parts = [];
    if (showFeatured) parts.push("featured");
    if (selectedChapter) parts.push(`from Chapter ${selectedChapter}`);
    if (selectedPrinciple) parts.push(`on ${getPrincipleShortLabel(selectedPrinciple)}`);
    return parts.length > 0 ? parts.join(" ") + " " : "";
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
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                showFeatured
                  ? "bg-orange-600 text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
              }`}
            >
              Featured
            </button>
            {/* All */}
            <button
              onClick={() => handleFilterSelect("all")}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                showAll
                  ? "bg-orange-600 text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
              }`}
            >
              All
            </button>

            {/* Spacer to push chapter dropdown to right */}
            <div className="flex-1" />

            {/* Chapter Dropdown - Right aligned */}
            <div className="relative">
              <button
                onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  selectedChapter
                    ? "bg-orange-600 text-white shadow-md"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                {selectedChapter ? `Chapter ${selectedChapter}` : "Chapter"}
                <svg
                  className={`w-4 h-4 transition-transform ${showChapterDropdown ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
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
                  <div className="absolute right-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-gray-200 z-20 w-64 sm:w-72">
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

          {/* Topic Pills Row */}
          <div className="mt-3 sm:mt-4 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:-mx-6 sm:px-6 scrollbar-hide">
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

      {/* Active Filter Banner - Shows when filters are applied */}
      {(selectedChapter || selectedPrinciple) && (
        <div className="bg-amber-50/80 border-b border-amber-100">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
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
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
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
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}

              {/* Clear all button */}
              {(selectedChapter || selectedPrinciple) && (
                <button
                  onClick={() => {
                    setFilterMode("featured");
                    setSelectedPrinciple(null);
                    updateSearchParams("featured", null);
                  }}
                  className="text-xs sm:text-sm text-amber-600 hover:text-amber-800 font-medium underline underline-offset-2 ml-auto"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
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
              {/* Results Count */}
              <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-gray-600">
                Showing {verses.length}
                {totalCount ? ` of ${totalCount}` : ""} {getFilterDescription()}
                verse{(totalCount || verses.length) !== 1 ? "s" : ""}
              </div>

              {/* Verse Grid */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
                {verses.map((verse, index) => (
                  <Link
                    key={verse.id}
                    to={`/verses/${verse.canonical_id}`}
                    className="transition-all hover:shadow-lg animate-fade-in"
                    style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
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

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center mt-6 sm:mt-8">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}

              {/* End of Results */}
              {!hasMore && verses.length > 0 && (
                <div className="text-center py-6 sm:py-8 text-gray-400 text-xs sm:text-sm">
                  All verses loaded
                </div>
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

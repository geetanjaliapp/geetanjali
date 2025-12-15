import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Navbar, Footer } from "../components";
import { useSearch, useSEO } from "../hooks";
import { SearchIcon, SpinnerIcon, StarIcon } from "../components/icons";
import { getPrincipleShortLabel } from "../constants/principles";
import { CHAPTERS } from "../constants/chapters";
import type { SearchResult } from "../types";

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
 * Get human-readable label for match type
 */
function getMatchTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    exact_canonical: "Verse Reference",
    exact_sanskrit: "Sanskrit",
    keyword_translation: "Translation",
    keyword_paraphrase: "Leadership Insight",
    principle: "Topic",
    semantic: "Meaning",
  };
  return labels[type] || type;
}

/**
 * Render highlighted text with <mark> tags as React elements
 */
function HighlightedText({ text }: { text: string }) {
  if (!text) return null;

  // Split on <mark> tags and render
  const parts = text.split(/(<mark>.*?<\/mark>)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("<mark>") && part.endsWith("</mark>")) {
          const content = part.slice(6, -7);
          return (
            <mark key={i} className="bg-amber-200 text-amber-900 px-0.5 rounded">
              {content}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * Search result card with match context
 */
function SearchResultCard({
  result,
  onPrincipleClick,
}: {
  result: SearchResult;
  onPrincipleClick?: (principle: string) => void;
}) {
  const { match } = result;

  return (
    <div className="relative bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-150">
      {/* Stretched link for card navigation */}
      <Link
        to={`/verses/${result.canonical_id}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        aria-label={`View verse ${result.chapter}.${result.verse}`}
      />

      <div className="relative z-10 pointer-events-none">
        {/* Header: Verse ref + Featured badge + Match type */}
        <div className="flex items-start justify-between mb-2">
          <div className="text-amber-600 font-serif font-medium text-xs sm:text-sm">
            ॥ {result.chapter}.{result.verse} ॥
          </div>
          <div className="flex items-center gap-1.5">
            {result.is_featured && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px]">
                <StarIcon className="w-2.5 h-2.5" />
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-medium">
              {getMatchTypeLabel(match.type)}
            </span>
          </div>
        </div>

        {/* Sanskrit text */}
        {result.sanskrit_devanagari && (
          <div
            lang="sa"
            className="text-amber-900 font-serif text-sm sm:text-base leading-relaxed text-center mb-2 line-clamp-2"
          >
            {result.sanskrit_devanagari}
          </div>
        )}

        {/* Match highlight or translation preview */}
        <div className="my-2 border-t border-amber-200/50" />
        <p className="text-xs sm:text-sm text-gray-600 text-center leading-relaxed line-clamp-3">
          {match.highlight ? (
            <HighlightedText text={match.highlight} />
          ) : (
            `"${result.translation_en || result.paraphrase_en || ""}"`
          )}
        </p>

        {/* Match context */}
        {match.field && match.field !== "canonical_id" && (
          <div className="mt-2 text-center">
            <span className="text-[10px] text-gray-400">
              Matched in: {match.field.replace("_", " ")}
            </span>
          </div>
        )}
      </div>

      {/* Principle tags - clickable */}
      {result.principles && result.principles.length > 0 && (
        <div className="mt-2 sm:mt-3 flex flex-wrap justify-center gap-1 relative z-10">
          {result.principles.slice(0, 2).map((principle) => (
            <button
              key={principle}
              onClick={(e) => {
                if (onPrincipleClick) {
                  e.preventDefault();
                  e.stopPropagation();
                  onPrincipleClick(principle);
                }
              }}
              className="px-2 py-0.5 rounded-full bg-amber-100/70 text-amber-800 text-[10px] sm:text-xs font-medium pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 hover:bg-amber-200 cursor-pointer transition-colors"
            >
              {getPrincipleShortLabel(principle)}
            </button>
          ))}
          {result.principles.length > 2 && (
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] sm:text-xs font-medium">
              +{result.principles.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Consultation suggestion banner
 */
function ConsultationBanner({
  message,
  cta,
  query,
}: {
  message: string;
  cta: string;
  query: string;
}) {
  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-orange-800">{message}</p>
        <Link
          to={`/cases/new?prefill=${encodeURIComponent(query)}`}
          className="inline-flex items-center justify-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

/**
 * Search page skeleton loader
 */
function SearchSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-48 bg-gray-200 rounded mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-amber-50 rounded-xl p-4 border border-amber-200"
          >
            <div className="h-4 w-16 bg-amber-200/60 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-amber-200/50 rounded" />
              <div className="h-4 w-4/5 bg-amber-200/50 rounded" />
            </div>
            <div className="my-3 border-t border-amber-200/30" />
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-gray-200/60 rounded" />
              <div className="h-3 w-3/4 bg-gray-200/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Search page component
 */
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get initial values from URL
  const initialQuery = searchParams.get("q") || "";
  const initialChapter = searchParams.get("chapter")
    ? parseInt(searchParams.get("chapter")!, 10)
    : undefined;

  const [inputValue, setInputValue] = useState(initialQuery);
  const [selectedChapter, setSelectedChapter] = useState<number | undefined>(
    initialChapter
  );

  const { data, loading, error, search, clear } = useSearch({
    chapter: selectedChapter,
    limit: 30,
  });

  // Track if initial search has been performed
  const hasSearchedRef = useRef(false);

  // SEO
  useSEO({
    title: initialQuery
      ? `Search: ${initialQuery} | Geetanjali`
      : "Search Verses | Geetanjali",
    description: "Search the Bhagavad Geeta by verse reference, Sanskrit text, keywords, or meaning.",
  });

  // Search on mount if query in URL
  useEffect(() => {
    if (initialQuery && !hasSearchedRef.current) {
      hasSearchedRef.current = true;
      search(initialQuery);
    }
  }, [initialQuery, search]);

  // Handle form submit
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      // Update URL
      const newParams = new URLSearchParams();
      newParams.set("q", trimmed);
      if (selectedChapter) newParams.set("chapter", String(selectedChapter));
      setSearchParams(newParams);

      // Execute search
      search(trimmed);
    },
    [inputValue, selectedChapter, search, setSearchParams]
  );

  // Handle chapter change
  const handleChapterChange = useCallback(
    (chapter: number | undefined) => {
      setSelectedChapter(chapter);

      // If we have a query, re-search with new filter
      if (inputValue.trim()) {
        const newParams = new URLSearchParams();
        newParams.set("q", inputValue.trim());
        if (chapter) newParams.set("chapter", String(chapter));
        setSearchParams(newParams);
      }
    },
    [inputValue, setSearchParams]
  );

  // Handle principle tag click - navigate to verses with filter
  const handlePrincipleClick = useCallback(
    (principle: string) => {
      navigate(`/verses?topic=${principle}`);
    },
    [navigate]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setInputValue("");
    setSelectedChapter(undefined);
    setSearchParams({});
    clear();
  }, [clear, setSearchParams]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-red-50">
      <Navbar />

      <div className="flex-grow container mx-auto px-4 py-6 sm:py-8">
        {/* Search Header */}
        <div className="max-w-2xl mx-auto mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-center">
            Search Verses
          </h1>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search by verse (2.47), Sanskrit, or keywords..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder-gray-400"
                aria-label="Search query"
              />
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              {inputValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Chapter Filter */}
              <select
                value={selectedChapter || ""}
                onChange={(e) =>
                  handleChapterChange(
                    e.target.value ? parseInt(e.target.value, 10) : undefined
                  )
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                aria-label="Filter by chapter"
              >
                <option value="">All Chapters</option>
                {CHAPTERS.map((ch) => (
                  <option key={ch.number} value={ch.number}>
                    Ch. {ch.number}: {ch.name}
                  </option>
                ))}
              </select>

              {/* Search Button */}
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SearchIcon className="w-4 h-4" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results Section */}
        <div className="max-w-6xl mx-auto">
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Moderation Block */}
          {data?.moderation?.blocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-amber-800">{data.moderation.message}</p>
            </div>
          )}

          {/* Consultation Suggestion */}
          {data?.suggestion && (
            <ConsultationBanner
              message={data.suggestion.message}
              cta={data.suggestion.cta}
              query={data.query}
            />
          )}

          {/* Loading State */}
          {loading && <SearchSkeleton />}

          {/* Results */}
          {!loading && data && !data.moderation?.blocked && (
            <>
              {/* Results Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-sm text-gray-600">
                  {data.total === 0 ? (
                    "No results found"
                  ) : (
                    <>
                      <span className="font-medium">{data.total}</span> result
                      {data.total !== 1 && "s"} for "{data.query}"
                    </>
                  )}
                </p>
                {data.total > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {getStrategyLabel(data.strategy)}
                  </span>
                )}
              </div>

              {/* Results Grid */}
              {data.total > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.results.map((result) => (
                    <SearchResultCard
                      key={result.canonical_id}
                      result={result}
                      onPrincipleClick={handlePrincipleClick}
                    />
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">
                    No verses found matching your search.
                  </p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Try:</p>
                    <ul className="list-disc list-inside">
                      <li>Using different keywords</li>
                      <li>Searching by verse reference (e.g., "2.47")</li>
                      <li>Removing chapter filter</li>
                    </ul>
                  </div>
                  <Link
                    to="/verses"
                    className="inline-block mt-6 text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Browse all verses →
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Initial State (no search yet) */}
          {!loading && !data && !error && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Search the Bhagavad Geeta
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Find verses by reference (2.47), Sanskrit text, keywords, or
                describe what you're looking for.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["karma yoga", "detachment", "2.47", "duty"].map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setInputValue(example);
                      search(example);
                      setSearchParams({ q: example });
                    }}
                    className="px-3 py-1.5 bg-amber-100 text-amber-800 text-sm rounded-full hover:bg-amber-200 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

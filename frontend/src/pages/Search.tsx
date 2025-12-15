import { useState, useEffect, useCallback, useRef, useMemo, type FormEvent } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Navbar, Footer } from "../components";
import { useSearch, useSEO } from "../hooks";
import { versesApi } from "../lib/api";
import { SearchIcon, SpinnerIcon, StarIcon, CloseIcon } from "../components/icons";
import { getPrincipleShortLabel, PRINCIPLE_TAXONOMY, type PrincipleId } from "../constants/principles";
import { formatSanskritLines } from "../lib/sanskritFormatter";
import { validateSearchQuery } from "../lib/contentFilter";
import type { SearchResult, Verse } from "../types";

// localStorage key for recent searches
const RECENT_SEARCHES_KEY = "geetanjali:recentSearches";
const MAX_RECENT_SEARCHES = 5;

// Popular topics for quick exploration
const POPULAR_TOPICS: { id: PrincipleId; icon: string }[] = [
  { id: "duty_focus", icon: "⚖️" },
  { id: "detachment", icon: "🪷" },
  { id: "self_control", icon: "🧘" },
  { id: "compassion", icon: "💙" },
  { id: "ethical_character", icon: "✨" },
  { id: "self_responsibility", icon: "🎯" },
];

// Search type examples for educational hints
const SEARCH_EXAMPLES = [
  { query: "2.47", label: "By verse", description: "Direct verse reference" },
  { query: "कर्म", label: "Sanskrit", description: "Devanagari text" },
  { query: "duty", label: "Keyword", description: "English search" },
];

// Responsive page size: 16 for desktop, 12 for mobile (matches Verses page)
const getResultsPerPage = () => {
  if (typeof window === "undefined") return 12;
  return window.innerWidth >= 1024 ? 16 : 12;
};

/**
 * Get recent searches from localStorage
 */
function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a search to recent searches
 */
function saveRecentSearch(query: string): void {
  try {
    const trimmed = query.trim();
    if (!trimmed) return;

    const recent = getRecentSearches();
    const filtered = recent.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear recent searches
 */
function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore
  }
}

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
 * Layout consistent with VerseCard compact mode
 */
function SearchResultCard({
  result,
  onPrincipleClick,
}: {
  result: SearchResult;
  onPrincipleClick?: (principle: string) => void;
}) {
  const { match } = result;

  // Format Sanskrit text consistently with VerseCard
  const sanskritLines = useMemo(
    () =>
      formatSanskritLines(result.sanskrit_devanagari || "", {
        mode: "compact",
        includeSpeakerIntro: false,
      }),
    [result.sanskrit_devanagari]
  );

  return (
    <div className="relative bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-150">
      <Link
        to={`/verses/${result.canonical_id}?from=search`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        aria-label={`View verse ${result.chapter}.${result.verse}`}
      />

      <div className="relative z-10 pointer-events-none">
        {/* Header: Verse Reference + Badges */}
        <div className="flex items-start justify-between mb-2 sm:mb-3">
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

        {/* Sanskrit Text - formatted consistently with VerseCard */}
        {sanskritLines.length > 0 && (
          <div
            lang="sa"
            className="text-amber-900 font-serif text-sm sm:text-base leading-relaxed text-center"
          >
            {sanskritLines.map((line, idx) => (
              <p key={idx} className="mb-0.5">
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="my-2 border-t border-amber-200/50" />

        {/* Translation/Match Highlight */}
        <p className="text-xs sm:text-sm text-gray-600 text-center leading-relaxed line-clamp-3">
          {match.highlight ? (
            <HighlightedText text={match.highlight} />
          ) : (
            `"${result.translation_en || result.paraphrase_en || ""}"`
          )}
        </p>

        {/* Match field indicator */}
        {match.field && match.field !== "canonical_id" && (
          <div className="mt-2 text-center">
            <span className="text-[10px] text-gray-400">
              Matched in: {match.field.replace("_", " ")}
            </span>
          </div>
        )}
      </div>

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
      <div className="h-4 w-48 bg-amber-200/50 rounded mb-6" />
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
 * Featured verse spotlight for starter content
 */
function StarterVerseSpotlight({
  verse,
  loading,
}: {
  verse: Verse | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-amber-200/50 shadow-lg animate-pulse">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 bg-amber-200/50 rounded-full mx-auto" />
          <div className="h-6 w-48 bg-amber-200/50 rounded mx-auto" />
          <div className="h-20 bg-amber-200/40 rounded" />
        </div>
      </div>
    );
  }

  if (!verse) return null;

  const verseRef = `${verse.chapter}.${verse.verse}`;
  const sanskritLines = formatSanskritLines(verse.sanskrit_devanagari || "", {
    mode: "compact",
  });

  return (
    <Link
      to={`/verses/${verse.canonical_id}?from=search`}
      className="block"
    >
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-amber-200/50 shadow-lg hover:shadow-xl hover:border-amber-300 transition-all">
        {/* Om Symbol */}
        <div className="text-center mb-4">
          <div className="text-2xl sm:text-3xl text-amber-400/60 font-light">ॐ</div>
        </div>

        {/* Sanskrit */}
        {verse.sanskrit_devanagari && (
          <div className="text-center mb-4">
            <div
              lang="sa"
              className="text-base sm:text-lg md:text-xl font-serif text-amber-900 leading-relaxed tracking-wide space-y-0.5"
            >
              {sanskritLines.map((line, idx) => (
                <p key={idx} className="mb-0">
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Verse Reference */}
        <div className="text-center mb-4">
          <span className="text-amber-700/70 font-serif text-sm sm:text-base">
            ॥ {verseRef} ॥
          </span>
        </div>

        {/* Translation Preview */}
        {verse.paraphrase_en && (
          <p className="text-center text-sm sm:text-base text-gray-600 leading-relaxed max-w-lg mx-auto line-clamp-2">
            "{verse.paraphrase_en}"
          </p>
        )}

        {/* View prompt */}
        <div className="text-center mt-4">
          <span className="text-xs sm:text-sm text-orange-600 font-medium">
            Explore this verse →
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Search starter content - shown when no search has been performed
 */
function SearchStarterContent({
  onSearch,
  onTopicClick,
  featuredVerse,
  verseLoading,
}: {
  onSearch: (query: string) => void;
  onTopicClick: (topic: string) => void;
  featuredVerse: Verse | null;
  verseLoading: boolean;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Quick Search Examples - centered, prominent */}
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-3">Try searching for</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SEARCH_EXAMPLES.map((example) => (
            <button
              key={example.query}
              onClick={() => onSearch(example.query)}
              className="group px-4 py-2 bg-white rounded-full border border-amber-200 hover:border-orange-400 hover:shadow-md transition-all"
            >
              <span className="font-medium text-gray-800 group-hover:text-orange-700">
                {example.query}
              </span>
              <span className="ml-2 text-xs text-gray-400">{example.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Browse by Topic - horizontal scroll on mobile */}
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-3">Or explore by topic</p>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_TOPICS.map((topic) => {
            const principle = PRINCIPLE_TAXONOMY[topic.id];
            return (
              <button
                key={topic.id}
                onClick={() => onTopicClick(topic.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-full text-sm font-medium border border-amber-200 hover:border-amber-300 transition-all"
              >
                <span>{topic.icon}</span>
                <span>{principle.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Featured Verse - subtle card */}
      <div>
        <p className="text-center text-sm text-gray-500 mb-3">Verse Spotlight</p>
        <StarterVerseSpotlight verse={featuredVerse} loading={verseLoading} />
      </div>

      {/* Bottom CTA */}
      <div className="text-center">
        <Link
          to="/verses"
          className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
        >
          <span>Browse all 700 verses</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
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

  // Get initial query from URL
  const initialQuery = searchParams.get("q") || "";

  const [inputValue, setInputValue] = useState(initialQuery);

  // Responsive page size: 16 for desktop, 12 for mobile
  const pageSize = useMemo(() => getResultsPerPage(), []);

  const { data, loading, loadingMore, error, hasMore, search, loadMore, clear } = useSearch({
    limit: pageSize,
  });

  // Track if initial search has been performed
  const hasSearchedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Featured verse for starter content
  const [featuredVerse, setFeaturedVerse] = useState<Verse | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);

  // Recent searches state
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const [showRecent, setShowRecent] = useState(false);

  // Content validation error (profanity filter)
  // Initialize with validation of URL query to avoid effect-based setState
  const [validationError, setValidationError] = useState<string | null>(() => {
    if (!initialQuery) return null;
    const validation = validateSearchQuery(initialQuery);
    return validation.valid ? null : (validation.reason || "Invalid search query");
  });

  // Load featured verse on mount
  useEffect(() => {
    let cancelled = false;
    versesApi
      .getRandom()
      .then((data) => {
        if (!cancelled) setFeaturedVerse(data);
      })
      .catch(() => {
        // Silent fail
      })
      .finally(() => {
        if (!cancelled) setVerseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // SEO
  useSEO({
    title: initialQuery
      ? `Search: ${initialQuery} | Geetanjali`
      : "Search Verses | Geetanjali",
    description: "Search the Bhagavad Geeta by verse reference, Sanskrit text, keywords, or meaning.",
  });

  // Search on mount if query in URL (skip if validation failed)
  useEffect(() => {
    if (initialQuery && !hasSearchedRef.current && !validationError) {
      hasSearchedRef.current = true;
      search(initialQuery);
    }
  }, [initialQuery, search, validationError]);

  // Handle form submit
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      // Clear previous validation error
      setValidationError(null);

      // Validate query before searching
      const validation = validateSearchQuery(trimmed);
      if (!validation.valid) {
        setValidationError(validation.reason || "Invalid search query");
        clear(); // Clear previous results
        return;
      }

      // Update URL
      setSearchParams({ q: trimmed });

      // Save to recent searches
      saveRecentSearch(trimmed);
      setRecentSearches(getRecentSearches());
      setShowRecent(false);

      // Execute search
      search(trimmed);
    },
    [inputValue, search, setSearchParams, clear]
  );

  // Handle quick search (from example buttons)
  const handleQuickSearch = useCallback(
    (query: string) => {
      setInputValue(query);
      setSearchParams({ q: query });
      saveRecentSearch(query);
      setRecentSearches(getRecentSearches());
      search(query);
    },
    [search, setSearchParams]
  );

  // Handle selecting a recent search
  const handleRecentSelect = useCallback(
    (query: string) => {
      setInputValue(query);
      setShowRecent(false);
      setSearchParams({ q: query });
      search(query);
    },
    [search, setSearchParams]
  );

  // Handle clearing recent searches
  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Handle topic click - navigate to verses with filter
  const handleTopicClick = useCallback(
    (topic: string) => {
      navigate(`/verses?topic=${topic}`);
    },
    [navigate]
  );

  // Handle principle tag click in results
  const handlePrincipleClick = useCallback(
    (principle: string) => {
      navigate(`/verses?topic=${principle}`);
    },
    [navigate]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setInputValue("");
    setSearchParams({});
    clear();
  }, [clear, setSearchParams]);

  // Determine if we should show starter content
  const showStarterContent = !loading && !data && !error && !validationError;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-red-50">
      <Navbar />

      <div className="flex-grow container mx-auto px-4 py-6 sm:py-8">
        {/* Search Header */}
        <div className="max-w-2xl mx-auto mb-6 sm:mb-8">
          {/* Search Form */}
          <form onSubmit={handleSubmit}>
            <div className="relative flex items-center">
              {/* Search Input */}
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  onFocus={() => setShowRecent(true)}
                  onBlur={() => setTimeout(() => setShowRecent(false), 200)}
                  placeholder="Search verses, topics, or references..."
                  className="w-full pl-10 pr-10 py-3 sm:py-3.5 border border-amber-200 rounded-l-full sm:rounded-l-full bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:z-10 text-gray-900 placeholder-gray-400 shadow-sm transition-shadow"
                  aria-label="Search query"
                />
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />

                {/* Clear button or keyboard hint */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {inputValue ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Clear search"
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  ) : (
                    <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] text-amber-600/70 bg-amber-50 rounded border border-amber-200/50">
                      ⌘K
                    </kbd>
                  )}
                </div>

                {/* Recent Searches Dropdown */}
                {showRecent && recentSearches.length > 0 && !inputValue && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-amber-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-amber-100 bg-amber-50/50">
                      <span className="text-xs font-medium text-gray-500">Recent</span>
                      <button
                        type="button"
                        onClick={handleClearRecent}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    </div>
                    <ul>
                      {recentSearches.map((query, index) => (
                        <li key={index}>
                          <button
                            type="button"
                            onClick={() => handleRecentSelect(query)}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-orange-50 flex items-center gap-3 transition-colors"
                          >
                            <SearchIcon className="w-4 h-4 text-amber-400" />
                            {query}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Search Button - inline with input */}
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="px-4 sm:px-6 py-3 sm:py-3.5 bg-orange-600 text-white font-medium rounded-r-full hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm hover:shadow-md border border-orange-600 hover:border-orange-700 -ml-px"
              >
                {loading ? (
                  <SpinnerIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <SearchIcon className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </form>
        </div>

        {/* Content Section */}
        <div className="max-w-6xl mx-auto">
          {/* Validation Error (profanity filter) */}
          {validationError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-center">
              <p className="text-amber-800">{validationError}</p>
            </div>
          )}

          {/* API Error State */}
          {error && !validationError && (
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
                      {hasMore ? (
                        <>
                          <span className="font-medium">{data.total}</span>
                          <span className="text-gray-400"> of </span>
                          <span className="font-medium">{data.total_count}</span>
                        </>
                      ) : (
                        <span className="font-medium">{data.total_count ?? data.total}</span>
                      )}
                      {" "}result{(data.total_count ?? data.total) !== 1 && "s"} for "{data.query}"
                    </>
                  )}
                </p>
                {data.total > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full font-medium">
                    {getStrategyLabel(data.strategy)}
                  </span>
                )}
              </div>

              {/* Results Grid */}
              {data.total > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.results.map((result) => (
                      <SearchResultCard
                        key={result.canonical_id}
                        result={result}
                        onPrincipleClick={handlePrincipleClick}
                      />
                    ))}
                  </div>

                  {/* Load More / End of Results */}
                  <div className="mt-8 sm:mt-10">
                    {hasMore ? (
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-amber-300/70" />
                          <div className={`flex flex-col items-center transition-all duration-300 ${loadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}>
                            {loadingMore ? (
                              <div className="flex items-center gap-2 text-amber-600">
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="text-sm font-medium">Loading...</span>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm font-medium text-amber-700 group-hover:text-amber-800">
                                  Load More
                                </span>
                                <svg className="w-4 h-4 text-amber-500 group-hover:text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </>
                            )}
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-300/50 to-amber-300/70" />
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-amber-200/70" />
                        <span className="text-xs text-amber-600/60 font-medium">
                          All {data.total} results shown
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-200/50 to-amber-200/70" />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Empty Results State */
                <div className="text-center py-12 bg-white/50 rounded-2xl border border-amber-100">
                  <div className="text-4xl text-amber-300/60 mb-4">ॐ</div>
                  <h3 className="text-lg font-serif text-gray-700 mb-2">
                    No verses found
                  </h3>

                  {/* Show consultation CTA if query looks like a personal question */}
                  {(data.suggestion || data.query.split(" ").length >= 5) ? (
                    <>
                      <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                        Your question sounds like you're seeking personal guidance.
                        Our consultation feature can provide tailored insights from the Geeta.
                      </p>
                      <Link
                        to={`/cases/new?prefill=${encodeURIComponent(data.query)}`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 transition-colors shadow-lg hover:shadow-xl mb-6"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Get Personal Guidance
                      </Link>
                      <p className="text-xs text-gray-400">
                        Or try a simpler search below
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                      Try different keywords or a verse reference (e.g., "2.47").
                    </p>
                  )}

                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <button
                      onClick={() => handleQuickSearch("karma")}
                      className="px-3 py-1.5 bg-amber-100 text-amber-800 text-sm rounded-full hover:bg-amber-200 transition-colors"
                    >
                      Try "karma"
                    </button>
                    <button
                      onClick={() => handleQuickSearch("2.47")}
                      className="px-3 py-1.5 bg-amber-100 text-amber-800 text-sm rounded-full hover:bg-amber-200 transition-colors"
                    >
                      Try "2.47"
                    </button>
                    <Link
                      to="/verses"
                      className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded-full hover:bg-orange-200 transition-colors"
                    >
                      Browse all verses
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Starter Content (no search yet) */}
          {showStarterContent && (
            <SearchStarterContent
              onSearch={handleQuickSearch}
              onTopicClick={handleTopicClick}
              featuredVerse={featuredVerse}
              verseLoading={verseLoading}
            />
          )}
        </div>
      </div>

      <Footer />

      {/* Bottom padding for FAB on mobile */}
      <div className="h-20 sm:hidden" />
    </div>
  );
}

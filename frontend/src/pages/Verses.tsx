import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { versesApi } from '../lib/api';
import type { Verse } from '../types';
import { Navbar } from '../components/Navbar';
import { VerseCard } from '../components/VerseCard';
import { errorMessages } from '../lib/errorMessages';

const VERSES_PER_PAGE = 24;

// Filter modes: 'featured' shows curated verses, 'all' shows all 701 verses
type FilterMode = 'featured' | 'all' | number; // number = specific chapter

export default function Verses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const observerTarget = useRef<HTMLDivElement>(null);

  // Parse initial filter from URL
  const getInitialFilter = (): FilterMode => {
    const chapter = searchParams.get('chapter');
    if (chapter) return parseInt(chapter);
    const showAll = searchParams.get('all');
    if (showAll === 'true') return 'all';
    return 'featured'; // Default to featured
  };

  const [filterMode, setFilterMode] = useState<FilterMode>(getInitialFilter);

  // Derived state
  const selectedChapter = typeof filterMode === 'number' ? filterMode : null;
  const showFeatured = filterMode === 'featured';
  const showAll = filterMode === 'all';

  // Memoized load functions
  const loadCount = useCallback(async () => {
    try {
      const chapter = typeof filterMode === 'number' ? filterMode : undefined;
      const featured = filterMode === 'featured' ? true : undefined;
      const count = await versesApi.count(chapter, featured);
      setTotalCount(count);
    } catch {
      // Silently fail - count is optional
      setTotalCount(null);
    }
  }, [filterMode]);

  const loadVerses = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setVerses([]);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // Determine API parameters based on filter mode
      const chapter = typeof filterMode === 'number' ? filterMode : undefined;
      const featured = filterMode === 'featured' ? true : undefined;

      // For non-reset loads, we need to get current verses length
      const skip = reset ? 0 : undefined;

      const data = await versesApi.list(skip ?? 0, VERSES_PER_PAGE, chapter, featured);

      if (reset) {
        setVerses(data);
      } else {
        setVerses(prev => {
          // Use previous length for skip calculation in next request
          return [...prev, ...data];
        });
      }

      setHasMore(data.length === VERSES_PER_PAGE);
    } catch (err) {
      setError(errorMessages.verseLoad(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterMode]);

  // Load initial verses and count when filter changes
  useEffect(() => {
    loadVerses(true);
    loadCount();
  }, [loadVerses, loadCount]);

  // Intersection Observer for infinite scroll - load more based on current verses count
  const loadMore = useCallback(() => {
    setVerses(currentVerses => {
      // Trigger async load with current count
      (async () => {
        try {
          setLoadingMore(true);
          setError(null);

          const chapter = typeof filterMode === 'number' ? filterMode : undefined;
          const featured = filterMode === 'featured' ? true : undefined;
          const data = await versesApi.list(currentVerses.length, VERSES_PER_PAGE, chapter, featured);

          setVerses(prev => [...prev, ...data]);
          setHasMore(data.length === VERSES_PER_PAGE);
        } catch (err) {
          setError(errorMessages.verseLoad(err));
        } finally {
          setLoadingMore(false);
        }
      })();
      return currentVerses; // Return unchanged to avoid state mutation
    });
  }, [filterMode]);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loadingMore && !loading) {
      loadMore();
    }
  }, [hasMore, loadingMore, loading, loadMore]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadVerses(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await versesApi.search(searchQuery);
      setVerses(data);
      setHasMore(false); // Search results don't paginate
    } catch (err) {
      setError(errorMessages.search(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSelect = (filter: FilterMode) => {
    setFilterMode(filter);
    setSearchQuery('');

    // Update URL params
    if (typeof filter === 'number') {
      setSearchParams({ chapter: filter.toString() });
    } else if (filter === 'all') {
      setSearchParams({ all: 'true' });
    } else {
      setSearchParams({}); // Featured is default, no params needed
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    loadVerses(true);
  };

  // Get filter description for results
  const getFilterDescription = () => {
    if (searchQuery) return '';
    if (showFeatured) return 'featured ';
    if (selectedChapter) return `from Chapter ${selectedChapter} `;
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search verses by text, principles, or ID..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* Filter Pills - Full Width */}
          <div className="flex gap-2 items-center">
            {/* Featured (default) */}
            <button
              onClick={() => handleFilterSelect('featured')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                showFeatured
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Featured
            </button>
            {/* All verses */}
            <button
              onClick={() => handleFilterSelect('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                showAll
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              All
            </button>
            {/* Divider */}
            <div className="w-px h-10 bg-gray-300 flex-shrink-0" />
            {/* Chapter pills - evenly distributed */}
            {Array.from({ length: 18 }, (_, i) => i + 1).map((chapter) => (
              <button
                key={chapter}
                onClick={() => handleFilterSelect(chapter)}
                className={`flex-1 min-w-0 h-10 rounded-lg font-medium transition-colors ${
                  selectedChapter === chapter
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {chapter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Error State */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
              <p className="font-semibold">Error loading verses</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && verses.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-gray-500 text-lg">Loading verses...</div>
            </div>
          ) : verses.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg mb-4">No verses found</p>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  Clear search and show featured verses
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Results Count */}
              <div className="mb-4 text-sm text-gray-600">
                Showing {verses.length}{totalCount ? ` of ${totalCount}` : ''} {getFilterDescription()}verse{(totalCount || verses.length) !== 1 ? 's' : ''}
                {hasMore && ' (scroll for more)'}
              </div>

              {/* Verse Grid - Compact Cards with consistent heights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
                {verses.map((verse) => (
                  <Link
                    key={verse.id}
                    to={`/verses/${verse.canonical_id}`}
                    className="transition-all hover:shadow-lg"
                  >
                    <VerseCard
                      verse={verse}
                      displayMode="compact"
                      showSpeaker={false}
                      showCitation={true}
                      showTranslation={false}
                    />
                  </Link>
                ))}
              </div>

              {/* Infinite Scroll Trigger */}
              <div ref={observerTarget} className="h-10 mt-6">
                {loadingMore && (
                  <div className="flex justify-center items-center py-4">
                    <div className="text-gray-500">Loading more verses...</div>
                  </div>
                )}
              </div>

              {/* End of Results */}
              {!hasMore && verses.length > 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  End of verses
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

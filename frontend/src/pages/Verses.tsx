import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { versesApi } from '../lib/api';
import type { Verse } from '../types';
import VerseCard from '../components/VerseCard';

export default function Verses() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadVerses();
  }, [selectedChapter]);

  const loadVerses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await versesApi.list(0, 100, selectedChapter || undefined);
      setVerses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verses');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadVerses();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await versesApi.search(searchQuery);
      setVerses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search verses');
    } finally {
      setLoading(false);
    }
  };

  const filteredVerses = verses.filter(verse => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      verse.canonical_id.toLowerCase().includes(query) ||
      verse.paraphrase_en?.toLowerCase().includes(query) ||
      verse.consulting_principles?.some(p => p.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="Geetanjali" className="h-12 w-12" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Verse Browser</h1>
                <p className="text-sm text-gray-600">Explore the wisdom of the Bhagavad Gita</p>
              </div>
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                List
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search verses, principles, or canonical IDs..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md transition-colors"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    loadVerses();
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-md transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* Chapter Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedChapter(null)}
              className={`px-4 py-2 rounded-md font-medium whitespace-nowrap transition-colors ${
                selectedChapter === null
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              All Chapters
            </button>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((chapter) => (
              <button
                key={chapter}
                onClick={() => setSelectedChapter(chapter)}
                className={`px-4 py-2 rounded-md font-medium whitespace-nowrap transition-colors ${
                  selectedChapter === chapter
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Ch {chapter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-semibold">Error loading verses</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-gray-500 text-lg">Loading verses...</div>
          </div>
        ) : filteredVerses.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">No verses found</p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  loadVerses();
                }}
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                Clear search and show all verses
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Showing {filteredVerses.length} verse{filteredVerses.length !== 1 ? 's' : ''}
              {selectedChapter && ` from Chapter ${selectedChapter}`}
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVerses.map((verse) => (
                  <div key={verse.id}>
                    <VerseCard verse={verse} showExploreLink={false} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredVerses.map((verse) => (
                  <div key={verse.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {verse.canonical_id.replace('BG_', '').replace(/_/g, '.')}
                        </h3>
                        <p className="text-sm text-orange-600">
                          Chapter {verse.chapter}, Verse {verse.verse}
                        </p>
                      </div>
                    </div>

                    {verse.sanskrit_devanagari && (
                      <div className="mb-4">
                        <p className="text-xl text-gray-800 font-serif leading-relaxed">
                          {verse.sanskrit_devanagari}
                        </p>
                      </div>
                    )}

                    {verse.paraphrase_en && (
                      <div className="mb-4">
                        <p className="text-gray-700 leading-relaxed italic">
                          "{verse.paraphrase_en}"
                        </p>
                      </div>
                    )}

                    {verse.consulting_principles && verse.consulting_principles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {verse.consulting_principles.map((principle, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full border border-orange-200"
                          >
                            {principle}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

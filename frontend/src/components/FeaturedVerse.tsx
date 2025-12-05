import { Link } from 'react-router-dom';
import { formatSanskritLines } from '../lib/sanskritFormatter';
import type { Verse } from '../types';

interface FeaturedVerseProps {
  verse: Verse;
  loading?: boolean;
}

export function FeaturedVerse({ verse, loading = false }: FeaturedVerseProps) {
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-2xl p-12 border border-amber-200/50 shadow-xl">
          <div className="text-center space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-24 mx-auto" />
            <div className="h-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!verse) {
    return null;
  }

  const verseRef = `${verse.chapter}.${verse.verse}`;
  const sanskritLines = formatSanskritLines(verse.sanskrit_devanagari || '', {
    mode: 'compact',
  });

  return (
    <Link
      to={`/verses/${verse.canonical_id}`}
      className="block max-w-4xl mx-auto"
    >
      {/* Main Featured Verse Container - Clickable */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-2xl p-12 border border-amber-200/50 shadow-xl hover:shadow-2xl hover:border-amber-300 transition-all cursor-pointer">
        {/* Sanskrit Devanagari - Spotlight */}
        {verse.sanskrit_devanagari && (
          <div className="text-center mb-8">
            <div className="text-4xl text-amber-400/50 mb-6 font-light">ॐ</div>
            <div className="text-2xl md:text-3xl font-serif text-amber-900 leading-relaxed tracking-wide mb-6 space-y-1">
              {sanskritLines.map((line, idx) => (
                <p key={idx} className="mb-0">
                  {line}
                </p>
              ))}
            </div>
            <Link
              to={`/verses/${verse.canonical_id}`}
              onClick={(e) => e.preventDefault()}
              className="text-amber-700/70 font-serif text-lg hover:text-amber-900 transition-colors"
            >
              ॥ {verseRef} ॥
            </Link>
          </div>
        )}

        {/* Paraphrase - Leadership Insight */}
        {verse.paraphrase_en && (
          <div className="mt-8 bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-amber-100/50">
            <p className="text-lg text-gray-800 leading-relaxed italic">
              "{verse.paraphrase_en}"
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

export default FeaturedVerse;

import { Link } from 'react-router-dom';
import type { Verse } from '../types';

interface VerseCardProps {
  verse: Verse;
  showExploreLink?: boolean;
}

export default function VerseCard({ verse, showExploreLink = true }: VerseCardProps) {
  return (
    <div className="bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 rounded-2xl shadow-xl p-8 border-2 border-orange-200">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-orange-800 uppercase tracking-wide mb-2">
          Verse of the Day
        </h3>
        <p className="text-xs text-orange-600 font-medium">
          Chapter {verse.chapter}, Verse {verse.verse}
        </p>
      </div>

      {/* Sanskrit Text */}
      {verse.sanskrit_devanagari && (
        <div className="mb-6">
          <p className="text-2xl text-gray-800 font-serif leading-relaxed text-center">
            {verse.sanskrit_devanagari}
          </p>
        </div>
      )}

      {/* English Translation */}
      {verse.paraphrase_en && (
        <div className="mb-6">
          <p className="text-lg text-gray-700 leading-relaxed text-center italic">
            "{verse.paraphrase_en}"
          </p>
        </div>
      )}

      {/* Reference */}
      <div className="flex items-center justify-between pt-4 border-t border-orange-200">
        <p className="text-sm text-gray-600 font-medium">
          — Bhagavad Gita {verse.canonical_id.replace('BG_', '').replace(/_/g, '.')}
        </p>

        {showExploreLink && (
          <Link
            to="/verses"
            className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
          >
            Explore All Verses →
          </Link>
        )}
      </div>

      {/* Principles Tags */}
      {verse.consulting_principles && verse.consulting_principles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {verse.consulting_principles.slice(0, 3).map((principle, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-white text-orange-700 text-xs font-medium rounded-full border border-orange-200"
            >
              {principle}
            </span>
          ))}
          {verse.consulting_principles.length > 3 && (
            <span className="px-3 py-1 bg-white text-gray-500 text-xs font-medium rounded-full border border-gray-200">
              +{verse.consulting_principles.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

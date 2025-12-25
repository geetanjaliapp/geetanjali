import { Link } from "react-router-dom";
import { formatSanskritLines } from "../lib/sanskritFormatter";
import type { Verse } from "../types";

interface FeaturedVerseProps {
  verse: Verse | null;
  loading?: boolean;
  error?: boolean;
}

export function FeaturedVerse({
  verse,
  loading = false,
  error = false,
}: FeaturedVerseProps) {
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-linear-to-br from-amber-50 via-orange-50 to-red-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 border border-amber-200/50 dark:border-gray-700 shadow-xl">
          <div className="text-center space-y-4">
            <div className="h-6 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse w-20 sm:w-24 mx-auto" />
            <div className="h-24 sm:h-32 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-linear-to-br from-amber-50 via-orange-50 to-red-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 border border-amber-200/50 dark:border-gray-700 shadow-lg">
          <div className="text-center space-y-3">
            <div className="text-3xl text-amber-400/50 dark:text-amber-500/40">
              ॐ
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Unable to load today's verse
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!verse) {
    return null;
  }

  const verseRef = `${verse.chapter}.${verse.verse}`;
  const sanskritLines = formatSanskritLines(verse.sanskrit_devanagari || "", {
    mode: "compact",
  });

  return (
    <Link
      to={`/verses/${verse.canonical_id}`}
      className="block max-w-4xl mx-auto"
    >
      {/* Main Featured Verse Container - Clickable */}
      <div className="bg-linear-to-br from-amber-50 via-orange-50 to-red-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 border border-amber-200/50 dark:border-gray-700 shadow-xl hover:shadow-2xl hover:border-amber-300 dark:hover:border-gray-600 transition-all cursor-pointer">
        {/* Sanskrit Devanagari - Spotlight */}
        {verse.sanskrit_devanagari && (
          <div className="text-center mb-4 sm:mb-6 lg:mb-8">
            <div className="text-3xl sm:text-4xl text-amber-400/50 dark:text-amber-500/40 mb-3 sm:mb-4 lg:mb-6 font-light">
              ॐ
            </div>
            <div
              lang="sa"
              className="text-lg sm:text-2xl lg:text-3xl font-sanskrit text-amber-900 dark:text-amber-200 leading-relaxed tracking-wide mb-3 sm:mb-4 lg:mb-6 space-y-1"
            >
              {sanskritLines.map((line, idx) => (
                <p key={idx} className="mb-0">
                  {line}
                </p>
              ))}
            </div>
            <span className="text-amber-700/70 dark:text-amber-400/70 font-serif text-lg">
              ॥ {verseRef} ॥
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default FeaturedVerse;

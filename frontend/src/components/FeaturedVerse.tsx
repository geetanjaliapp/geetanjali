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
        <div className="bg-[var(--surface-warm)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 lg:p-12 border border-[var(--border-warm)] shadow-[var(--shadow-modal)]">
          <div className="text-center space-y-4">
            <div className="h-6 sm:h-8 bg-[var(--surface-muted)] rounded-[var(--radius-skeleton)] animate-pulse w-20 sm:w-24 mx-auto" />
            <div className="h-24 sm:h-32 bg-[var(--surface-muted)] rounded-[var(--radius-skeleton)] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-[var(--surface-warm)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 lg:p-12 border border-[var(--border-warm)] shadow-[var(--shadow-card-elevated)]">
          <div className="text-center space-y-3">
            <div className="text-3xl text-[var(--badge-warm-text)]/50">
              ॐ
            </div>
            <p className="text-[var(--text-tertiary)] text-sm">
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
      <div className="bg-[var(--surface-warm)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 lg:p-12 border border-[var(--border-warm)] shadow-[var(--shadow-modal)] hover:shadow-[var(--shadow-modal)] hover:border-[var(--border-warm-hover)] transition-[var(--transition-card)] cursor-pointer">
        {/* Sanskrit Devanagari - Spotlight */}
        {verse.sanskrit_devanagari && (
          <div className="text-center mb-4 sm:mb-6 lg:mb-8">
            <div className="text-3xl sm:text-4xl text-[var(--badge-warm-text)]/50 mb-3 sm:mb-4 lg:mb-6 font-light">
              ॐ
            </div>
            <div
              lang="sa"
              className="text-lg sm:text-2xl lg:text-3xl font-sanskrit text-[var(--text-primary)] leading-relaxed tracking-wide mb-3 sm:mb-4 lg:mb-6 space-y-1"
            >
              {sanskritLines.map((line, idx) => (
                <p key={idx} className="mb-0">
                  {line}
                </p>
              ))}
            </div>
            <span className="text-[var(--badge-warm-text)]/70 font-serif text-lg">
              ॥ {verseRef} ॥
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default FeaturedVerse;

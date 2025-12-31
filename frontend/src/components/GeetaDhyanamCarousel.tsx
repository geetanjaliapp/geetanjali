/**
 * GeetaDhyanamCarousel - Horizontal scroll carousel for 9 sacred invocation verses
 *
 * Design principles (from docs/design.md):
 * - Quiet Library: Collapsed by default, no auto-play, user-initiated
 * - Content-Forward: Sanskrit is hero, translations in collapsibles
 * - Mobile-First: CSS scroll-snap, 44×44px touch targets
 * - Token-based: No hardcoded colors
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { GeetaDhyanamVerse } from "../types";

interface GeetaDhyanamCarouselProps {
  verses: GeetaDhyanamVerse[];
  isLoading?: boolean;
}

/**
 * Individual verse card within the carousel
 */
function DhyanamVerseCard({
  verse,
  isActive,
}: {
  verse: GeetaDhyanamVerse;
  isActive: boolean;
}) {
  const [showEnglish, setShowEnglish] = useState(false);
  const [showHindi, setShowHindi] = useState(false);

  return (
    <div
      className={`
        shrink-0 w-[280px] sm:w-[320px] snap-center
        bg-[var(--surface-warm-subtle)] rounded-[var(--radius-card)]
        border border-[var(--border-warm-subtle)]
        p-4 sm:p-5
        transition-all duration-200
        ${isActive ? "shadow-[var(--shadow-card)]" : "opacity-80"}
      `}
    >
      {/* Verse number badge */}
      <div className="text-center mb-3">
        <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-widest">
          Verse {verse.verse_number} of 9
        </span>
      </div>

      {/* Sanskrit text - hero */}
      <div
        lang="sa"
        className="text-base sm:text-lg font-sanskrit text-[var(--text-sanskrit)] leading-relaxed text-center mb-3"
      >
        {verse.sanskrit.split("\n").map((line, idx) => (
          <p key={idx} className="mb-1">
            {line}
          </p>
        ))}
      </div>

      {/* IAST transliteration */}
      <div className="text-xs sm:text-sm text-[var(--text-tertiary)] italic text-center mb-3 leading-relaxed">
        {verse.iast.split("\n").slice(0, 2).join(" ")}
        {verse.iast.split("\n").length > 2 && "..."}
      </div>

      {/* Theme */}
      <div className="text-center mb-3">
        <span className="px-2.5 py-0.5 bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] text-xs rounded-[var(--radius-chip)]">
          {verse.theme}
        </span>
      </div>

      {/* Collapsible translations */}
      <div className="space-y-2">
        {/* English toggle */}
        <button
          onClick={() => setShowEnglish(!showEnglish)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-button)] bg-[var(--surface-elevated-translucent-subtle)] border border-[var(--border-warm-subtle)] text-sm text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-expanded={showEnglish}
        >
          <span>English</span>
          <span
            className={`transform transition-transform ${showEnglish ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </button>
        {showEnglish && (
          <div className="px-3 py-2 bg-[var(--surface-elevated-translucent-subtle)] rounded-[var(--radius-button)] text-sm text-[var(--text-primary)] leading-relaxed">
            {verse.english}
          </div>
        )}

        {/* Hindi toggle */}
        <button
          onClick={() => setShowHindi(!showHindi)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-button)] bg-[var(--surface-elevated-translucent-subtle)] border border-[var(--border-warm-subtle)] text-sm text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-expanded={showHindi}
        >
          <span>हिंदी</span>
          <span
            className={`transform transition-transform ${showHindi ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </button>
        {showHindi && (
          <div
            lang="hi"
            className="px-3 py-2 bg-[var(--surface-elevated-translucent-subtle)] rounded-[var(--radius-button)] text-sm text-[var(--text-primary)] leading-relaxed"
          >
            {verse.hindi}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for a single verse card
 */
function DhyanamCardSkeleton() {
  return (
    <div className="shrink-0 w-[280px] sm:w-[320px] snap-center bg-[var(--surface-warm-subtle)] rounded-[var(--radius-card)] border border-[var(--border-warm-subtle)] p-4 sm:p-5 animate-pulse">
      <div className="flex justify-center mb-3">
        <div className="h-3 w-16 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 w-full bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)]" />
        <div className="h-4 w-5/6 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] mx-auto" />
        <div className="h-4 w-4/5 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] mx-auto" />
      </div>
      <div className="flex justify-center mb-3">
        <div className="h-5 w-32 bg-[var(--skeleton-bg)] rounded-[var(--radius-chip)]" />
      </div>
      <div className="space-y-2">
        <div className="h-10 w-full bg-[var(--skeleton-bg)] rounded-[var(--radius-button)]" />
        <div className="h-10 w-full bg-[var(--skeleton-bg)] rounded-[var(--radius-button)]" />
      </div>
    </div>
  );
}

/**
 * Main carousel component
 */
export function GeetaDhyanamCarousel({
  verses,
  isLoading = false,
}: GeetaDhyanamCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle scroll to update active index (Intersection Observer)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || isLoading) return;

    const cards = container.querySelectorAll("[data-verse-index]");
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const index = parseInt(
              (entry.target as HTMLElement).dataset.verseIndex || "0",
              10,
            );
            setActiveIndex(index);
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      },
    );

    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [verses, isLoading]);

  // Scroll to specific verse on dot click
  const scrollToVerse = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;

    const cards = container.querySelectorAll("[data-verse-index]");
    const card = cards[index] as HTMLElement;
    if (card) {
      card.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Carousel skeleton */}
        <div className="overflow-x-auto scrollbar-hidden">
          <div className="flex gap-3 px-4">
            <DhyanamCardSkeleton />
            <DhyanamCardSkeleton />
          </div>
        </div>
        {/* Dots skeleton */}
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--skeleton-bg)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!verses || verses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Horizontal scroll container with snap */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hidden scroll-smooth snap-x snap-mandatory"
        style={{ scrollPaddingInline: "1rem" }}
      >
        <div className="flex gap-3 px-4">
          {verses.map((verse, index) => (
            <div key={verse.verse_number} data-verse-index={index}>
              <DhyanamVerseCard
                verse={verse}
                isActive={index === activeIndex}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5" role="tablist">
        {verses.map((verse, index) => (
          <button
            key={verse.verse_number}
            onClick={() => scrollToVerse(index)}
            className={`
              w-2 h-2 rounded-full transition-all duration-200
              focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]
              ${
                index === activeIndex
                  ? "bg-[var(--interactive-primary)] w-4"
                  : "bg-[var(--border-warm)] hover:bg-[var(--border-warm-hover)]"
              }
            `}
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Go to verse ${verse.verse_number}`}
          />
        ))}
      </div>

      {/* Scroll hint for mobile */}
      <div className="sm:hidden text-center text-xs text-[var(--text-accent-muted)]">
        ← swipe to explore →
      </div>
    </div>
  );
}

export default GeetaDhyanamCarousel;

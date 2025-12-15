import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { versesApi } from "../lib/api";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { PRINCIPLE_TAXONOMY } from "../constants/principles";
import { getTranslatorPriority } from "../constants/translators";
import type { Verse, Translation } from "../types";
import {
  Navbar,
  ContentNotFound,
  Footer,
  ChapterContextBar,
  StickyBottomNav,
  FloatingNavArrow,
} from "../components";
import { errorMessages } from "../lib/errorMessages";
import { useSEO, useAdjacentVerses } from "../hooks";

// Sort translations by priority
function sortTranslations(translations: Translation[]): Translation[] {
  return [...translations].sort((a, b) => {
    const priorityA = getTranslatorPriority(a.translator);
    const priorityB = getTranslatorPriority(b.translator);
    return priorityA - priorityB;
  });
}

export default function VerseDetail() {
  const { canonicalId } = useParams<{ canonicalId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check navigation context - hide prev/next nav when coming from search or reading mode
  const fromContext = searchParams.get("from");
  const isFromReadingMode = fromContext === "read";
  const isFromSearch = fromContext === "search";
  const hideVerseNavigation = isFromReadingMode || isFromSearch;

  // Get back navigation path based on context
  const getBackPath = (): string | null => {
    if (isFromSearch) {
      return "/search";
    }
    if (isFromReadingMode) {
      return "/read";
    }
    return null;
  };

  const backPath = getBackPath();
  const backLabel = isFromSearch ? "Back to Search" : isFromReadingMode ? "Back to Reading" : null;

  const [verse, setVerse] = useState<Verse | null>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTranslations, setShowAllTranslations] = useState(false);

  // Redirect to canonical uppercase URL if case doesn't match
  const canonicalUppercase = canonicalId?.toUpperCase();
  useEffect(() => {
    if (canonicalId && canonicalId !== canonicalUppercase) {
      navigate(`/verses/${canonicalUppercase}`, { replace: true });
    }
  }, [canonicalId, canonicalUppercase, navigate]);

  // Dynamic SEO based on verse data
  useSEO({
    title: verse ? `Bhagavad Geeta ${verse.chapter}.${verse.verse}` : "Verse",
    description: verse?.paraphrase_en
      ? `${verse.paraphrase_en.slice(0, 150)}...`
      : "Explore this verse from the Bhagavad Geeta with multiple translations and leadership insights.",
    canonical: canonicalUppercase ? `/verses/${canonicalUppercase}` : "/verses",
    ogType: "article",
  });

  useEffect(() => {
    if (!canonicalId || canonicalId !== canonicalUppercase) return;

    const loadVerseDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load verse and translations in parallel
        const [verseData, translationsData] = await Promise.all([
          versesApi.get(canonicalId),
          versesApi.getTranslations(canonicalId).catch(() => []),
        ]);

        setVerse(verseData);
        setTranslations(sortTranslations(translationsData));

        // Smooth scroll to top when navigating between verses
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        setError(errorMessages.verseLoad(err));
      } finally {
        setLoading(false);
      }
    };

    loadVerseDetails();
  }, [canonicalId, canonicalUppercase]);

  // Fetch adjacent verses for navigation preview
  // Hook must be called unconditionally, but will only fetch when verse is loaded
  const { prevVerse, nextVerse } = useAdjacentVerses(
    verse?.chapter ?? 0,
    verse?.verse ?? 0
  );

  // Keyboard navigation for desktop (disabled when coming from search or reading mode)
  useEffect(() => {
    // Skip keyboard nav if user came from search or reading mode
    if (hideVerseNavigation) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && prevVerse) {
        event.preventDefault();
        navigate(`/verses/${prevVerse.canonical_id}`);
      } else if (event.key === "ArrowRight" && nextVerse) {
        event.preventDefault();
        navigate(`/verses/${nextVerse.canonical_id}`);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, prevVerse, nextVerse, hideVerseNavigation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 py-4 sm:py-6 lg:py-8">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
            {/* Skeleton: Chapter Context Bar */}
            <div className="flex items-center gap-3 mb-4 sm:mb-6 bg-white/80 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="w-8 h-8 bg-amber-200/50 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-amber-200/50 rounded w-32 mb-2 animate-pulse" />
                <div className="h-2 bg-amber-200/50 rounded w-full animate-pulse" />
              </div>
              <div className="h-4 bg-amber-200/50 rounded w-16 animate-pulse" />
            </div>

            {/* Skeleton: Main Spotlight Section */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-xl sm:shadow-2xl p-4 sm:p-8 lg:p-12 mb-4 sm:mb-6 lg:mb-8 border border-amber-200/50">
              {/* Sanskrit Skeleton */}
              <div className="mb-4 sm:mb-6 lg:mb-8 text-center pt-2 sm:pt-4">
                <div className="w-8 h-8 bg-amber-200/40 rounded-full mx-auto mb-4 animate-pulse" />
                <div className="space-y-3 max-w-xl mx-auto">
                  <div className="h-8 bg-amber-200/40 rounded animate-pulse" />
                  <div className="h-8 bg-amber-200/40 rounded animate-pulse w-4/5 mx-auto" />
                  <div className="h-8 bg-amber-200/40 rounded animate-pulse w-3/4 mx-auto" />
                </div>
                <div className="h-4 bg-amber-200/40 rounded w-20 mx-auto mt-4 animate-pulse" />
              </div>

              {/* Leadership Insight Skeleton */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-amber-100/50 mb-4 sm:mb-6 lg:mb-8">
                <div className="h-3 bg-red-200/40 rounded w-32 mb-4 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200/60 rounded animate-pulse" />
                  <div className="h-5 bg-gray-200/60 rounded animate-pulse w-5/6" />
                  <div className="h-5 bg-gray-200/60 rounded animate-pulse w-4/5" />
                </div>
              </div>

              {/* Principles Skeleton */}
              <div className="mb-4 sm:mb-6 lg:mb-8">
                <div className="h-3 bg-amber-200/40 rounded w-40 mb-4 animate-pulse" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-8 bg-amber-200/40 rounded-full w-28 animate-pulse" />
                  <div className="h-8 bg-amber-200/40 rounded-full w-32 animate-pulse" />
                  <div className="h-8 bg-amber-200/40 rounded-full w-24 animate-pulse" />
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 sm:my-6 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />

              {/* Translations Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                <div>
                  <div className="h-3 bg-amber-200/40 rounded w-24 mb-4 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200/50 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200/50 rounded animate-pulse w-5/6" />
                  </div>
                </div>
                <div>
                  <div className="h-3 bg-amber-200/40 rounded w-28 mb-4 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200/50 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200/50 rounded animate-pulse w-4/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !verse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <ContentNotFound variant="verse" />
        </div>
      </div>
    );
  }

  // Separate Hindi and English translations
  const hindiTranslations = translations.filter(
    (t) => t.language === "hindi" || t.translator === "Swami Tejomayananda",
  );
  const englishTranslations = translations.filter(
    (t) =>
      t.language === "en" ||
      t.language === "english" ||
      (t.language && !t.language.includes("hindi")),
  );
  const primaryHindi = hindiTranslations[0];
  const primaryEnglish =
    englishTranslations.find((t) => t.translator === "Swami Gambirananda") ||
    englishTranslations[0];

  // Filter out primary translations for "More Translations" section
  const otherTranslations = translations.filter(
    (t) => t.id !== primaryHindi?.id && t.id !== primaryEnglish?.id
  );

  // Determine if at boundaries of Geeta
  const isAtStart = verse.chapter === 1 && verse.verse === 1;
  const isAtEnd = verse.chapter === 18 && verse.verse === 78;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />

      {/* Desktop Floating Navigation Arrows (hidden when coming from search or reading mode) */}
      {!hideVerseNavigation && (
        <>
          <FloatingNavArrow
            direction="prev"
            verse={prevVerse}
            isAtBoundary={isAtStart}
          />
          <FloatingNavArrow
            direction="next"
            verse={nextVerse}
            isAtBoundary={isAtEnd}
          />
        </>
      )}

      <div className="flex-1 py-4 sm:py-6 lg:py-8">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
          {/* Contextual Back Button (when coming from search or reading mode) */}
          {backPath && backLabel && (
            <div className="mb-3 sm:mb-4">
              <Link
                to={backPath}
                className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium transition-colors group"
              >
                <svg
                  className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {backLabel}
              </Link>
            </div>
          )}

          {/* Chapter Context Bar */}
          <ChapterContextBar chapter={verse.chapter} verse={verse.verse} />

          {/* Main Spotlight Section */}
          <div className="animate-fade-in bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-xl sm:shadow-2xl p-4 sm:p-8 lg:p-12 mb-4 sm:mb-6 lg:mb-8 border border-amber-200/50">
            {/* Sanskrit Spotlight */}
            {verse.sanskrit_devanagari && (
              <div className="mb-4 sm:mb-6 lg:mb-8 text-center pt-2 sm:pt-4">
                <div className="text-3xl sm:text-4xl text-amber-400/50 mb-3 sm:mb-4 lg:mb-6 font-light">
                  ॐ
                </div>
                <div lang="sa" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif text-amber-900/70 leading-relaxed tracking-wide mb-3 sm:mb-4 lg:mb-6">
                  {formatSanskritLines(verse.sanskrit_devanagari).map(
                    (line, idx) => (
                      <p
                        key={idx}
                        className={`${isSpeakerIntro(line) ? "text-lg sm:text-xl lg:text-2xl text-amber-700/60 mb-2 sm:mb-4" : "mb-1 sm:mb-2"}`}
                      >
                        {line}
                      </p>
                    ),
                  )}
                </div>
                <div className="text-amber-600/70 text-base sm:text-lg font-serif">
                  ॥ {verse.chapter}.{verse.verse} ॥
                </div>
              </div>
            )}

            {/* Leadership Insight - Prominent */}
            {verse.paraphrase_en && (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-amber-100/50 mb-4 sm:mb-6 lg:mb-8">
                <p className="text-xs font-semibold text-red-700/70 uppercase tracking-widest mb-2 sm:mb-4">
                  Leadership Insight
                </p>
                <p className="text-base sm:text-lg md:text-xl text-gray-800 leading-relaxed italic">
                  "{verse.paraphrase_en}"
                </p>
              </div>
            )}

            {/* Consulting Principles - Horizontal Scrollable Pills */}
            {verse.consulting_principles &&
              verse.consulting_principles.length > 0 && (
                <div className="mb-4 sm:mb-6 lg:mb-8">
                  <p className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-3 sm:mb-4">
                    Consulting Principles
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {verse.consulting_principles.map((principleId) => {
                      const principle =
                        PRINCIPLE_TAXONOMY[
                          principleId as keyof typeof PRINCIPLE_TAXONOMY
                        ];
                      return (
                        <Link
                          key={principleId}
                          to={`/verses?topic=${principleId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2
                                     bg-amber-100 text-amber-800 rounded-full text-sm sm:text-base
                                     font-medium shadow-sm
                                     hover:bg-amber-200 hover:shadow-md
                                     active:bg-amber-300
                                     transition-all duration-150
                                     focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                                     focus-visible:ring-offset-2"
                          aria-label={`View all verses about ${principle?.label || principleId}`}
                        >
                          <span>{principle?.shortLabel || principleId}</span>
                          <span aria-hidden="true" className="text-amber-600">→</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Divider */}
            <div className="my-4 sm:my-6 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />

            {/* Translations - Side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              {/* Hindi Translation */}
              {primaryHindi && (
                <div>
                  <p className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-2 sm:mb-4">
                    हिंदी अनुवाद
                  </p>
                  <p className="text-base sm:text-lg text-gray-800 leading-relaxed italic">
                    "{primaryHindi.text}"
                  </p>
                  {primaryHindi.translator && (
                    <p className="text-sm text-gray-600 mt-2 sm:mt-4">
                      — {primaryHindi.translator}
                    </p>
                  )}
                </div>
              )}

              {/* English Translation */}
              {primaryEnglish && (
                <div>
                  <p className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-2 sm:mb-4">
                    English Translation
                  </p>
                  <p className="text-base sm:text-lg text-gray-800 leading-relaxed italic">
                    "{primaryEnglish.text}"
                  </p>
                  {primaryEnglish.translator && (
                    <p className="text-sm text-gray-600 mt-2 sm:mt-4">
                      — {primaryEnglish.translator}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* More Translations Section - Toggle Switch */}
          {otherTranslations.length > 0 && (
            <div className="animate-fade-in bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  More Translations
                </h2>
                <button
                  onClick={() => setShowAllTranslations(!showAllTranslations)}
                  aria-label={showAllTranslations ? "Hide more translations" : "Show more translations"}
                  aria-pressed={showAllTranslations}
                  className={`relative inline-flex h-7 sm:h-8 w-12 sm:w-14 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                    showAllTranslations ? "bg-amber-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 sm:h-6 w-5 sm:w-6 transform rounded-full bg-white transition-transform ${
                      showAllTranslations
                        ? "translate-x-6 sm:translate-x-7"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {showAllTranslations && (
                <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-in fade-in duration-200">
                  {otherTranslations.map((translation, index) => (
                    <div key={translation.id}>
                      <div className="border-l-4 border-amber-300 pl-4 sm:pl-6 py-2 sm:py-3">
                        <p className="text-base sm:text-lg text-gray-800 leading-relaxed mb-2 sm:mb-3">
                          "{translation.text}"
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
                          {translation.translator && (
                            <span className="font-medium">
                              — {translation.translator}
                            </span>
                          )}
                          {translation.school && (
                            <span>{translation.school}</span>
                          )}
                        </div>
                      </div>
                      {index < otherTranslations.length - 1 && (
                        <div className="mt-4 sm:mt-6 border-b border-gray-100" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Bottom padding for sticky nav on mobile */}
      <div className="h-16 sm:hidden" />

      {/* Mobile Sticky Bottom Navigation (hidden when coming from search or reading mode) */}
      {!hideVerseNavigation && (
        <StickyBottomNav
          prevVerse={prevVerse}
          nextVerse={nextVerse}
          currentChapter={verse.chapter}
          currentVerse={verse.verse}
        />
      )}
    </div>
  );
}

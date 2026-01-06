import { useState, useEffect, useCallback } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import { versesApi } from "../lib/api";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { formatChapterVerse } from "../lib/verseLinker";
import { prepareHindiTTS, prepareEnglishTTS } from "../lib/ttsPreprocess";
import {
  getPrincipleShortLabel,
  getPrincipleLabel,
} from "../constants/principles";
import { getTranslatorPriority } from "../constants/translators";
import type { Verse, Translation, FontSize } from "../types";
import {
  Navbar,
  ContentNotFound,
  Footer,
  ChapterContextBar,
  StickyBottomNav,
  FloatingNavArrow,
  SpeakButton,
} from "../components";
import {
  HeartIcon,
  ShareIcon,
  ChevronDownIcon,
  PlayIcon,
  PauseIcon,
  SpinnerIcon,
  CloseIcon,
  RepeatIcon,
  CheckIcon,
  AlertCircleIcon,
} from "../components/icons";
import { ShareModal } from "../components/verse";
import {
  useAudioPlayer,
  AudioProgress,
  AudioSpeedControl,
  StudyModePlayer,
} from "../components/audio";
import { errorMessages } from "../lib/errorMessages";
import { truncateForSEO } from "../lib/truncate";
import { normalizeFontSize } from "../lib/preferencesStorage";
import { useSEO, useAdjacentVerses, useFavoritesPrefs, type StudySection } from "../hooks";
import { STORAGE_KEYS, getStorageItem, setStorageItem } from "../lib/storage";

/** Line height scales with font size for readability (synced with VerseFocus) */
const LINE_HEIGHT_CLASSES: Record<FontSize, string> = {
  small: "leading-snug", // 1.375 - compact
  regular: "leading-relaxed", // 1.625 - matches VerseFocus regular
  large: "leading-loose", // 2.0 - matches VerseFocus large
};

interface SectionPrefs {
  iast: boolean;
  insight: boolean;
  translations: boolean;
}

const DEFAULT_SECTION_PREFS: SectionPrefs = {
  iast: true,
  insight: true,
  translations: true,
};

// Show nudge after this many views
const NUDGE_THRESHOLD = 3;

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

  // Navigation is only enabled when browsing from the verse browser
  // Default: clean view (no nav) - user came to see one verse and will use browser back
  // With ?from=browse: full nav - user is sequentially browsing verses
  const fromContext = searchParams.get("from");
  const showVerseNavigation = fromContext === "browse";

  const [verse, setVerse] = useState<Verse | null>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTranslations, setShowAllTranslations] = useState(false);
  const [showNewsletterNudge, setShowNewsletterNudge] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(() =>
    normalizeFontSize(getStorageItem<unknown>(STORAGE_KEYS.verseDetailFontSize, "regular")),
  );

  // Toggle font size and persist preference
  const toggleFontSize = () => {
    const newSize = fontSize === "regular" ? "large" : "regular";
    setFontSize(newSize);
    setStorageItem(STORAGE_KEYS.verseDetailFontSize, newSize);
  };

  // Reset font size to default
  const resetFontSize = () => {
    setFontSize("regular");
    setStorageItem(STORAGE_KEYS.verseDetailFontSize, "regular");
  };

  // Section visibility preferences
  const [sectionPrefs, setSectionPrefs] = useState<SectionPrefs>(() =>
    getStorageItem<SectionPrefs>(
      STORAGE_KEYS.verseDetailSectionPrefs,
      DEFAULT_SECTION_PREFS,
    ),
  );

  // Toggle a section and persist
  const toggleSection = (section: keyof SectionPrefs) => {
    const newPrefs = { ...sectionPrefs, [section]: !sectionPrefs[section] };
    setSectionPrefs(newPrefs);
    setStorageItem(STORAGE_KEYS.verseDetailSectionPrefs, newPrefs);
  };

  // Expand corresponding UI section when Study Mode plays a section
  const handleStudySectionChange = useCallback(
    (section: StudySection | null) => {
      if (!section) return;

      // Map study sections to UI sections
      const sectionMap: Partial<Record<StudySection, keyof SectionPrefs>> = {
        english: "translations",
        hindi: "translations",
        insight: "insight",
        // sanskrit: no UI section to expand (always visible)
      };

      const uiSection = sectionMap[section];
      if (uiSection && !sectionPrefs[uiSection]) {
        // Expand the section if not already expanded
        const newPrefs = { ...sectionPrefs, [uiSection]: true };
        setSectionPrefs(newPrefs);
        setStorageItem(STORAGE_KEYS.verseDetailSectionPrefs, newPrefs);
      }
    },
    [sectionPrefs]
  );

  // Favorites (synced across devices for logged-in users)
  const { isFavorite, toggleFavorite } = useFavoritesPrefs();

  // Audio player
  const {
    state: audioState,
    play,
    pause,
    resume,
    stop,
    retry,
    isPlaying,
    currentlyPlaying,
    progress,
    currentTime,
    duration,
    error: audioError,
    playbackSpeed,
    isLooping,
    seek,
    setPlaybackSpeed,
    toggleLoop,
  } = useAudioPlayer();

  // Check if this verse is currently active (playing or paused)
  const isThisVerseActive = verse
    ? currentlyPlaying === verse.canonical_id
    : false;

  // Auto-dismiss timing for audio controls (matches AudioPlayerContext)
  const AUTO_DISMISS_DELAY_MS = 1500;
  const [showAudioControls, setShowAudioControls] = useState(false);

  useEffect(() => {
    if (!isThisVerseActive) {
      setShowAudioControls(false);
      return;
    }

    if (audioState === "playing" || audioState === "loading") {
      setShowAudioControls(true);
    } else if (audioState === "paused") {
      // Keep controls visible while paused
      setShowAudioControls(true);
    } else if (audioState === "completed" || audioState === "error") {
      // Auto-hide after 1.5s on completion or error (matches VerseCard pattern)
      setShowAudioControls(true);
      const timer = setTimeout(() => {
        setShowAudioControls(false);
      }, AUTO_DISMISS_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      // idle - hide controls
      setShowAudioControls(false);
    }
  }, [isThisVerseActive, audioState]);

  // Redirect to canonical uppercase URL if case doesn't match
  const canonicalUppercase = canonicalId?.toUpperCase();
  useEffect(() => {
    if (canonicalId && canonicalId !== canonicalUppercase) {
      navigate(`/verses/${canonicalUppercase}`, { replace: true });
    }
  }, [canonicalId, canonicalUppercase, navigate]);

  // Track unique verse views for newsletter nudge
  useEffect(() => {
    if (!canonicalId) return;

    try {
      // Don't show nudge if user is subscribed
      const isSubscribed =
        localStorage.getItem(STORAGE_KEYS.newsletterSubscribed) === "true";
      if (isSubscribed) {
        setShowNewsletterNudge(false);
        return;
      }

      // Track unique verses viewed (prevents double-counting when revisiting)
      const seenJson =
        sessionStorage.getItem(STORAGE_KEYS.verseViewCount) || "[]";
      const seenVerses: string[] = JSON.parse(seenJson);

      // Add to seen list if new
      if (!seenVerses.includes(canonicalId)) {
        seenVerses.push(canonicalId);
        sessionStorage.setItem(
          STORAGE_KEYS.verseViewCount,
          JSON.stringify(seenVerses),
        );
      }

      // Show nudge after threshold unique verses
      setShowNewsletterNudge(seenVerses.length >= NUDGE_THRESHOLD);
    } catch {
      // Ignore storage errors
    }
  }, [canonicalId]);

  // Dynamic SEO based on verse data
  useSEO({
    title: verse ? `Bhagavad Geeta ${verse.chapter}.${verse.verse}` : "Verse",
    description: verse?.paraphrase_en
      ? truncateForSEO(verse.paraphrase_en)
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
    verse?.verse ?? 0,
  );

  // Keyboard navigation for desktop (only when browsing)
  useEffect(() => {
    // Skip keyboard nav if not in browse mode
    if (!showVerseNavigation) return;

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
        navigate(`/verses/${prevVerse.canonical_id}?from=browse`);
      } else if (event.key === "ArrowRight" && nextVerse) {
        event.preventDefault();
        navigate(`/verses/${nextVerse.canonical_id}?from=browse`);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, prevVerse, nextVerse, showVerseNavigation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface-page)] flex flex-col">
        <Navbar />
        <div className="flex-1 py-4 sm:py-6 lg:py-8">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
            {/* Skeleton: Chapter Context Bar */}
            <div className="flex items-center gap-3 mb-4 sm:mb-6 bg-[var(--surface-elevated)] rounded-[var(--radius-button)] sm:rounded-[var(--radius-card)] p-3 sm:p-4 shadow-[var(--shadow-button)]">
              <div className="w-8 h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-avatar)] animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-32 mb-2 animate-pulse" />
                <div className="h-2 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-full animate-pulse" />
              </div>
              <div className="h-4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-16 animate-pulse" />
            </div>

            {/* Skeleton: Main Spotlight Section */}
            <div className="bg-linear-to-br from-[var(--gradient-warm-from)] via-[var(--gradient-warm-via)] to-[var(--gradient-warm-to)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] lg:rounded-[var(--radius-modal)] shadow-[var(--shadow-card-elevated)] sm:shadow-[var(--shadow-modal)] p-4 sm:p-8 lg:p-12 mb-4 sm:mb-6 lg:mb-8 border border-[var(--border-warm-subtle)]">
              {/* Sanskrit Skeleton */}
              <div className="mb-4 sm:mb-6 lg:mb-8 text-center pt-2 sm:pt-4">
                <div className="w-8 h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-avatar)] mx-auto mb-4 animate-pulse" />
                <div className="space-y-3 max-w-xl mx-auto">
                  <div className="h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse" />
                  <div className="h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse w-4/5 mx-auto" />
                  <div className="h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse w-3/4 mx-auto" />
                </div>
                <div className="h-4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-20 mx-auto mt-4 animate-pulse" />
              </div>

              {/* Leadership Insight Skeleton */}
              <div className="bg-[var(--surface-elevated-translucent-subtle)] backdrop-blur-xs rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-4 sm:p-6 lg:p-8 border border-[var(--border-warm-subtle)] mb-4 sm:mb-6 lg:mb-8">
                <div className="h-3 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-32 mb-4 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse" />
                  <div className="h-5 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse w-5/6" />
                  <div className="h-5 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse w-4/5" />
                </div>
              </div>

              {/* Principles Skeleton */}
              <div className="mb-4 sm:mb-6 lg:mb-8">
                <div className="h-3 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-40 mb-4 animate-pulse" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-chip)] w-28 animate-pulse" />
                  <div className="h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-chip)] w-32 animate-pulse" />
                  <div className="h-8 bg-[var(--skeleton-bg)] rounded-[var(--radius-chip)] w-24 animate-pulse" />
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 sm:my-6 h-px bg-linear-to-r from-transparent via-[var(--border-warm)] to-transparent" />

              {/* Translations Skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                <div>
                  <div className="h-3 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-24 mb-4 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse" />
                    <div className="h-4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse w-5/6" />
                  </div>
                </div>
                <div>
                  <div className="h-3 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] w-28 mb-4 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse" />
                    <div className="h-4 bg-[var(--skeleton-bg)] rounded-[var(--radius-skeleton)] animate-pulse w-4/5" />
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
      <div className="min-h-screen bg-[var(--surface-page)] flex flex-col">
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
    (t) => t.id !== primaryHindi?.id && t.id !== primaryEnglish?.id,
  );

  // Determine if at boundaries of Geeta
  const isAtStart = verse.chapter === 1 && verse.verse === 1;
  const isAtEnd = verse.chapter === 18 && verse.verse === 78;

  return (
    <div className="min-h-screen bg-[var(--surface-page)] flex flex-col">
      <Navbar />

      {/* Desktop Floating Navigation Arrows (only when browsing) */}
      {showVerseNavigation && (
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
          {/* Chapter Context Bar with font controls */}
          <ChapterContextBar
            chapter={verse.chapter}
            verse={verse.verse}
            fontSize={fontSize}
            onToggleFontSize={toggleFontSize}
            onResetFontSize={resetFontSize}
            isDefaultFontSize={fontSize === "regular"}
            readingModeLink={`/read?c=${verse.chapter}&v=${verse.verse}`}
          />

          {/* Main Spotlight Section */}
          <div className="relative animate-fade-in bg-linear-to-br from-[var(--gradient-warm-from)] via-[var(--gradient-warm-via)] to-[var(--gradient-warm-to)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] lg:rounded-[var(--radius-modal)] shadow-[var(--shadow-card-elevated)] sm:shadow-[var(--shadow-modal)] p-4 sm:p-8 lg:p-12 mb-4 sm:mb-6 lg:mb-8 border border-[var(--border-warm-subtle)]">
            {/* Audio controls - top right corner */}
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                {/* Play button (Sanskrit audio) */}
                {verse.audio_url && (
                <button
                  onClick={() => {
                    if (isThisVerseActive && audioState === "error") {
                      retry();
                    } else if (isThisVerseActive && audioState === "paused") {
                      resume();
                    } else if (isPlaying(verse.canonical_id)) {
                      pause();
                    } else {
                      play(verse.canonical_id, verse.audio_url!);
                    }
                  }}
                  disabled={audioState === "loading" && isThisVerseActive}
                  className={`p-3 sm:p-2 rounded-full transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                    isThisVerseActive && audioState === "error"
                      ? "text-[var(--status-error-text)] bg-[var(--status-error-text)]/10"
                      : isThisVerseActive && audioState === "completed"
                        ? "text-[var(--status-success-text)] bg-[var(--status-success-text)]/10"
                        : isPlaying(verse.canonical_id)
                          ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                          : "text-[var(--text-muted)] hover:text-[var(--interactive-primary)] hover:bg-[var(--surface-muted)]"
                  } ${audioState === "loading" && isThisVerseActive ? "opacity-50" : ""}`}
                  aria-label={
                    isThisVerseActive && audioState === "error"
                      ? "Retry loading audio"
                      : isThisVerseActive && audioState === "completed"
                        ? "Replay recitation"
                        : isPlaying(verse.canonical_id)
                          ? "Pause recitation"
                          : audioState === "loading" && isThisVerseActive
                            ? "Loading..."
                            : "Play recitation"
                  }
                >
                  {audioState === "loading" && isThisVerseActive ? (
                    <SpinnerIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : isThisVerseActive && audioState === "error" ? (
                    <AlertCircleIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : isThisVerseActive && audioState === "completed" ? (
                    <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : isPlaying(verse.canonical_id) ? (
                    <PauseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>
                )}

                {/* Study Mode button */}
                {(verse.audio_url || verse.paraphrase_en || translations.length > 0) && (
                  <StudyModePlayer
                    verse={verse}
                    translations={translations}
                    onSectionChange={handleStudySectionChange}
                  />
                )}
              </div>
              {/* Error message */}
              {isThisVerseActive && audioState === "error" && audioError && (
                <span className="text-xs text-[var(--status-error-text)] bg-[var(--surface-elevated)] px-2 py-1 rounded-[var(--radius-badge)] shadow-sm max-w-32 text-right">
                  {audioError}
                </span>
              )}
            </div>

            {/* Sanskrit Spotlight */}
            {verse.sanskrit_devanagari && (
              <div className="mb-4 sm:mb-6 lg:mb-8 text-center pt-2 sm:pt-4">
                <div className="text-3xl sm:text-4xl text-[var(--decorative-om)] mb-3 sm:mb-4 lg:mb-6 font-light">
                  ॐ
                </div>
                <div
                  lang="sa"
                  className={`font-sanskrit text-[var(--text-sanskrit)] ${LINE_HEIGHT_CLASSES[fontSize]} tracking-wide mb-3 sm:mb-4 lg:mb-6 transition-all duration-200 ${
                    fontSize === "large"
                      ? "text-2xl sm:text-4xl lg:text-5xl"
                      : "text-xl sm:text-3xl lg:text-4xl"
                  }`}
                >
                  {formatSanskritLines(verse.sanskrit_devanagari).map(
                    (line, idx) => (
                      <p
                        key={idx}
                        className={`${
                          isSpeakerIntro(line)
                            ? fontSize === "large"
                              ? "text-xl sm:text-2xl lg:text-3xl text-[var(--text-accent-muted)] mb-2 sm:mb-4"
                              : "text-lg sm:text-xl lg:text-2xl text-[var(--text-accent-muted)] mb-2 sm:mb-4"
                            : "mb-1 sm:mb-2"
                        }`}
                      >
                        {line}
                      </p>
                    ),
                  )}
                </div>
                {/* Verse Reference with integrated actions - clean center alignment */}
                <div className="flex items-center justify-center gap-2 sm:gap-4">
                  {/* Favorite button */}
                  <button
                    onClick={() => toggleFavorite(verse.canonical_id)}
                    className={`p-3 sm:p-1.5 rounded-[var(--radius-avatar)] transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                      isFavorite(verse.canonical_id)
                        ? "text-[var(--status-error-text)]"
                        : "text-[var(--text-accent-muted)] hover:text-[var(--status-error-text)] hover:scale-110"
                    }`}
                    aria-label={
                      isFavorite(verse.canonical_id)
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                  >
                    <HeartIcon
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      filled={isFavorite(verse.canonical_id)}
                    />
                  </button>

                  {/* Verse reference */}
                  <span className="text-[var(--text-accent-muted)] text-base sm:text-lg font-serif">
                    ॥ {formatChapterVerse(verse.chapter, verse.verse)} ॥
                  </span>

                  {/* Share button - opens unified share modal */}
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="p-3 sm:p-1.5 rounded-[var(--radius-avatar)] transition-[var(--transition-all)] text-[var(--text-accent-muted)] hover:text-[var(--text-accent)] hover:scale-110 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
                    aria-label="Share verse"
                  >
                    <ShareIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                {/* Audio controls - shown when audio is playing */}
                {showAudioControls && verse.audio_url && (
                  <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
                    {/* Progress bar */}
                    <div className="flex-1 max-w-[200px]">
                      <AudioProgress
                        progress={progress}
                        currentTime={currentTime}
                        duration={duration}
                        disabled={false}
                        onSeek={seek}
                        showTime
                        compact
                      />
                    </div>

                    {/* Speed control */}
                    <AudioSpeedControl
                      speed={playbackSpeed}
                      onSpeedChange={setPlaybackSpeed}
                      compact
                    />

                    {/* Loop toggle */}
                    <button
                      onClick={toggleLoop}
                      aria-label={isLooping ? "Disable loop" : "Enable loop"}
                      aria-pressed={isLooping}
                      className={`
                        p-2.5 -m-1.5 sm:p-1 sm:m-0 rounded-[var(--radius-badge)] transition-[var(--transition-button)]
                        focus:outline-hidden focus-visible:ring-2
                        focus-visible:ring-[var(--focus-ring)]
                        ${
                          isLooping
                            ? "text-[var(--interactive-primary)] bg-[var(--interactive-primary)]/10"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                        }
                      `}
                    >
                      <RepeatIcon className="w-4 h-4" />
                    </button>

                    {/* Dismiss button */}
                    <button
                      onClick={stop}
                      aria-label="Stop audio"
                      className="p-2.5 -m-1.5 sm:p-1 sm:m-0 rounded-[var(--radius-badge)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-[var(--transition-button)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* IAST Transliteration - Collapsible (fixed size, not affected by font toggle) */}
            {verse.sanskrit_iast && (
              <div className="text-center mb-4 sm:mb-6">
                <button
                  onClick={() => toggleSection("iast")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-accent-muted)] hover:text-[var(--text-accent)] transition-[var(--transition-color)] mb-2"
                  aria-expanded={sectionPrefs.iast}
                >
                  <span>IAST</span>
                  <ChevronDownIcon
                    className={`w-3 h-3 transition-transform duration-200 ${
                      sectionPrefs.iast ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`transition-all duration-200 overflow-hidden ${
                    sectionPrefs.iast
                      ? "max-h-40 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <p
                    lang="sa"
                    className="text-sm sm:text-base text-[var(--text-accent-muted)] italic font-serif leading-relaxed"
                  >
                    {verse.sanskrit_iast}
                  </p>
                </div>
              </div>
            )}

            {/* Leadership Insight - Collapsible */}
            {verse.paraphrase_en && (
              <div className="bg-[var(--surface-elevated-translucent-subtle)] backdrop-blur-xs rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-4 sm:p-6 lg:p-8 border border-[var(--border-warm-subtle)] mb-4 sm:mb-6 lg:mb-8">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleSection("insight")}
                    className="flex-1 flex items-center justify-between text-left group"
                    aria-expanded={sectionPrefs.insight}
                  >
                    <span className="text-xs font-semibold text-[var(--badge-insight-text)] uppercase tracking-widest">
                      Leadership Insight
                    </span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-all duration-200 ${
                        sectionPrefs.insight ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <SpeakButton
                    text={prepareEnglishTTS(
                      verse.paraphrase_en,
                      verse.chapter,
                      verse.verse,
                    )}
                    lang="en"
                    size="sm"
                    className="ml-2"
                    aria-label="Listen to leadership insight"
                  />
                </div>
                <div
                  className={`transition-all duration-200 overflow-hidden ${
                    sectionPrefs.insight
                      ? "max-h-96 opacity-100 mt-2 sm:mt-4"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="text-base sm:text-lg lg:text-xl text-[var(--text-primary)] leading-relaxed italic">
                    "{verse.paraphrase_en}"
                  </p>
                </div>
              </div>
            )}

            {/* Consulting Principles - Horizontal Scrollable Pills */}
            {verse.consulting_principles &&
              verse.consulting_principles.length > 0 && (
                <div className="mb-4 sm:mb-6 lg:mb-8">
                  <p className="text-xs font-semibold text-[var(--text-accent-muted)] uppercase tracking-widest mb-3 sm:mb-4">
                    Consulting Principles
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {verse.consulting_principles.map((principleId) => (
                      <Link
                        key={principleId}
                        to={`/verses?topic=${principleId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2
                                   bg-[var(--badge-principle-bg)] text-[var(--badge-principle-text)] rounded-[var(--radius-chip)] text-sm sm:text-base
                                   font-medium shadow-[var(--shadow-button)]
                                   hover:bg-[var(--badge-warm-hover)] hover:shadow-[var(--shadow-card)]
                                   active:bg-[var(--badge-warm-bg)]
                                   transition-[var(--transition-all)]
                                   focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
                                   focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
                        aria-label={`View all verses about ${getPrincipleLabel(principleId)}`}
                      >
                        <span>{getPrincipleShortLabel(principleId)}</span>
                        <span
                          aria-hidden="true"
                          className="text-[var(--text-accent)]"
                        >
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            {/* Divider */}
            <div className="my-4 sm:my-6 h-px bg-linear-to-r from-transparent via-[var(--border-warm)] to-transparent" />

            {/* Translations - Collapsible */}
            {(primaryHindi || primaryEnglish) && (
              <div>
                <button
                  onClick={() => toggleSection("translations")}
                  className="w-full flex items-center justify-between text-left group mb-4"
                  aria-expanded={sectionPrefs.translations}
                >
                  <span className="text-xs font-semibold text-[var(--text-accent-muted)] uppercase tracking-widest">
                    Translations
                  </span>
                  <ChevronDownIcon
                    className={`w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-accent)] transition-all duration-200 ${
                      sectionPrefs.translations ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`transition-all duration-200 overflow-hidden ${
                    sectionPrefs.translations
                      ? "max-h-[800px] opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                    {/* Hindi Translation */}
                    {primaryHindi && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-accent-muted)] uppercase tracking-widest mb-2 sm:mb-3">
                          हिंदी अनुवाद
                        </p>
                        <p className="text-base sm:text-lg text-[var(--text-primary)] leading-relaxed italic">
                          "{primaryHindi.text}"
                        </p>
                        <div className="flex items-center justify-between mt-2 sm:mt-3">
                          <span className="text-sm text-[var(--text-tertiary)]">
                            {primaryHindi.translator ? `— ${primaryHindi.translator}` : ""}
                          </span>
                          <SpeakButton
                            text={prepareHindiTTS(
                              primaryHindi.text,
                              verse.chapter,
                              verse.verse,
                            )}
                            lang="hi"
                            size="sm"
                            aria-label="हिंदी अनुवाद सुनें"
                          />
                        </div>
                      </div>
                    )}

                    {/* English Translation */}
                    {primaryEnglish && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-accent-muted)] uppercase tracking-widest mb-2 sm:mb-3">
                          English Translation
                        </p>
                        <p className="text-base sm:text-lg text-[var(--text-primary)] leading-relaxed italic">
                          "{primaryEnglish.text}"
                        </p>
                        <div className="flex items-center justify-between mt-2 sm:mt-3">
                          <span className="text-sm text-[var(--text-tertiary)]">
                            {primaryEnglish.translator ? `— ${primaryEnglish.translator}` : ""}
                          </span>
                          <SpeakButton
                            text={prepareEnglishTTS(
                              primaryEnglish.text,
                              verse.chapter,
                              verse.verse,
                            )}
                            lang="en"
                            size="sm"
                            aria-label="Listen to English translation"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* More Translations Section - Collapsible */}
          {otherTranslations.length > 0 && (
            <div
              className="animate-fade-in bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] overflow-hidden mb-4 sm:mb-6 lg:mb-8"
              style={{ animationDelay: "100ms" }}
            >
              {/* Collapsible Header */}
              <button
                onClick={() => setShowAllTranslations(!showAllTranslations)}
                className="w-full flex items-center justify-between p-4 sm:p-6 lg:p-8 text-left hover:bg-[var(--surface-muted)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                aria-expanded={showAllTranslations}
                aria-controls="more-translations-content"
              >
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)]">
                    More Translations
                  </h2>
                  <span className="text-sm text-[var(--text-muted)]">
                    ({otherTranslations.length})
                  </span>
                </div>
                {/* Chevron indicator */}
                <svg
                  className={`w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-muted)] transition-transform duration-200 ${
                    showAllTranslations ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Collapsible Content */}
              <div
                id="more-translations-content"
                className={`transition-all duration-200 ease-in-out ${
                  showAllTranslations
                    ? "max-h-[2000px] opacity-100"
                    : "max-h-0 opacity-0 overflow-hidden"
                }`}
              >
                <div className="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 space-y-4 sm:space-y-6 lg:space-y-8">
                  {otherTranslations.map((translation, index) => (
                    <div key={translation.id}>
                      <div className="border-l-4 border-[var(--border-warm)] pl-4 sm:pl-6 py-2 sm:py-3">
                        <p className="text-base sm:text-lg text-[var(--text-primary)] leading-relaxed mb-2 sm:mb-3">
                          "{translation.text}"
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-[var(--text-tertiary)]">
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
                        <div className="mt-4 sm:mt-6 border-b border-[var(--border-subtle)]" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Newsletter Nudge - shown after 3+ verses viewed */}
          {showNewsletterNudge && (
            <div className="animate-fade-in text-center py-6">
              <p className="text-[var(--text-tertiary)] text-sm">
                Enjoying the wisdom?{" "}
                <Link
                  to="/settings#newsletter"
                  className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] font-medium"
                >
                  Get a verse like this in your inbox each day
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Bottom padding for sticky nav on mobile (only when browsing) */}
      {showVerseNavigation && <div className="h-16 sm:hidden" />}

      {/* Mobile Sticky Bottom Navigation (only when browsing) */}
      {showVerseNavigation && (
        <StickyBottomNav
          prevVerse={prevVerse}
          nextVerse={nextVerse}
          currentChapter={verse.chapter}
          currentVerse={verse.verse}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        verse={verse}
        hindiTranslation={primaryHindi}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
}

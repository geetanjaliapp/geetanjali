/**
 * ChapterContextBar - Displays chapter context and navigation for verse detail
 *
 * Shows:
 * - Back button (navigate to previous page)
 * - Chapter name (full on desktop, abbreviated on mobile)
 * - Verse position (e.g., "Verse 47 of 72" or "47/72")
 * - Progress bar showing position in chapter
 * - Optional: Font size toggle and reset (for VerseDetail)
 *
 * Used by: VerseDetail, Reading Mode
 */

import { useNavigate } from "react-router-dom";
import { getChapterInfo, getVerseProgress } from "../constants/chapters";
import { ProgressBar } from "./ProgressBar";

type FontSize = "normal" | "large";

interface ChapterContextBarProps {
  chapter: number;
  verse: number;
  /** Optional font size for VerseDetail */
  fontSize?: FontSize;
  /** Callback to toggle font size */
  onToggleFontSize?: () => void;
  /** Callback to reset font size to default */
  onResetFontSize?: () => void;
  /** Whether font size is at default (hides reset button) */
  isDefaultFontSize?: boolean;
}

export function ChapterContextBar({
  chapter,
  verse,
  fontSize,
  onToggleFontSize,
  onResetFontSize,
  isDefaultFontSize = true,
}: ChapterContextBarProps) {
  const navigate = useNavigate();
  const chapterInfo = getChapterInfo(chapter);
  const progress = getVerseProgress(chapter, verse);

  const handleBack = () => {
    navigate(-1);
  };

  const showFontControls = onToggleFontSize !== undefined;

  return (
    <div className="mb-4 sm:mb-6">
      {/* Main row: Back button, Chapter name, Verse position + Font controls */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="shrink-0 text-[var(--badge-warm-text)] hover:text-[var(--text-accent-hover)] font-medium text-sm
                     focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded transition-colors"
          aria-label="Go back to previous page"
        >
          <span className="flex items-center gap-1">
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline">Back</span>
          </span>
        </button>

        {/* Chapter name - centered */}
        <div className="flex-1 min-w-0 text-center">
          {/* Desktop: Full chapter name */}
          <h1 className="hidden sm:block text-base lg:text-lg font-semibold text-[var(--text-primary)] truncate">
            Chapter {chapter}: {chapterInfo?.name ?? "Unknown"}
          </h1>
          {/* Mobile: Abbreviated */}
          <h1 className="sm:hidden text-sm font-semibold text-[var(--text-primary)] truncate">
            Ch.{chapter} {chapterInfo?.shortName ?? ""}
          </h1>
        </div>

        {/* Right side: Verse position + Font controls */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Verse position */}
          <div className="text-right">
            {/* Desktop: "Verse 47 of 72" */}
            <span className="hidden sm:inline text-sm text-[var(--badge-warm-text)]">
              Verse {progress.position} of {progress.total}
            </span>
            {/* Mobile: "47/72" */}
            <span className="sm:hidden text-sm text-[var(--badge-warm-text)] font-medium">
              {progress.position}/{progress.total}
            </span>
          </div>

          {/* Font controls - only shown when props are provided */}
          {showFontControls && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[var(--border-warm)]">
              {/* Font size toggle */}
              <button
                onClick={onToggleFontSize}
                className="flex items-center justify-center gap-1 px-2 py-1 text-[var(--text-accent)] hover:bg-[var(--surface-warm)] active:bg-[var(--badge-warm-bg)] rounded-[var(--radius-nav)] transition-[var(--transition-color)]"
                aria-label={`Font size: ${fontSize}. Tap to change.`}
                title={`Font size: ${fontSize}`}
              >
                <span className="text-xs font-serif">Aa</span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-[var(--radius-progress)] bg-[var(--interactive-primary)]" />
                  <span
                    className={`w-1 h-1 rounded-[var(--radius-progress)] ${fontSize === "large" ? "bg-[var(--interactive-primary)]" : "bg-[var(--badge-warm-bg)]"}`}
                  />
                </span>
              </button>

              {/* Reset button - always visible for stable layout, disabled when at default */}
              {onResetFontSize && (
                <button
                  onClick={onResetFontSize}
                  disabled={isDefaultFontSize}
                  className={`flex items-center justify-center p-1 rounded-[var(--radius-nav)] transition-[var(--transition-color)] ${
                    isDefaultFontSize
                      ? "text-[var(--interactive-disabled)] cursor-default"
                      : "text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:bg-[var(--surface-warm)]"
                  }`}
                  aria-label="Reset font size"
                  title={isDefaultFontSize ? "Font size is default" : "Reset font size"}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <ProgressBar
          percentage={progress.percentage}
          height={3}
          ariaLabel={`Chapter ${chapter} progress: ${progress.position} of ${progress.total} verses (${progress.percentage}%)`}
        />
      </div>
    </div>
  );
}

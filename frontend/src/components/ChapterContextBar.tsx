/**
 * ChapterContextBar - Displays chapter context and navigation for verse detail
 *
 * Shows:
 * - Back button (navigate to previous page)
 * - Chapter name (full on desktop, abbreviated on mobile)
 * - Verse position (e.g., "Verse 47 of 72" or "47/72")
 * - Progress bar showing position in chapter
 *
 * Used by: VerseDetail, Reading Mode
 */

import { useNavigate } from "react-router-dom";
import { getChapterInfo, getVerseProgress } from "../constants/chapters";
import { ProgressBar } from "./ProgressBar";

interface ChapterContextBarProps {
  chapter: number;
  verse: number;
}

export function ChapterContextBar({ chapter, verse }: ChapterContextBarProps) {
  const navigate = useNavigate();
  const chapterInfo = getChapterInfo(chapter);
  const progress = getVerseProgress(chapter, verse);

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="mb-4 sm:mb-6">
      {/* Main row: Back button, Chapter name, Verse position */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex-shrink-0 text-amber-700 hover:text-amber-800 font-medium text-sm
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                     focus-visible:ring-offset-2 rounded transition-colors"
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
          <h1 className="hidden sm:block text-base lg:text-lg font-semibold text-amber-900 truncate">
            Chapter {chapter}: {chapterInfo?.name ?? "Unknown"}
          </h1>
          {/* Mobile: Abbreviated */}
          <h1 className="sm:hidden text-sm font-semibold text-amber-900 truncate">
            Ch.{chapter} {chapterInfo?.shortName ?? ""}
          </h1>
        </div>

        {/* Verse position */}
        <div className="flex-shrink-0 text-right">
          {/* Desktop: "Verse 47 of 72" */}
          <span className="hidden sm:inline text-sm text-amber-700">
            Verse {progress.position} of {progress.total}
          </span>
          {/* Mobile: "47/72" */}
          <span className="sm:hidden text-sm text-amber-700 font-medium">
            {progress.position}/{progress.total}
          </span>
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

/**
 * ChapterComplete - Inline prompt shown at chapter boundary during auto-advance
 *
 * Features:
 * - Shown when auto-advance reaches end of chapter
 * - Options: Continue to next chapter or Stop
 * - Focus trapped for accessibility
 *
 * Design: Per Phase 3.7 specification
 */

import { useRef } from "react";
import { useFocusTrap } from "../hooks";

interface ChapterCompleteProps {
  /** Current chapter number */
  chapter: number;
  /** Total verses in completed chapter */
  verseCount: number;
  /** Whether next chapter exists */
  hasNextChapter: boolean;
  /** Callback to continue to next chapter */
  onContinue: () => void;
  /** Callback to stop auto-advance */
  onStop: () => void;
}

export function ChapterComplete({
  chapter,
  verseCount,
  hasNextChapter,
  onContinue,
  onStop,
}: ChapterCompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Trap focus within this component for accessibility
  useFocusTrap(containerRef, true);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-2xl mx-auto text-center px-4 py-12"
      role="dialog"
      aria-modal="true"
      aria-label={`Chapter ${chapter} complete`}
    >
      {/* Success badge */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-lg font-medium rounded-[var(--radius-chip)]">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Chapter {chapter} Complete
        </span>
      </div>

      {/* Chapter summary */}
      <p className="text-[var(--text-secondary)] mb-8">
        {verseCount} {verseCount === 1 ? "verse" : "verses"}
      </p>

      {/* CTAs */}
      <div className="space-y-3">
        {hasNextChapter && (
          <button
            onClick={onContinue}
            className="w-full max-w-xs mx-auto px-6 py-3 bg-[var(--interactive-contextual)] hover:bg-[var(--interactive-contextual-hover)] text-[var(--interactive-contextual-text)] font-medium rounded-[var(--radius-button)] transition-[var(--transition-color)] shadow-[var(--shadow-card)]"
          >
            Continue to Chapter {chapter + 1} →
          </button>
        )}

        <button
          onClick={onStop}
          className="w-full max-w-xs mx-auto px-6 py-3 border border-[var(--border-warm)] hover:border-[var(--border-warm-hover)] hover:bg-[var(--interactive-ghost-hover-bg)] text-[var(--text-primary)] font-medium rounded-[var(--radius-button)] transition-[var(--transition-color)]"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

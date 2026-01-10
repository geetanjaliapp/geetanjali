/**
 * MiniPlayerModeSelector - Auto-advance mode selection UI
 *
 * Segmented control with Study as the primary (hero) action.
 * Layout: [Listen] [▶ STUDY] [Read]   12/72
 *
 * Design: Study-first approach - Study is center, filled, larger.
 * Listen/Read are secondary, outline style.
 */

interface MiniPlayerModeSelectorProps {
  /** Current verse position in chapter */
  versePosition: { current: number; total: number };
  /** Start audio (Listen) mode */
  onStartAudioMode: () => void;
  /** Start text (Read) mode */
  onStartTextMode: () => void;
  /** Start study mode (Sanskrit + TTS translations + insight) */
  onStartStudyMode?: () => void;
  /** Whether study mode is loading (fetching translations) */
  isStudyModeLoading?: boolean;
}

export function MiniPlayerModeSelector({
  versePosition,
  onStartAudioMode,
  onStartTextMode,
  onStartStudyMode,
  isStudyModeLoading = false,
}: MiniPlayerModeSelectorProps) {
  // Common button styles
  const secondaryButtonClass = `
    min-h-[44px] px-4 py-2.5 rounded-lg
    text-[var(--text-secondary)] bg-transparent
    hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)]
    transition-all duration-150
    flex items-center gap-2 text-sm font-medium
  `;

  const primaryButtonClass = `
    min-h-[44px] px-6 py-2.5 rounded-lg
    bg-[var(--interactive-primary)] text-[var(--text-on-primary)]
    hover:bg-[var(--interactive-primary-hover)]
    transition-all duration-150
    flex items-center gap-2 text-sm font-semibold
    disabled:opacity-60 disabled:cursor-wait
  `;

  return (
    <div
      className="bg-[var(--surface-reading-header)] backdrop-blur-xs border-t border-[var(--border-reading-header)] px-4 py-3"
      role="region"
      aria-label="Auto-advance mode selection"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Segmented control */}
          <div className="flex items-center bg-[var(--surface-secondary)] rounded-xl p-1 gap-0.5">
            {/* Listen button - Secondary */}
            <button
              onClick={onStartAudioMode}
              className={secondaryButtonClass}
              aria-label={`Listen mode: plays audio for each verse starting from verse ${versePosition.current}`}
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
              Listen
            </button>

            {/* Study button - Primary (Hero) */}
            {onStartStudyMode && (
              <button
                onClick={onStartStudyMode}
                disabled={isStudyModeLoading}
                className={`${primaryButtonClass} ${isStudyModeLoading ? "animate-pulse" : ""}`}
                aria-label={`Study mode: guided narration with Sanskrit, translations, and insights starting from verse ${versePosition.current}`}
                aria-busy={isStudyModeLoading}
              >
                {isStudyModeLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    {/* Graduation cap icon - consistent with MiniPlayerActive */}
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                    Study
                  </>
                )}
              </button>
            )}

            {/* Read button - Secondary */}
            <button
              onClick={onStartTextMode}
              className={secondaryButtonClass}
              aria-label={`Read mode: silent timed reading starting from verse ${versePosition.current}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Read
            </button>
          </div>

          {/* Verse position */}
          <span className="text-sm font-mono text-[var(--text-tertiary)] tabular-nums">
            {versePosition.current}/{versePosition.total}
          </span>
        </div>
      </div>
    </div>
  );
}

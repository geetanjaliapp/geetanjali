/**
 * MiniPlayerModeSelector - Auto-advance mode selection UI
 *
 * Shows Listen, Study, and Read buttons for starting auto-advance modes.
 * Displayed when auto-advance is off and verse has audio available.
 *
 * Order: Listen (audio) → Study (guided) → Read (silent)
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

/** Tooltip wrapper component */
function Tooltip({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) {
  return (
    <div className="relative group">
      {children}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5
          bg-[var(--surface-elevated)] text-[var(--text-primary)] text-xs rounded-lg
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          pointer-events-none whitespace-nowrap shadow-lg border border-[var(--border-subtle)]
          z-50"
        role="tooltip"
      >
        {text}
        {/* Tooltip arrow */}
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
            border-4 border-transparent border-t-[var(--surface-elevated)]"
        />
      </div>
    </div>
  );
}

export function MiniPlayerModeSelector({
  versePosition,
  onStartAudioMode,
  onStartTextMode,
  onStartStudyMode,
  isStudyModeLoading = false,
}: MiniPlayerModeSelectorProps) {
  return (
    <div
      className="bg-[var(--surface-reading-header)] backdrop-blur-xs border-t border-[var(--border-reading-header)] px-4 py-3"
      role="region"
      aria-label="Auto-advance mode selection"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-3">
          {/* Auto Mode label */}
          <span className="text-sm text-[var(--text-reading-tertiary)]">
            Auto Mode
          </span>

          {/* Listen button - Primary action */}
          <Tooltip text="Play audio for each verse">
            <button
              onClick={onStartAudioMode}
              className="min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] bg-[var(--interactive-contextual)] text-[var(--interactive-contextual-text)] hover:bg-[var(--interactive-contextual-hover)] transition-[var(--transition-button)] flex items-center gap-2 text-sm font-medium"
              aria-label={`Listen mode: plays audio for each verse starting from verse ${versePosition.current}, auto-advances through all ${versePosition.total} verses`}
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              Listen
            </button>
          </Tooltip>

          {/* Study button - Guided narration with translations */}
          {onStartStudyMode && (
            <Tooltip text="Sanskrit + translations + insight">
              <button
                onClick={onStartStudyMode}
                disabled={isStudyModeLoading}
                className={`min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] border border-[var(--border-warm)] text-[var(--text-primary)] hover:bg-[var(--interactive-ghost-hover-bg)] hover:border-[var(--border-warm-hover)] transition-[var(--transition-button)] flex items-center gap-2 text-sm font-medium disabled:cursor-wait ${
                  isStudyModeLoading ? "animate-pulse" : ""
                }`}
                aria-label={`Study mode: guided narration with Sanskrit audio, English and Hindi translations, and insights starting from verse ${versePosition.current}, auto-advances through all ${versePosition.total} verses`}
                aria-busy={isStudyModeLoading}
              >
                {isStudyModeLoading ? (
                  <>
                    {/* Shimmer loading state */}
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-[var(--border-warm)] via-[var(--text-tertiary)] to-[var(--border-warm)] bg-[length:200%_100%] animate-shimmer" />
                    <span className="bg-gradient-to-r from-[var(--text-primary)] via-[var(--text-tertiary)] to-[var(--text-primary)] bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer">
                      Loading...
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      {/* Graduation cap / academic icon for study */}
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 14l9-5-9-5-9 5 9 5z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 14l9-5-9-5-9 5 9 5zm0 0v6"
                      />
                    </svg>
                    Study
                  </>
                )}
              </button>
            </Tooltip>
          )}

          {/* Read button - Silent timed reading */}
          <Tooltip text="Silent timed reading">
            <button
              onClick={onStartTextMode}
              className="min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] border border-[var(--border-warm)] text-[var(--text-primary)] hover:bg-[var(--interactive-ghost-hover-bg)] hover:border-[var(--border-warm-hover)] transition-[var(--transition-button)] flex items-center gap-2 text-sm font-medium"
              aria-label={`Read mode: silent timed reading starting from verse ${versePosition.current}, auto-advances through all ${versePosition.total} verses`}
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
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

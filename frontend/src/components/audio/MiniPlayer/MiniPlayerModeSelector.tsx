/**
 * MiniPlayerModeSelector - Auto-advance mode selection UI
 *
 * Shows Listen and Read buttons for starting auto-advance mode.
 * Displayed when auto-advance is off and verse has audio available.
 */

interface MiniPlayerModeSelectorProps {
  /** Current verse position in chapter */
  versePosition: { current: number; total: number };
  /** Start audio (Listen) mode */
  onStartAudioMode: () => void;
  /** Start text (Read) mode */
  onStartTextMode: () => void;
}

export function MiniPlayerModeSelector({
  versePosition,
  onStartAudioMode,
  onStartTextMode,
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

          {/* Listen button */}
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

          {/* Read button */}
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
        </div>
      </div>
    </div>
  );
}

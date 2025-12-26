/**
 * Skip to main content link for keyboard accessibility
 * Visually hidden until focused, then appears at top of page
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--interactive-primary)] focus:text-[var(--interactive-primary-text)] focus:rounded-[var(--radius-button)] focus:shadow-[var(--shadow-dropdown)] focus:outline-hidden focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)]"
    >
      Skip to main content
    </a>
  );
}

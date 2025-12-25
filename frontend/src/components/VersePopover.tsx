/**
 * VersePopover - Click-triggered popover for verse references
 *
 * Shows verse paraphrase and chapter context when user clicks a verse
 * reference in guidance text. Provides quick insight without navigating
 * away, with option to view full verse detail.
 *
 * Design: Follows warm amber design language, 44px touch targets.
 */

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import { formatVerseRef } from "../lib/verseLinker";
import { getChapterShortName } from "../constants/chapters";

interface VersePopoverProps {
  /** Canonical ID, e.g., "BG_2_47" */
  canonicalId: string;
  /** Chapter number */
  chapter: number;
  /** Paraphrase text (leadership insight) */
  paraphrase?: string;
  /** Whether paraphrase is loading */
  loading?: boolean;
  /** Callback when popover opens - use for fetching data */
  onOpen?: () => void;
  /** Children to render as the trigger (verse ref pill) */
  children?: React.ReactNode;
}

export function VersePopover({
  canonicalId,
  chapter,
  paraphrase,
  loading = false,
  onOpen,
  children,
}: VersePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Position popover to stay in viewport
  const [position, setPosition] = useState<"above" | "below">("below");

  // Calculate popover position based on available viewport space
  // useLayoutEffect is correct here - we need DOM measurements before paint
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Popover is approximately 150px tall
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(
      spaceBelow < 180 && spaceAbove > spaceBelow ? "above" : "below",
    );
  }, [isOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const willOpen = !prev;
      if (willOpen && onOpen) {
        onOpen();
      }
      return willOpen;
    });
  }, [onOpen]);

  const displayRef = formatVerseRef(canonicalId);
  const chapterName = getChapterShortName(chapter);

  return (
    <span className="relative inline-block">
      {/* Trigger - Verse Reference Pill */}
      <button
        ref={triggerRef}
        onClick={toggle}
        className="inline-flex items-center text-[var(--badge-warm-text)] font-mono text-sm
                   bg-[var(--surface-warm)] px-1.5 py-0.5 rounded border border-[var(--border-warm)]
                   hover:bg-[var(--surface-warm)] hover:border-[var(--border-warm)]
                   focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500
                   transition-colors duration-150 cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {children || displayRef}
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Verse ${displayRef} details`}
          className={`absolute z-50 w-72 sm:w-80
                      bg-[var(--surface-elevated)] rounded-xl shadow-xl border border-[var(--border-warm)]
                      animate-in fade-in zoom-in-95 duration-150
                      ${position === "above" ? "bottom-full mb-2" : "top-full mt-2"}
                      left-1/2 -translate-x-1/2
                      sm:left-0 sm:translate-x-0`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-warm)]">
            <div>
              <div className="font-mono text-[var(--badge-warm-text)] font-semibold">
                {displayRef}
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">
                Chapter {chapter} · {chapterName}
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-3 sm:p-1 -m-2 sm:m-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded
                         focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label="Close"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content - Paraphrase */}
          <div className="px-4 py-3">
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <div className="flex gap-1">
                  <div
                    className="w-2 h-2 bg-[var(--interactive-primary)] rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-[var(--interactive-primary)] rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-[var(--interactive-primary)] rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            ) : paraphrase ? (
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed italic">
                "{paraphrase}"
              </p>
            ) : (
              <p className="text-[var(--text-tertiary)] text-sm italic">
                Insight unavailable
              </p>
            )}
          </div>

          {/* Footer - View Full Verse Link */}
          <div className="px-4 py-3 border-t border-[var(--border-warm)] bg-[var(--surface-warm-subtle)] rounded-b-xl">
            <Link
              to={`/verses/${canonicalId}`}
              className="flex items-center justify-center gap-1.5 text-sm text-[var(--text-accent)]
                         hover:text-[var(--text-accent-hover)] font-medium transition-colors
                         focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500
                         focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded py-1"
              onClick={() => setIsOpen(false)}
            >
              View full verse
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </span>
  );
}

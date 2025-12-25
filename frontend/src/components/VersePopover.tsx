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
        className="inline-flex items-center text-orange-700 dark:text-orange-400 font-mono text-sm
                   bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800
                   hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:border-orange-300 dark:hover:border-orange-700
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
                      bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-amber-200 dark:border-gray-700
                      animate-in fade-in zoom-in-95 duration-150
                      ${position === "above" ? "bottom-full mb-2" : "top-full mt-2"}
                      left-1/2 -translate-x-1/2
                      sm:left-0 sm:translate-x-0`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100 dark:border-gray-700">
            <div>
              <div className="font-mono text-orange-700 dark:text-orange-400 font-semibold">
                {displayRef}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Chapter {chapter} · {chapterName}
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-3 sm:p-1 -m-2 sm:m-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded
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
                    className="w-2 h-2 bg-orange-400 dark:bg-orange-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-orange-400 dark:bg-orange-500 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-orange-400 dark:bg-orange-500 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            ) : paraphrase ? (
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed italic">
                "{paraphrase}"
              </p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                Insight unavailable
              </p>
            )}
          </div>

          {/* Footer - View Full Verse Link */}
          <div className="px-4 py-3 border-t border-amber-100 dark:border-gray-700 bg-amber-50/50 dark:bg-gray-700/50 rounded-b-xl">
            <Link
              to={`/verses/${canonicalId}`}
              className="flex items-center justify-center gap-1.5 text-sm text-orange-600 dark:text-orange-400
                         hover:text-orange-700 dark:hover:text-orange-300 font-medium transition-colors
                         focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500
                         focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 rounded py-1"
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

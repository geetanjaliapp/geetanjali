/**
 * TopicSelector - Grouped topic picker for Verse Explorer
 *
 * Design: Matches ChapterSelector pattern - subtle popover that helps
 * without blocking. Groups principles by yoga path for educational context.
 *
 * Features:
 * - 4 groups × 4 principles = 16 topics
 * - Mobile: 2 columns per group, Tablet+: 2×2 group grid
 * - Footer link to /topics for deep exploration
 * - WCAG grid keyboard navigation
 *
 * Used by: Verses.tsx filter bar
 */

import { useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTaxonomy } from "../hooks/useTaxonomy";

interface TopicSelectorProps {
  /** Currently selected topic ID (null = none) */
  selectedTopic: string | null;
  /** Callback when a topic is selected */
  onSelect: (topicId: string | null) => void;
  /** Callback to close the selector */
  onClose: () => void;
  /** Whether the selector is visible */
  isOpen: boolean;
}

export function TopicSelector({
  selectedTopic,
  onSelect,
  onClose,
  isOpen,
}: TopicSelectorProps) {
  const { groups, getPrinciplesForGroup } = useTaxonomy();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Build flat list of all principles and group offsets for keyboard navigation
  const { allPrinciples, groupOffsets } = useMemo(() => {
    const principles: Array<{ id: string; label: string; groupId: string }> = [];
    const offsets: Record<string, number> = {};
    let offset = 0;

    groups.forEach((group) => {
      offsets[group.id] = offset;
      const groupPrinciples = getPrinciplesForGroup(group.id);
      groupPrinciples.forEach((p) => {
        principles.push({ id: p.id, label: p.shortLabel, groupId: group.id });
      });
      offset += groupPrinciples.length;
    });

    return { allPrinciples: principles, groupOffsets: offsets };
  }, [groups, getPrinciplesForGroup]);

  // Focus management: focus selected topic or first topic on open
  useEffect(() => {
    if (isOpen && allPrinciples.length > 0) {
      requestAnimationFrame(() => {
        const selectedIndex = selectedTopic
          ? allPrinciples.findIndex((p) => p.id === selectedTopic)
          : 0;
        const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
        buttonRefs.current[targetIndex]?.focus();
      });
    }
  }, [isOpen, selectedTopic, allPrinciples]);

  // Keyboard navigation (WCAG grid pattern)
  // Uses flat navigation across all principles. Arrow left/right move sequentially.
  // Arrow up/down skip by column count (2 mobile, 4 tablet) for approximate grid feel.
  // This is a simplification - true grid nav would need per-group handling.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const total = allPrinciples.length;
      if (total === 0) return;

      // Responsive columns: matches visual layout
      const isMobile = window.innerWidth < 640;
      const cols = isMobile ? 2 : 4;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          return;
        case "ArrowRight":
          e.preventDefault();
          nextIndex = index < total - 1 ? index + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = index > 0 ? index - 1 : total - 1;
          break;
        case "ArrowDown":
          e.preventDefault();
          nextIndex = index + cols < total ? index + cols : index % cols;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex =
            index - cols >= 0 ? index - cols : total - cols + (index % cols);
          if (nextIndex >= total) nextIndex = total - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = total - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        buttonRefs.current[nextIndex]?.focus();
      }
    },
    [allPrinciples.length, onClose]
  );

  // Handle topic selection
  const handleSelect = useCallback(
    (topicId: string) => {
      // Toggle off if already selected, otherwise select
      onSelect(selectedTopic === topicId ? null : topicId);
      onClose();
    },
    [selectedTopic, onSelect, onClose]
  );

  // Handle footer link click (close selector)
  const handleFooterClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg-light)] z-50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="backdrop"
      />

      {/* Popover - positioned below trigger on desktop, bottom on mobile */}
      <div
        className="fixed sm:absolute bottom-16 sm:bottom-auto sm:top-full sm:mt-2
                   left-1/2 sm:left-auto sm:right-0 -translate-x-1/2 sm:translate-x-0
                   z-50 w-[calc(100vw-2rem)] sm:w-[400px] md:w-[480px] max-h-[70vh] overflow-y-auto
                   bg-[var(--surface-sticky-translucent)] backdrop-blur-xs
                   border border-[var(--border-warm)]
                   rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Select topic"
      >
        {/* Groups grid: 1 column on mobile, 2 columns on tablet+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map((group) => {
            const groupPrinciples = getPrinciplesForGroup(group.id);
            const startIndex = groupOffsets[group.id] ?? 0;

            return (
              <div key={group.id} role="group" aria-labelledby={`group-${group.id}`}>
                {/* Group label */}
                <h3
                  id={`group-${group.id}`}
                  className="text-xs font-semibold uppercase tracking-wide
                             text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5"
                >
                  <span>{group.label}</span>
                  <span className="text-[var(--text-quaternary)]">{group.sanskrit}</span>
                </h3>

                {/* Principles grid: 2 columns within each group */}
                <div className="grid grid-cols-2 gap-1.5">
                  {groupPrinciples.map((principle, i) => {
                    const currentIndex = startIndex + i;
                    const isSelected = principle.id === selectedTopic;
                    const isTabTarget =
                      (selectedTopic && principle.id === selectedTopic) ||
                      (!selectedTopic && currentIndex === 0);

                    return (
                      <button
                        key={principle.id}
                        ref={(el) => {
                          buttonRefs.current[currentIndex] = el;
                        }}
                        onClick={() => handleSelect(principle.id)}
                        onKeyDown={(e) => handleKeyDown(e, currentIndex)}
                        tabIndex={isTabTarget ? 0 : -1}
                        className={`
                          px-3 py-2.5 rounded-[var(--radius-button)]
                          text-sm font-medium text-left
                          transition-[var(--transition-color)]
                          focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                          ${
                            isSelected
                              ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-[var(--chip-selected-ring)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)] active:bg-[var(--badge-warm-hover)]"
                          }
                        `}
                        aria-pressed={isSelected}
                      >
                        {principle.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer separator and link */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <Link
            to="/topics"
            onClick={handleFooterClick}
            className="text-sm font-medium text-[var(--text-accent)]
                       hover:text-[var(--interactive-primary)]
                       underline underline-offset-2
                       focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            Explore all teachings →
          </Link>
        </div>
      </div>
    </>
  );
}

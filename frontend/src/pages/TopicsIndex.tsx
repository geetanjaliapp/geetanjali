/**
 * TopicsIndex - Discovery hub for principles and learning goals
 *
 * Route: /topics
 *
 * Features:
 * - Hero section: "What brings you to the Geeta?"
 * - 8 Learning Goal cards (primary navigation)
 * - Goal filtering: shows 4 mapped principles per goal
 * - 4 yoga path groups as secondary navigation
 * - Search filtering within selected view
 * - Responsive: 2 cols mobile, 4 cols tablet for goals
 *
 * Design: User-centric discovery, distinct from /verses explorer
 */

import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Navbar, SearchInput } from "../components";
import { Footer } from "../components/Footer";
import { TopicCard } from "../components/topics";
import { GoalIconsById, CloseIcon } from "../components/icons";
import { useTopics, useTaxonomy, useSEO } from "../hooks";
import type { Goal } from "../lib/api";

/** Loading skeleton for goal cards */
function GoalCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center p-4 sm:p-5 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-elevated)] animate-pulse"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--skeleton-bg)] rounded-full mb-2 sm:mb-3" />
          <div className="h-4 bg-[var(--skeleton-bg)] rounded w-20 mb-1" />
          <div className="h-3 bg-[var(--skeleton-bg)] rounded w-16" />
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for principles */
function PrinciplesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-32 bg-[var(--skeleton-bg)] rounded-[var(--radius-card)] animate-pulse"
        />
      ))}
    </div>
  );
}

/** Error state component */
function TopicsError({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-[var(--status-error-text)] mb-4">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="text-[var(--text-accent)] hover:text-[var(--interactive-primary)] underline"
      >
        Try again
      </button>
    </div>
  );
}

/** Goal card for the hero section */
function GoalCard({
  goal,
  isSelected,
  onClick,
}: {
  goal: Goal;
  isSelected: boolean;
  onClick: () => void;
}) {
  const IconComponent = GoalIconsById[goal.id];

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center p-3 sm:p-4 rounded-[var(--radius-card)] border transition-all
        focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2
        ${
          isSelected
            ? "border-[var(--border-accent)] bg-[var(--surface-warm)] shadow-[var(--shadow-card)]"
            : "border-[var(--border-default)] bg-[var(--surface-elevated)] hover:border-[var(--border-warm)] hover:bg-[var(--surface-warm-subtle)]"
        }
      `}
      aria-pressed={isSelected}
    >
      {/* Icon */}
      <div
        className={`
          w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-3 transition-colors
          ${
            isSelected
              ? "bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)]"
              : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
          }
        `}
      >
        {IconComponent && <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />}
      </div>

      {/* Label */}
      <h3
        className={`
          font-medium text-sm sm:text-base text-center leading-tight transition-colors
          ${isSelected ? "text-[var(--badge-warm-text)]" : "text-[var(--text-primary)]"}
        `}
      >
        {goal.label}
      </h3>

      {/* Description - visible on sm+ */}
      <p className="hidden sm:block text-xs text-center text-[var(--text-tertiary)] mt-1 line-clamp-2">
        {goal.description}
      </p>

      {/* Principle count */}
      <span className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1 sm:mt-2">
        {goal.principles.length === 0 ? "All 16" : `${goal.principles.length} principles`}
      </span>
    </button>
  );
}

/** Yoga path row for "browse by tradition" section */
function PathRow({
  group,
  principleCount,
  onClick,
}: {
  group: { id: string; label: string; sanskrit: string; description: string };
  principleCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full p-3 sm:p-4 bg-[var(--surface-elevated)] hover:bg-[var(--surface-warm-subtle)] border border-[var(--border-default)] hover:border-[var(--border-warm)] rounded-[var(--radius-card)] transition-all text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    >
      <div>
        <span className="font-medium text-[var(--text-primary)]">{group.label}</span>
        <span className="ml-2 font-serif text-[var(--text-tertiary)]">{group.sanskrit}</span>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">{group.description}</p>
      </div>
      <div className="flex items-center gap-1 text-[var(--text-accent)]">
        <span className="text-xs sm:text-sm">{principleCount} principles</span>
        <span className="text-sm">→</span>
      </div>
    </button>
  );
}

export default function TopicsIndex() {
  const { groups, totalPrinciples, loading, error } = useTopics();
  const { goals, loading: taxonomyLoading } = useTaxonomy();

  // Filter state
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useSEO({
    title: "Teachings of the Bhagavad Geeta | 16 Principles for Ethical Leadership",
    description:
      "Explore 16 timeless principles from the Bhagavad Geeta for ethical leadership and personal growth. Discover teachings on Karma, Jnana, Bhakti, and Sadachara.",
    canonical: "/topics",
  });

  // Get selected goal object
  const selectedGoalObj = useMemo(() => {
    return goals.find((g) => g.id === selectedGoal) ?? null;
  }, [goals, selectedGoal]);

  // Build a flat map of all principles with verseCount (from groups data)
  const allPrinciplesMap = useMemo(() => {
    const map = new Map<string, (typeof groups)[0]["principles"][0]>();
    groups.forEach((group) => {
      group.principles.forEach((p) => {
        map.set(p.id, p);
      });
    });
    return map;
  }, [groups]);

  // Get principles for selected goal (lookup from groups to get verseCount)
  const goalPrinciples = useMemo(() => {
    if (!selectedGoal) return [];
    const goal = goals.find((g) => g.id === selectedGoal);
    if (!goal) return [];

    // "exploring" goal has empty principles array - return all
    if (goal.principles.length === 0) {
      return Array.from(allPrinciplesMap.values());
    }

    // Map goal principle IDs to full principle objects with verseCount
    return goal.principles
      .map((id) => allPrinciplesMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  }, [selectedGoal, goals, allPrinciplesMap]);

  // Get principles for selected path
  const pathPrinciples = useMemo(() => {
    if (!selectedPath) return [];
    const group = groups.find((g) => g.id === selectedPath);
    return group?.principles ?? [];
  }, [selectedPath, groups]);

  // Filter principles by search query
  const filteredPrinciples = useMemo(() => {
    const principles = selectedGoal ? goalPrinciples : selectedPath ? pathPrinciples : [];
    if (!searchQuery.trim()) return principles;

    const query = searchQuery.toLowerCase().trim();
    return principles.filter(
      (p) =>
        p.label.toLowerCase().includes(query) ||
        p.shortLabel.toLowerCase().includes(query) ||
        p.sanskrit.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  }, [goalPrinciples, pathPrinciples, selectedGoal, selectedPath, searchQuery]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedGoal(null);
    setSelectedPath(null);
    setSearchQuery("");
  }, []);

  // Handle goal selection
  const handleGoalClick = useCallback((goalId: string) => {
    setSelectedGoal((prev) => (prev === goalId ? null : goalId));
    setSelectedPath(null);
    setSearchQuery("");
  }, []);

  // Handle path selection
  const handlePathClick = useCallback((pathId: string) => {
    setSelectedPath((prev) => (prev === pathId ? null : pathId));
    setSelectedGoal(null);
    setSearchQuery("");
  }, []);

  const hasSelection = selectedGoal !== null || selectedPath !== null;
  const isLoading = loading || taxonomyLoading;

  return (
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Error state */}
        {error && <TopicsError message={error} />}

        {!error && (
          <>
            {/* Hero Section: What brings you to the Geeta? */}
            {!hasSelection && (
              <section className="mb-8 sm:mb-10">
                {/* Hero Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-heading text-[var(--text-primary)]">
                    What brings you to the Geeta?
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-2">
                    Choose your learning focus
                  </p>
                </div>

                {/* Goal Cards Grid */}
                {isLoading ? (
                  <GoalCardsSkeleton />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {goals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        isSelected={selectedGoal === goal.id}
                        onClick={() => handleGoalClick(goal.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-4 my-8 sm:my-10">
                  <div className="flex-1 h-px bg-[var(--border-default)]" />
                  <span className="text-sm text-[var(--text-muted)]">or explore by tradition</span>
                  <div className="flex-1 h-px bg-[var(--border-default)]" />
                </div>

                {/* Yoga Paths Section */}
                <section>
                  <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-4">
                    The Four Yoga Paths
                  </h2>
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-16 bg-[var(--skeleton-bg)] rounded-[var(--radius-card)] animate-pulse"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groups.map((group) => (
                        <PathRow
                          key={group.id}
                          group={group}
                          principleCount={group.principles.length}
                          onClick={() => handlePathClick(group.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Footer stats */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-[var(--text-muted)]">
                    {totalPrinciples || 16} principles • {goals.length || 8} learning goals •{" "}
                    {groups.length || 4} paths
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Already know what you're looking for?{" "}
                    <Link
                      to="/verses"
                      className="text-[var(--text-accent)] hover:underline"
                    >
                      Search verses directly →
                    </Link>
                  </p>
                </div>
              </section>
            )}

            {/* Filtered View: Show principles for selected goal/path */}
            {hasSelection && (
              <section>
                {/* Selection Header */}
                <div className="mb-6">
                  <button
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1 text-sm text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] mb-3"
                  >
                    ← Back to all goals
                  </button>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                          {selectedGoalObj?.label ||
                            groups.find((g) => g.id === selectedPath)?.label}
                        </h1>
                        <button
                          onClick={clearSelection}
                          className="p-1 hover:bg-[var(--surface-muted)] rounded-full transition-colors"
                          aria-label="Clear selection"
                        >
                          <CloseIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
                        </button>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        {selectedGoalObj?.description ||
                          groups.find((g) => g.id === selectedPath)?.description}
                      </p>
                    </div>

                    {/* Search within selection */}
                    <div className="w-full sm:w-64">
                      <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onSearch={setSearchQuery}
                        onClear={() => setSearchQuery("")}
                        placeholder="Search principles..."
                        showExamples={false}
                        autoFocus={false}
                        className="[&_input]:py-2 [&_button]:py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Principles Grid */}
                {isLoading ? (
                  <PrinciplesSkeleton />
                ) : filteredPrinciples.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredPrinciples.map((principle) => (
                      <TopicCard key={principle.id} principle={principle} showVerseCount />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-[var(--surface-warm-subtle)] rounded-[var(--radius-modal)] border border-[var(--border-warm-subtle)]">
                    <div className="text-4xl text-[var(--decorative-om)] mb-4">ॐ</div>
                    <h3 className="text-lg font-serif text-[var(--text-primary)] mb-2">
                      No principles found
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)] mb-4">
                      Try adjusting your search term.
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-sm text-[var(--text-accent)] hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                )}

                {/* Show count */}
                {filteredPrinciples.length > 0 && (
                  <p className="text-sm text-[var(--text-muted)] mt-4 text-center">
                    {filteredPrinciples.length} principle
                    {filteredPrinciples.length !== 1 ? "s" : ""}
                    {searchQuery && " matching your search"}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

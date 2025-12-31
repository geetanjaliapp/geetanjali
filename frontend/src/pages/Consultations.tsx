import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { casesApi } from "../lib/api";
import type { Case, CaseStatus, ShareMode } from "../types";
import { Navbar, ConfirmModal, Footer } from "../components";
import { ShareBar } from "../components/case";
import {
  SpinnerIcon,
  ChevronDownIcon,
  GridIcon,
  CheckIcon,
  ShareIcon,
  XCircleIcon,
} from "../components/icons";
import { errorMessages } from "../lib/errorMessages";
import { useAuth } from "../contexts/AuthContext";
import { useSEO } from "../hooks";

// Filter modes for the segmented control
type FilterMode = "all" | "completed" | "in-progress" | "failed" | "shared";

const CASES_PER_PAGE = 10;

// Status badge component
function StatusBadge({ status }: { status?: CaseStatus }) {
  if (!status || status === "completed") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-[var(--radius-chip)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
        Completed
      </span>
    );
  }
  if (status === "policy_violation") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-[var(--radius-chip)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
        Unable to Process
      </span>
    );
  }
  if (status === "processing" || status === "pending") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-[var(--radius-chip)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] flex items-center gap-1">
        <span className="animate-pulse">●</span> Processing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-[var(--radius-chip)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]">
        Failed
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs rounded-[var(--radius-chip)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
      Draft
    </span>
  );
}

export default function Consultations() {
  useSEO({
    title: "My Consultations",
    description:
      "View and manage your ethical consultations with guidance from the Bhagavad Geeta.",
    canonical: "/consultations",
    noIndex: true, // Personal data shouldn't be indexed
  });

  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [shareLoading, setShareLoading] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [shareBarOpen, setShareBarOpen] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filter from URL, default to "all"
  const getInitialFilter = (): FilterMode => {
    const filter = searchParams.get("filter");
    if (
      filter === "completed" ||
      filter === "in-progress" ||
      filter === "failed" ||
      filter === "shared"
    ) {
      return filter;
    }
    return "all";
  };
  const [filterMode, setFilterMode] = useState<FilterMode>(getInitialFilter);

  // Server-provided counts for filter badges
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    completed: 0,
    inProgress: 0,
    failed: 0,
    shared: 0,
  });

  // Handle filter change - triggers new data fetch
  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode);
    // Update URL for bookmarkability
    if (mode === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ filter: mode });
    }
  };

  // Sync filter with URL changes (browser back/forward)
  useEffect(() => {
    const urlFilter = searchParams.get("filter");
    const newMode: FilterMode =
      urlFilter === "completed" ||
      urlFilter === "in-progress" ||
      urlFilter === "failed" ||
      urlFilter === "shared"
        ? urlFilter
        : "all";
    if (newMode !== filterMode) {
      setFilterMode(newMode);
    }
  }, [searchParams, filterMode]);

  const handleRetry = async (e: React.MouseEvent, caseId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading(caseId);
    setError(null);
    try {
      const updatedCase = await casesApi.retry(caseId);
      setCases((prev) => prev.map((c) => (c.id === caseId ? updatedCase : c)));
      navigate(`/cases/${caseId}`);
    } catch (err) {
      setError(errorMessages.general(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = (
    e: React.MouseEvent,
    caseId: string,
    title: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id: caseId, title });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    setError(null);
    try {
      await casesApi.delete(deleteTarget.id);
      setCases((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(errorMessages.general(err));
      setDeleteTarget(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCancel = () => {
    if (!actionLoading) {
      setDeleteTarget(null);
    }
  };

  const handleShare = async (e: React.MouseEvent, caseItem: Case) => {
    e.preventDefault();
    e.stopPropagation();
    if (shareLoading) return;

    setShareLoading(caseItem.id);
    setError(null);

    try {
      const updated = await casesApi.toggleShare(caseItem.id, true, "full");
      setCases((prev) => prev.map((c) => (c.id === caseItem.id ? updated : c)));

      // Auto-copy link when sharing is enabled
      if (updated.public_slug) {
        const url = `${window.location.origin}/c/${updated.public_slug}`;
        await navigator.clipboard.writeText(url);
        setCopySuccess(caseItem.id);
        setTimeout(() => setCopySuccess(null), 2000);
      }
    } catch (err) {
      setError(errorMessages.general(err));
    } finally {
      setShareLoading(null);
    }
  };

  const handleModeChange = async (caseItem: Case, mode: ShareMode) => {
    if (shareLoading) return;

    setShareLoading(caseItem.id);
    setError(null);

    try {
      const updated = await casesApi.toggleShare(caseItem.id, true, mode);
      setCases((prev) => prev.map((c) => (c.id === caseItem.id ? updated : c)));
    } catch (err) {
      setError(errorMessages.general(err));
    } finally {
      setShareLoading(null);
    }
  };

  const handleStopSharing = async (caseItem: Case) => {
    if (shareLoading) return;

    setShareLoading(caseItem.id);
    setError(null);

    try {
      const updated = await casesApi.toggleShare(caseItem.id, false);
      setCases((prev) => prev.map((c) => (c.id === caseItem.id ? updated : c)));
    } catch (err) {
      setError(errorMessages.general(err));
    } finally {
      setShareLoading(null);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent, caseItem: Case) => {
    e.preventDefault();
    e.stopPropagation();
    if (!caseItem.public_slug) return;

    const url = `${window.location.origin}/c/${caseItem.public_slug}`;
    await navigator.clipboard.writeText(url);
    setCopySuccess(caseItem.id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // Load cases when auth or filter changes
  useEffect(() => {
    if (authLoading) return;

    setLoading(true);
    setCases([]); // Clear cases when filter changes

    casesApi
      .list(0, CASES_PER_PAGE, filterMode)
      .then((response) => {
        setCases(response.cases);
        setFilterCounts({
          all: response.counts.all,
          completed: response.counts.completed,
          inProgress: response.counts.in_progress,
          failed: response.counts.failed,
          shared: response.counts.shared,
        });
        setHasMore(response.cases.length === CASES_PER_PAGE);
      })
      .catch((err) => setError(errorMessages.caseLoad(err)))
      .finally(() => setLoading(false));
  }, [authLoading, filterMode]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const response = await casesApi.list(
        cases.length,
        CASES_PER_PAGE,
        filterMode,
      );
      setCases((prev) => [...prev, ...response.cases]);
      setHasMore(response.cases.length === CASES_PER_PAGE);
    } catch (err) {
      setError(errorMessages.caseLoad(err));
    } finally {
      setLoadingMore(false);
    }
  }, [cases.length, loadingMore, filterMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[var(--text-secondary)]">
            Loading your consultations...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      <Navbar />
      <div className="flex-1 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header - sticky below navbar, 2-line layout */}
          <div className="sticky top-14 sm:top-16 z-10 bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 mb-4 sm:mb-6">
            {/* Line 1: Title + CTA */}
            <div className="flex justify-between items-center">
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-primary)]">
                My Cases
              </h1>
              {/* CTA visible on tablet+ only, FAB handles mobile */}
              <Link
                to="/cases/new"
                className="hidden sm:inline-block bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] text-[var(--interactive-primary-text)] font-semibold px-5 py-2.5 sm:px-6 sm:py-3 rounded-[var(--radius-button)] transition-[var(--transition-color)] text-sm sm:text-base shrink-0"
              >
                Ask a Question
              </Link>
            </div>

            {/* Line 2: Filter Segmented Control - Order: All → In Progress → Done → Failed → Shared */}
            {filterCounts.all > 0 && (
              <div className="mt-3">
                <div className="inline-flex rounded-[var(--radius-button)] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-0.5 shadow-[var(--shadow-button)]">
                  {/* All Segment */}
                  <button
                    onClick={() => handleFilterChange("all")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                      filterMode === "all"
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                    }`}
                  >
                    <GridIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">All</span>
                    <span
                      className={`min-w-5 text-center text-xs tabular-nums ${
                        filterMode === "all"
                          ? "text-[var(--chip-selected-text)]"
                          : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      {filterCounts.all}
                    </span>
                  </button>

                  {/* In Progress Segment - only show if there are any (actionable/urgent) */}
                  {filterCounts.inProgress > 0 && (
                    <>
                      <div className="w-px bg-[var(--border-default)] my-1" />
                      <button
                        onClick={() => handleFilterChange("in-progress")}
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                          filterMode === "in-progress"
                            ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                        }`}
                      >
                        <SpinnerIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">In Progress</span>
                        <span
                          className={`min-w-5 text-center text-xs tabular-nums ${
                            filterMode === "in-progress"
                              ? "text-[var(--chip-selected-text)]"
                              : "text-[var(--status-warning-text)]"
                          }`}
                        >
                          {filterCounts.inProgress}
                        </span>
                      </button>
                    </>
                  )}

                  {/* Divider */}
                  <div className="w-px bg-[var(--border-default)] my-1" />

                  {/* Done Segment (includes completed + policy_violation) */}
                  <button
                    onClick={() => handleFilterChange("completed")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                      filterMode === "completed"
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                    }`}
                  >
                    <CheckIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Done</span>
                    <span
                      className={`min-w-5 text-center text-xs tabular-nums ${
                        filterMode === "completed"
                          ? "text-[var(--chip-selected-text)]"
                          : filterCounts.completed > 0
                            ? "text-[var(--status-success-text)]"
                            : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      {filterCounts.completed}
                    </span>
                  </button>

                  {/* Failed Segment - only show if there are failed cases (needs attention) */}
                  {filterCounts.failed > 0 && (
                    <>
                      <div className="w-px bg-[var(--border-default)] my-1" />
                      <button
                        onClick={() => handleFilterChange("failed")}
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                          filterMode === "failed"
                            ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                        }`}
                      >
                        <XCircleIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Failed</span>
                        <span
                          className={`min-w-5 text-center text-xs tabular-nums ${
                            filterMode === "failed"
                              ? "text-[var(--chip-selected-text)]"
                              : "text-[var(--status-error-text)]"
                          }`}
                        >
                          {filterCounts.failed}
                        </span>
                      </button>
                    </>
                  )}

                  {/* Divider */}
                  <div className="w-px bg-[var(--border-default)] my-1" />

                  {/* Shared Segment */}
                  <button
                    onClick={() => handleFilterChange("shared")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-[var(--radius-nav)] text-sm font-medium transition-[var(--transition-all)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                      filterMode === "shared"
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--badge-warm-bg)] hover:text-[var(--badge-warm-text)]"
                    }`}
                  >
                    <ShareIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Shared</span>
                    <span
                      className={`min-w-5 text-center text-xs tabular-nums ${
                        filterMode === "shared"
                          ? "text-[var(--chip-selected-text)]"
                          : filterCounts.shared > 0
                            ? "text-[var(--status-success-text)]"
                            : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      {filterCounts.shared}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 sm:mb-6 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-[var(--status-error-text)] px-3 sm:px-4 py-2 sm:py-3 rounded-[var(--radius-button)] text-sm"
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Anonymous user notice */}
          {!isAuthenticated && cases.length > 0 && (
            <div className="mb-4 sm:mb-6 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-[var(--radius-button)] p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
              <span className="text-[var(--text-accent)] text-base sm:text-lg">
                💡
              </span>
              <div>
                <p className="text-[var(--badge-warm-text)] text-xs sm:text-sm">
                  These consultations are stored in your browser session.
                  <Link
                    to="/signup"
                    className="ml-1 text-[var(--text-accent)] hover:text-[var(--badge-warm-text)] underline font-medium"
                  >
                    Create an account
                  </Link>{" "}
                  to save them permanently and access from any device.
                </p>
              </div>
            </div>
          )}

          {/* Consultations List */}
          {filterCounts.all === 0 && !error ? (
            // No cases at all (only show if no error - error takes precedence)
            <div className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] sm:shadow-[var(--shadow-modal)] p-8 sm:p-12 text-center">
              <img
                src="/logo.svg"
                alt="Geetanjali"
                loading="lazy"
                className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 sm:mb-6"
              />
              <p className="text-[var(--text-secondary)] mb-4 sm:mb-6 text-sm sm:text-base">
                You haven't asked any questions yet.
              </p>
              <Link
                to="/cases/new"
                className="inline-block bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] text-[var(--interactive-primary-text)] font-semibold px-6 py-2.5 sm:px-8 sm:py-3 rounded-[var(--radius-button)] transition-[var(--transition-color)] text-sm sm:text-base"
              >
                Ask Your First Question
              </Link>
            </div>
          ) : cases.length === 0 && !error ? (
            // Filter returned no results (but user has cases)
            <div className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-6 sm:p-8 text-center">
              <p className="text-[var(--text-secondary)] mb-4 text-sm sm:text-base">
                {filterMode === "in-progress"
                  ? "No consultations in progress."
                  : filterMode === "shared"
                    ? "You haven't shared any consultations yet."
                    : filterMode === "completed"
                      ? "No finished consultations."
                      : filterMode === "failed"
                        ? "No failed consultations."
                        : "No consultations match this filter."}
              </p>
              <button
                onClick={() => handleFilterChange("all")}
                className="text-[var(--interactive-ghost-text)] hover:text-[var(--text-primary)] text-sm font-medium"
              >
                View all cases →
              </button>
            </div>
          ) : (
            <>
              {/* Consultations List */}
              {/* isolate creates a new stacking context for proper z-index layering */}
              <div className="isolate pb-4 space-y-3 sm:space-y-4">
                {cases.map((case_) => {
                  const isCompleted =
                    !case_.status ||
                    case_.status === "completed" ||
                    case_.status === "policy_violation";
                  const canShare =
                    isCompleted && case_.status !== "policy_violation";

                  return (
                    <div key={case_.id}>
                      <div
                        className={`relative bg-[var(--surface-elevated)] rounded-[var(--radius-button)] sm:rounded-[var(--radius-card)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-[var(--transition-all)] border overflow-visible ${
                          case_.is_public
                            ? "border-[var(--status-success-border)] hover:border-[var(--status-success-border)]"
                            : "border-[var(--border-default)] hover:border-[var(--border-warm)]"
                        }`}
                      >
                        <Link
                          to={`/cases/${case_.id}`}
                          className="block p-4 sm:p-5 lg:p-6"
                        >
                          <div className="flex justify-between items-start mb-2 sm:mb-3 gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                                <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] truncate">
                                  {case_.title}
                                </h2>
                                <StatusBadge status={case_.status} />
                              </div>
                              <p className="text-xs sm:text-sm text-[var(--text-tertiary)]">
                                {new Date(
                                  case_.created_at || "",
                                ).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                            {case_.status === "failed" && (
                              <button
                                onClick={(e) => handleRetry(e, case_.id)}
                                disabled={actionLoading === case_.id}
                                className="px-2 sm:px-3 py-1 text-xs font-medium text-[var(--text-accent)] bg-[var(--badge-warm-bg)] hover:bg-[var(--badge-warm-hover)] rounded-[var(--radius-chip)] transition-[var(--transition-color)] disabled:opacity-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)]"
                                title="Retry analysis"
                              >
                                {actionLoading === case_.id ? "..." : "Retry"}
                              </button>
                            )}
                          </div>
                          <p className="text-[var(--text-secondary)] text-xs sm:text-sm line-clamp-2 mb-2 sm:mb-3">
                            {case_.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {case_.role && case_.role !== "Individual" && (
                              <span className="px-2 py-0.5 text-xs bg-[var(--surface-muted)] text-[var(--text-secondary)] rounded-[var(--radius-skeleton)]">
                                👤 {case_.role}
                              </span>
                            )}
                            {case_.stakeholders &&
                              case_.stakeholders.length > 0 &&
                              case_.stakeholders[0] !== "self" && (
                                <span className="px-2 py-0.5 text-xs bg-[var(--surface-muted)] text-[var(--text-secondary)] rounded-[var(--radius-skeleton)]">
                                  👥 {case_.stakeholders.join(", ")}
                                </span>
                              )}
                            {case_.horizon && (
                              <span className="px-2 py-0.5 text-xs bg-[var(--surface-muted)] text-[var(--text-secondary)] rounded-[var(--radius-skeleton)]">
                                ⏱️ {case_.horizon} term
                              </span>
                            )}
                          </div>
                        </Link>

                        <div className="px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 bg-[var(--surface-warm-subtle)] border-t border-[var(--border-warm-subtle)] flex items-center justify-end gap-2">
                          {/* Share button - one-click share when not public */}
                          {canShare && !case_.is_public && (
                            <button
                              onClick={(e) => handleShare(e, case_)}
                              disabled={shareLoading === case_.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-[var(--radius-button)] transition-[var(--transition-color)] flex items-center gap-1.5 disabled:opacity-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] text-[var(--text-accent)] bg-[var(--badge-warm-bg)] hover:bg-[var(--badge-warm-hover)] focus-visible:ring-[var(--border-focus)]"
                              title="Share consultation"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                />
                              </svg>
                              {shareLoading === case_.id ? "..." : "Share"}
                            </button>
                          )}
                          {/* Shared button with popover */}
                          {canShare && case_.is_public && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShareBarOpen(
                                    shareBarOpen === case_.id ? null : case_.id,
                                  );
                                }}
                                className="px-3 py-1.5 text-xs font-medium rounded-[var(--radius-button)] flex items-center gap-1.5 text-[var(--status-success-text)] bg-[var(--status-success-bg)] hover:bg-[var(--status-success-bg)] transition-[var(--transition-color)]"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                Shared
                              </button>

                              {/* ShareBar popover - positioned relative to button */}
                              {case_.public_slug &&
                                shareBarOpen === case_.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShareBarOpen(null);
                                      }}
                                    />
                                    <div className="absolute right-0 bottom-full mb-2 z-20">
                                      <ShareBar
                                        publicSlug={case_.public_slug}
                                        shareMode={case_.share_mode}
                                        viewCount={case_.view_count}
                                        copySuccess={copySuccess === case_.id}
                                        isLoading={shareLoading === case_.id}
                                        onCopyLink={() =>
                                          handleCopyLink(
                                            {
                                              preventDefault: () => {},
                                              stopPropagation: () => {},
                                            } as React.MouseEvent,
                                            case_,
                                          )
                                        }
                                        onModeChange={(mode) =>
                                          handleModeChange(case_, mode)
                                        }
                                        onStopSharing={() =>
                                          handleStopSharing(case_)
                                        }
                                        onClose={() => setShareBarOpen(null)}
                                        compact
                                      />
                                    </div>
                                  </>
                                )}
                            </div>
                          )}

                          <button
                            onClick={(e) =>
                              handleDeleteClick(e, case_.id, case_.title)
                            }
                            disabled={actionLoading === case_.id}
                            className="px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)] bg-[var(--surface-elevated)] border border-[var(--border-default)] hover:text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)] hover:border-[var(--status-error-border)] rounded-[var(--radius-button)] transition-[var(--transition-color)] flex items-center gap-1.5 disabled:opacity-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)]"
                            title="Delete consultation"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More / End of Results */}
              <div className="relative z-10 mt-8 sm:mt-10">
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-linear-to-r from-transparent via-[var(--divider-warm)] to-[var(--divider-warm)]" />
                      <div
                        className={`flex flex-col items-center transition-all duration-300 ${loadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}
                      >
                        {loadingMore ? (
                          <SpinnerIcon className="w-6 h-6 text-[var(--text-accent)] mb-1.5" />
                        ) : (
                          <span className="text-[var(--decorative-om)] text-xl mb-1">
                            ॰
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-base font-medium text-[var(--text-accent)] group-hover:text-[var(--badge-warm-text)] transition-[var(--transition-color)]">
                          {loadingMore ? (
                            "Loading"
                          ) : (
                            <>
                              Load More
                              <ChevronDownIcon className="w-4 h-4" />
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-linear-to-l from-transparent via-[var(--divider-warm)] to-[var(--divider-warm)]" />
                    </div>
                  </button>
                ) : cases.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-linear-to-r from-transparent via-[var(--divider-warm-subtle)] to-[var(--divider-warm-subtle)]" />
                    <div className="flex flex-col items-center">
                      <span className="text-[var(--decorative-om)] text-xl">
                        ॐ
                      </span>
                      <span className="text-xs text-[var(--text-accent-muted)] mt-1">
                        {cases.length} consultations shown
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-linear-to-l from-transparent via-[var(--divider-warm-subtle)] to-[var(--divider-warm-subtle)]" />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom padding for FAB on mobile */}
      <div className="h-16 sm:hidden" />

      {/* Footer */}
      <Footer />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Consultation"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        loading={!!actionLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

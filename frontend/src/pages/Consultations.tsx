import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { casesApi } from "../lib/api";
import type { Case, CaseStatus } from "../types";
import { Navbar, ConfirmModal, Footer } from "../components";
import { SpinnerIcon, ChevronDownIcon } from "../components/icons";
import { errorMessages } from "../lib/errorMessages";
import { useAuth } from "../contexts/AuthContext";
import { useSEO } from "../hooks";

const CASES_PER_PAGE = 10;

// Status badge component
function StatusBadge({ status }: { status?: CaseStatus }) {
  if (!status || status === "completed") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
        Completed
      </span>
    );
  }
  if (status === "policy_violation") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
        Unable to Process
      </span>
    );
  }
  if (status === "processing" || status === "pending") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
        <span className="animate-pulse">●</span> Processing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
        Failed
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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

  const handleToggleShare = async (e: React.MouseEvent, caseItem: Case) => {
    e.preventDefault();
    e.stopPropagation();
    if (shareLoading) return;

    setShareLoading(caseItem.id);
    setError(null);

    try {
      const newIsPublic = !caseItem.is_public;
      const updated = await casesApi.toggleShare(caseItem.id, newIsPublic);
      setCases((prev) => prev.map((c) => (c.id === caseItem.id ? updated : c)));

      // Auto-copy link when sharing is enabled
      if (newIsPublic && updated.public_slug) {
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

  const handleCopyLink = async (e: React.MouseEvent, caseItem: Case) => {
    e.preventDefault();
    e.stopPropagation();
    if (!caseItem.public_slug) return;

    const url = `${window.location.origin}/c/${caseItem.public_slug}`;
    await navigator.clipboard.writeText(url);
    setCopySuccess(caseItem.id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  useEffect(() => {
    if (authLoading) return;

    casesApi
      .list(0, CASES_PER_PAGE)
      .then((data) => {
        setCases(data);
        setHasMore(data.length === CASES_PER_PAGE);
      })
      .catch((err) => setError(errorMessages.caseLoad(err)))
      .finally(() => setLoading(false));
  }, [authLoading]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const data = await casesApi.list(cases.length, CASES_PER_PAGE);
      setCases((prev) => [...prev, ...data]);
      setHasMore(data.length === CASES_PER_PAGE);
    } catch (err) {
      setError(errorMessages.caseLoad(err));
    } finally {
      setLoadingMore(false);
    }
  }, [cases.length, loadingMore]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading your consultations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />
      <div className="flex-1 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header - stack on mobile, row on desktop */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 mb-2">
                  My Cases
                </h1>
                <p className="text-base sm:text-lg text-gray-600">
                  Your consultation history
                </p>
              </div>
              {/* CTA visible on tablet+ only, FAB handles mobile */}
              <Link
                to="/cases/new"
                className="hidden sm:inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg transition-colors text-sm sm:text-base flex-shrink-0"
              >
                Ask a Question
              </Link>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Anonymous user notice */}
          {!isAuthenticated && cases.length > 0 && (
            <div className="mb-4 sm:mb-6 bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
              <span className="text-amber-600 text-base sm:text-lg">💡</span>
              <div>
                <p className="text-amber-800 text-xs sm:text-sm">
                  These consultations are stored in your browser session.
                  <Link
                    to="/signup"
                    className="ml-1 text-amber-700 hover:text-amber-900 underline font-medium"
                  >
                    Create an account
                  </Link>{" "}
                  to save them permanently and access from any device.
                </p>
              </div>
            </div>
          )}

          {/* Consultations List */}
          {cases.length === 0 ? (
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-8 sm:p-12 text-center">
              <img
                src="/logo.svg"
                alt="Geetanjali"
                loading="lazy"
                className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 sm:mb-6"
              />
              <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">
                You haven't asked any questions yet.
              </p>
              <Link
                to="/cases/new"
                className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-2.5 sm:px-8 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
              >
                Ask Your First Question
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-3 sm:space-y-4">
                {cases.map((case_) => {
                  const isCompleted =
                    !case_.status ||
                    case_.status === "completed" ||
                    case_.status === "policy_violation";
                  // Don't allow sharing policy_violation cases - educational responses aren't meant to be shared
                  const canShare =
                    isCompleted && case_.status !== "policy_violation";

                  return (
                    <div
                      key={case_.id}
                      className={`bg-white rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all border overflow-hidden ${
                        case_.is_public
                          ? "border-green-200 hover:border-green-300"
                          : "border-gray-100 hover:border-red-200"
                      }`}
                    >
                      <Link
                        to={`/cases/${case_.id}`}
                        className="block p-4 sm:p-5 lg:p-6"
                      >
                        <div className="flex justify-between items-start mb-2 sm:mb-3 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                                {case_.title}
                              </h2>
                              <StatusBadge status={case_.status} />
                            </div>
                            <p className="text-xs sm:text-sm text-gray-400">
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
                          {/* Retry button for failed cases */}
                          {case_.status === "failed" && (
                            <button
                              onClick={(e) => handleRetry(e, case_.id)}
                              disabled={actionLoading === case_.id}
                              className="px-2 sm:px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-full transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                              title="Retry analysis"
                            >
                              {actionLoading === case_.id ? "..." : "Retry"}
                            </button>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 mb-2 sm:mb-3">
                          {case_.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {case_.role && case_.role !== "Individual" && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              👤 {case_.role}
                            </span>
                          )}
                          {case_.stakeholders &&
                            case_.stakeholders.length > 0 &&
                            case_.stakeholders[0] !== "self" && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                👥 {case_.stakeholders.join(", ")}
                              </span>
                            )}
                          {case_.horizon && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              ⏱️ {case_.horizon} term
                            </span>
                          )}
                        </div>
                      </Link>

                      {/* Compact share URL (when public) - right aligned */}
                      {case_.is_public && case_.public_slug && (
                        <div className="px-4 sm:px-5 lg:px-6 py-2 border-t border-green-100 flex justify-end">
                          <div className="bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-green-700 font-mono truncate max-w-[180px] sm:max-w-none">
                                {window.location.host}/c/{case_.public_slug}
                              </code>
                              <button
                                onClick={(e) => handleCopyLink(e, case_)}
                                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
                              >
                                {copySuccess === case_.id ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                              Only people with this link can view
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action bar */}
                      <div className="px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 bg-amber-50/50 border-t border-amber-100 flex items-center justify-end gap-2">
                        {/* Share/Unshare button (only for completed cases) */}
                        {canShare && (
                          <button
                            onClick={(e) => handleToggleShare(e, case_)}
                            disabled={shareLoading === case_.id}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                              case_.is_public
                                ? "text-green-700 bg-green-100 hover:bg-green-200 focus-visible:ring-green-500"
                                : "text-amber-700 bg-amber-100 hover:bg-amber-200 focus-visible:ring-amber-500"
                            }`}
                            title={
                              case_.is_public
                                ? "Make private"
                                : "Share consultation"
                            }
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
                            {shareLoading === case_.id
                              ? "..."
                              : case_.is_public
                                ? "Unshare"
                                : "Share"}
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={(e) =>
                            handleDeleteClick(e, case_.id, case_.title)
                          }
                          disabled={actionLoading === case_.id}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
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
                  );
                })}
              </div>

              {/* Load More / End of Results */}
              <div className="mt-8 sm:mt-10">
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-amber-300/70" />
                      <div
                        className={`flex flex-col items-center transition-all duration-300 ${loadingMore ? "scale-95 opacity-70" : "group-hover:scale-105"}`}
                      >
                        {loadingMore ? (
                          <SpinnerIcon className="w-6 h-6 text-amber-500 mb-1.5" />
                        ) : (
                          <span className="text-amber-400/70 text-xl mb-1">
                            ॰
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-base font-medium text-amber-700/80 group-hover:text-amber-800 transition-colors">
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
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-300/50 to-amber-300/70" />
                    </div>
                  </button>
                ) : (
                  cases.length > 0 && (
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-amber-200/60" />
                      <div className="flex flex-col items-center">
                        <span className="text-amber-300/60 text-xl">ॐ</span>
                        <span className="text-xs text-amber-600/40 mt-1">
                          {cases.length} consultations shown
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-200/40 to-amber-200/60" />
                    </div>
                  )
                )}
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

import { useState } from "react";
import { Link } from "react-router-dom";
import type { Case, ShareMode } from "../../types";
import { ShareBar } from "./ShareBar";

interface CaseHeaderProps {
  caseData: Case;
  canSave: boolean;
  canDelete: boolean;
  canShare: boolean;
  shareLoading: boolean;
  copySuccess: boolean;
  onSave: () => void;
  onDeleteClick: () => void;
  onShare: () => void;
  onModeChange: (mode: ShareMode) => void;
  onStopSharing: () => void;
  onCopyShareLink: () => void;
}

export function CaseHeader({
  caseData,
  canSave,
  canDelete,
  canShare,
  shareLoading,
  copySuccess,
  onSave,
  onDeleteClick,
  onShare,
  onModeChange,
  onStopSharing,
  onCopyShareLink,
}: CaseHeaderProps) {
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [shareBarVisible, setShareBarVisible] = useState(false);

  const handleShareClick = () => {
    if (!caseData.is_public) {
      // One-click share with 'full' mode
      onShare();
    } else {
      // Toggle ShareBar visibility
      setShareBarVisible(!shareBarVisible);
    }
  };

  const handleCloseShareBar = () => {
    setShareBarVisible(false);
  };

  return (
    <div className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)] sticky top-14 sm:top-16 z-10">
      {/* Main header row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between">
        <Link
          to="/consultations"
          className="text-[var(--badge-warm-text)] hover:text-[var(--text-accent-hover)] text-sm flex items-center gap-1"
        >
          ← <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="flex gap-1.5 sm:gap-2">
          {/* Save - only for completed cases with content */}
          {canSave && (
            <button
              onClick={onSave}
              className="p-2 sm:px-3 sm:py-1.5 bg-[var(--surface-elevated)] rounded-lg shadow-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)] border border-[var(--border-default)] flex items-center gap-1.5 transition-colors"
              aria-label="Save consultation as file"
            >
              <svg
                className="w-4 h-4 sm:w-3.5 sm:h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span className="hidden sm:inline text-xs">Save</span>
            </button>
          )}

          {/* Share button with popover */}
          {canShare && (
            <div className="relative">
              <button
                onClick={handleShareClick}
                disabled={shareLoading}
                className={`p-2 sm:px-3 sm:py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-all duration-200 ${
                  caseData.is_public
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)] border border-[var(--border-default)]"
                } ${shareLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-label={
                  caseData.is_public ? "Toggle share options" : "Share consultation"
                }
              >
                {caseData.is_public ? (
                  <svg
                    className="w-4 h-4 sm:w-3.5 sm:h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 sm:w-3.5 sm:h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                )}
                <span className="hidden sm:inline text-xs">
                  {shareLoading ? "..." : caseData.is_public ? "Shared" : "Share"}
                </span>
              </button>

              {/* ShareBar popover - positioned relative to button, auto-dismisses */}
              {caseData.is_public && caseData.public_slug && shareBarVisible && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={handleCloseShareBar}
                  />
                  <div className="absolute right-0 top-full mt-2 z-20">
                    <ShareBar
                      publicSlug={caseData.public_slug}
                      shareMode={caseData.share_mode}
                      viewCount={caseData.view_count}
                      copySuccess={copySuccess}
                      isLoading={shareLoading}
                      onCopyLink={onCopyShareLink}
                      onModeChange={onModeChange}
                      onStopSharing={onStopSharing}
                      onClose={handleCloseShareBar}
                      autoDismiss={5000}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Overflow menu (3-dot) for Delete */}
          {canDelete && (
            <div className="relative">
              <button
                onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                className="p-2 bg-[var(--surface-elevated)] rounded-lg shadow-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)] border border-[var(--border-default)] transition-colors"
                aria-label="More options"
                aria-expanded={showOverflowMenu}
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
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>

              {/* Overflow Dropdown */}
              {showOverflowMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowOverflowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 bg-[var(--surface-elevated)] rounded-lg shadow-xl border border-[var(--border-default)] z-20 py-1">
                    <button
                      onClick={() => {
                        setShowOverflowMenu(false);
                        onDeleteClick();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)] flex items-center gap-2"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

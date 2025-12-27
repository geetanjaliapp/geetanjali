import { useState, useEffect, useCallback, useRef } from "react";
import type { ShareMode } from "../../types";

interface ShareBarProps {
  publicSlug: string;
  shareMode: ShareMode | null | undefined;
  viewCount?: number;
  copySuccess: boolean;
  isLoading: boolean;
  onCopyLink: () => void;
  onModeChange: (mode: ShareMode) => void;
  onStopSharing: () => void;
  onClose?: () => void;
  /** Compact mode for list views */
  compact?: boolean;
  /** Auto-dismiss after delay (ms) - closes automatically */
  autoDismiss?: number;
}

export function ShareBar({
  publicSlug,
  shareMode,
  viewCount,
  copySuccess,
  isLoading,
  onCopyLink,
  onModeChange,
  onStopSharing,
  onClose,
  compact = false,
  autoDismiss,
}: ShareBarProps) {
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const currentMode = shareMode || "full";
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after delay
  useEffect(() => {
    if (!autoDismiss || !onClose) return;

    dismissTimerRef.current = setTimeout(() => {
      onClose();
    }, autoDismiss);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [autoDismiss, onClose]);

  // Reset timer on any interaction
  const resetDismissTimer = useCallback(() => {
    if (!autoDismiss || !onClose) return;

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = setTimeout(() => {
      onClose();
    }, autoDismiss);
  }, [autoDismiss, onClose]);

  const handleStopClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetDismissTimer();
    setShowStopConfirm(true);
  };

  const handleConfirmStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStopSharing();
    setShowStopConfirm(false);
  };

  const handleCancelStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetDismissTimer();
    setShowStopConfirm(false);
  };

  const handleModeChange = (e: React.MouseEvent, mode: ShareMode) => {
    e.preventDefault();
    e.stopPropagation();
    resetDismissTimer();
    if (mode !== currentMode && !isLoading) {
      onModeChange(mode);
    }
  };

  const handleCopyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetDismissTimer();
    onCopyLink();
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetDismissTimer();
    window.open(`/c/${publicSlug}`, "_blank", "noopener,noreferrer");
  };

  // Fixed dimensions for consistent sizing (same for both states)
  const barSize = compact ? "h-[64px] min-w-[200px]" : "h-[68px] min-w-[260px]";

  if (showStopConfirm) {
    return (
      <div
        className={`${barSize} bg-[var(--surface-warm)] border border-[var(--border-warm)] rounded-[var(--radius-button)] transition-[var(--transition-all)] ${compact ? "p-2.5" : "p-3"} flex flex-col justify-between`}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p
            className={`font-medium text-[var(--text-secondary)] ${compact ? "text-xs" : "text-sm"}`}
          >
            Stop sharing?
          </p>
          <p
            className={`text-[var(--text-tertiary)] mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}
          >
            The link will stop working.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCancelStop}
            className={`text-[var(--text-secondary)] hover:text-[var(--text-primary)] ${compact ? "text-xs" : "text-sm"}`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmStop}
            disabled={isLoading}
            className={`px-3 py-1 bg-[var(--status-error-text)] text-[var(--text-inverted)] rounded-[var(--radius-button)] font-medium hover:opacity-90 disabled:opacity-50 transition-[var(--transition-color)] ${compact ? "text-xs" : "text-sm"}`}
          >
            {isLoading ? "..." : "Stop"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${barSize} bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-[var(--radius-button)] transition-[var(--transition-all)] ${compact ? "p-2.5" : "p-3"} flex flex-col justify-between`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header row: URL + actions */}
      <div className="flex items-center gap-2">
        <code
          className={`text-[var(--status-success-text)] font-mono truncate flex-1 ${compact ? "text-[10px]" : "text-xs"}`}
        >
          <span className="text-[var(--status-success-text)]/70">
            geetanjaliapp.com
          </span>
          /c/{publicSlug}
        </code>
        <div className="flex items-center gap-1">
          <button
            onClick={handleViewClick}
            className={`p-1 text-[var(--status-success-text)] hover:bg-[var(--status-success-bg)] rounded-[var(--radius-skeleton)] transition-[var(--transition-color)]`}
            title="View public page"
          >
            <svg
              className={compact ? "w-3 h-3" : "w-3.5 h-3.5"}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
          <button
            onClick={handleCopyClick}
            className={`px-2 py-0.5 bg-[var(--status-success-text)] text-[var(--text-inverted)] rounded-[var(--radius-skeleton)] font-medium hover:opacity-90 transition-[var(--transition-color)] ${compact ? "text-[10px]" : "text-xs"}`}
          >
            {copySuccess ? "Copied!" : "Copy"}
          </button>
          {viewCount !== undefined && viewCount > 0 && (
            <span
              className={`text-[var(--text-tertiary)] flex items-center gap-0.5 ${compact ? "text-[10px]" : "text-xs"}`}
            >
              <svg
                className={compact ? "w-2.5 h-2.5" : "w-3 h-3"}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {viewCount}
            </span>
          )}
        </div>
      </div>

      {/* Segmented buttons: Full | Essential || Stop */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[var(--text-tertiary)] ${compact ? "text-[10px]" : "text-xs"}`}
          >
            Show:
          </span>
          <div className="flex rounded-[var(--radius-nav)] overflow-hidden border border-[var(--status-success-border)]">
            <button
              onClick={(e) => handleModeChange(e, "full")}
              disabled={isLoading}
              className={`px-2 py-0.5 transition-[var(--transition-color)] disabled:opacity-50 ${compact ? "text-[10px]" : "text-xs"} ${
                currentMode === "full"
                  ? "bg-[var(--status-success-text)] text-[var(--text-inverted)]"
                  : "bg-[var(--surface-elevated)] text-[var(--status-success-text)] hover:bg-[var(--status-success-bg)]"
              }`}
            >
              Full
            </button>
            <button
              onClick={(e) => handleModeChange(e, "essential")}
              disabled={isLoading}
              className={`px-2 py-0.5 border-l border-[var(--status-success-border)] transition-[var(--transition-color)] disabled:opacity-50 ${compact ? "text-[10px]" : "text-xs"} ${
                currentMode === "essential"
                  ? "bg-[var(--status-success-text)] text-[var(--text-inverted)]"
                  : "bg-[var(--surface-elevated)] text-[var(--status-success-text)] hover:bg-[var(--status-success-bg)]"
              }`}
            >
              Essential
            </button>
            {/* Divider */}
            <div className="w-px bg-[var(--status-success-border)] mx-0.5" />
            <button
              onClick={handleStopClick}
              disabled={isLoading}
              className={`px-2 py-0.5 transition-[var(--transition-color)] disabled:opacity-50 bg-[var(--surface-elevated)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)] ${compact ? "text-[10px]" : "text-xs"}`}
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

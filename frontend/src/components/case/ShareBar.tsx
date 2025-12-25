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
        className={`${barSize} bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg transition-all duration-200 ease-out ${compact ? "p-2.5" : "p-3"} flex flex-col justify-between`}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p
            className={`font-medium text-gray-700 dark:text-gray-300 ${compact ? "text-xs" : "text-sm"}`}
          >
            Stop sharing?
          </p>
          <p
            className={`text-gray-500 dark:text-gray-400 mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}
          >
            The link will stop working.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCancelStop}
            className={`text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 ${compact ? "text-xs" : "text-sm"}`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmStop}
            disabled={isLoading}
            className={`px-3 py-1 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors ${compact ? "text-xs" : "text-sm"}`}
          >
            {isLoading ? "..." : "Stop"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${barSize} bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg transition-all duration-200 ease-out ${compact ? "p-2.5" : "p-3"} flex flex-col justify-between`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header row: URL + actions */}
      <div className="flex items-center gap-2">
        <code
          className={`text-green-700 dark:text-green-300 font-mono truncate flex-1 ${compact ? "text-[10px]" : "text-xs"}`}
        >
          <span className="text-green-600/70 dark:text-green-400/70">geetanjaliapp.com</span>/c/{publicSlug}
        </code>
        <div className="flex items-center gap-1">
          <button
            onClick={handleViewClick}
            className={`p-1 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/50 rounded-sm transition-colors`}
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
            className={`px-2 py-0.5 bg-green-600 text-white rounded-sm font-medium hover:bg-green-700 transition-colors ${compact ? "text-[10px]" : "text-xs"}`}
          >
            {copySuccess ? "Copied!" : "Copy"}
          </button>
          {viewCount !== undefined && viewCount > 0 && (
            <span
              className={`text-gray-500 dark:text-gray-400 flex items-center gap-0.5 ${compact ? "text-[10px]" : "text-xs"}`}
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
            className={`text-gray-500 dark:text-gray-400 ${compact ? "text-[10px]" : "text-xs"}`}
          >
            Show:
          </span>
          <div className="flex rounded-md overflow-hidden border border-green-300 dark:border-green-700">
            <button
              onClick={(e) => handleModeChange(e, "full")}
              disabled={isLoading}
              className={`px-2 py-0.5 transition-colors disabled:opacity-50 ${compact ? "text-[10px]" : "text-xs"} ${
                currentMode === "full"
                  ? "bg-green-600 text-white"
                  : "bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
              }`}
            >
              Full
            </button>
            <button
              onClick={(e) => handleModeChange(e, "essential")}
              disabled={isLoading}
              className={`px-2 py-0.5 border-l border-green-300 dark:border-green-700 transition-colors disabled:opacity-50 ${compact ? "text-[10px]" : "text-xs"} ${
                currentMode === "essential"
                  ? "bg-green-600 text-white"
                  : "bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
              }`}
            >
              Essential
            </button>
            {/* Divider */}
            <div className="w-px bg-green-400 dark:bg-green-600 mx-0.5" />
            <button
              onClick={handleStopClick}
              disabled={isLoading}
              className={`px-2 py-0.5 transition-colors disabled:opacity-50 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 ${compact ? "text-[10px]" : "text-xs"}`}
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

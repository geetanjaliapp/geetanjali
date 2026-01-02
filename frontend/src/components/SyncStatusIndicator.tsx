/**
 * SyncStatusIndicator - Visual feedback for preference sync status
 *
 * Minimal, unobtrusive indicator that shows sync state:
 * - Idle: Nothing shown (default state)
 * - Syncing: Pulse animation (only if >500ms)
 * - Synced: Brief green dot (fades after 1.5s)
 * - Error: Red dot with tap to retry
 * - Offline: Gray dot
 *
 * Part of v1.18.0 accessibility & UX improvements.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useSyncStatus } from "../hooks";

interface SyncStatusIndicatorProps {
  /** Size in pixels (default: 8) */
  size?: number;
  /** Show success state briefly (default: true) */
  showOnSuccess?: boolean;
}

export function SyncStatusIndicator({
  size = 8,
  showOnSuccess = true,
}: SyncStatusIndicatorProps) {
  const { status, error, resync } = useSyncStatus();

  // Track if syncing has been active for >500ms
  const [showSyncing, setShowSyncing] = useState(false);
  const syncingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track brief "synced" display
  const [showSynced, setShowSynced] = useState(false);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track previous status for transitions
  const prevStatusRef = useRef(status);

  // Handle syncing visibility (delay by 500ms)
  useEffect(() => {
    if (status === "syncing") {
      syncingTimerRef.current = setTimeout(() => {
        setShowSyncing(true);
      }, 500);

      return () => {
        if (syncingTimerRef.current) {
          clearTimeout(syncingTimerRef.current);
          syncingTimerRef.current = null;
        }
      };
    } else if (showSyncing) {
      // Only reset via setTimeout to avoid synchronous setState in effect
      const resetTimer = setTimeout(() => {
        setShowSyncing(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [status, showSyncing]);

  // Handle synced visibility (show briefly then fade)
  useEffect(() => {
    // Show "synced" indicator when transitioning from syncing to synced
    if (prevStatusRef.current === "syncing" && status === "synced" && showOnSuccess) {
      // Use setTimeout to avoid synchronous setState
      const showTimer = setTimeout(() => {
        setShowSynced(true);
      }, 0);

      syncedTimerRef.current = setTimeout(() => {
        setShowSynced(false);
      }, 1500);

      prevStatusRef.current = status;

      return () => {
        clearTimeout(showTimer);
        if (syncedTimerRef.current) {
          clearTimeout(syncedTimerRef.current);
        }
      };
    }

    prevStatusRef.current = status;
  }, [status, showOnSuccess]);

  // Handle retry action
  const handleRetry = useCallback(() => {
    resync();
  }, [resync]);

  // Handle keyboard activation for retry
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && status === "error") {
        e.preventDefault();
        handleRetry();
      }
    },
    [status, handleRetry]
  );

  // Determine what to render
  const getIndicatorState = () => {
    if (status === "error") {
      return {
        show: true,
        color: "var(--status-error)",
        animate: false,
        label: error?.message || "Sync failed. Tap to retry.",
        interactive: true,
      };
    }

    if (status === "offline") {
      return {
        show: true,
        color: "var(--text-tertiary)",
        animate: false,
        label: "Offline",
        interactive: false,
      };
    }

    if (showSyncing) {
      return {
        show: true,
        color: "var(--interactive-primary)",
        animate: true,
        label: "Syncing...",
        interactive: false,
      };
    }

    if (showSynced) {
      return {
        show: true,
        color: "var(--status-success)",
        animate: false,
        label: "Synced",
        interactive: false,
      };
    }

    return { show: false };
  };

  const state = getIndicatorState();

  if (!state.show) {
    return null;
  }

  const indicatorStyles: React.CSSProperties = {
    width: size,
    height: size,
    backgroundColor: state.color,
  };

  // Error state is interactive (tap to retry)
  if (state.interactive) {
    return (
      <button
        type="button"
        onClick={handleRetry}
        onKeyDown={handleKeyDown}
        aria-label={state.label}
        className="inline-flex items-center justify-center rounded-full
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
          focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
        style={indicatorStyles}
      />
    );
  }

  return (
    <span
      role="status"
      aria-label={state.label}
      className={`inline-block rounded-full ${
        state.animate ? "animate-pulse" : ""
      } ${showSynced ? "animate-fadeOut" : ""}`}
      style={indicatorStyles}
    />
  );
}

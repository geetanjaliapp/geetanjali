/**
 * SyncToast - Shows a toast notification when favorites sync completes after login
 *
 * This component listens to useSyncedFavorites and shows a brief toast
 * when the initial merge with server completes after user login.
 */

import { useState, useEffect, useCallback } from "react";
import { useSyncedFavorites } from "../hooks";
import { useAuth } from "../contexts/AuthContext";
import { Toast } from "./Toast";

const SYNC_TOAST_KEY = "geetanjali:syncToastSession";

interface ToastState {
  visible: boolean;
  count: number;
}

export function SyncToast() {
  const { isAuthenticated } = useAuth();
  const { didInitialSync, favoritesCount } = useSyncedFavorites();
  const [toastState, setToastState] = useState<ToastState>({
    visible: false,
    count: 0,
  });

  // Show toast when sync completes after login
  useEffect(() => {
    // Guard clauses first
    if (!isAuthenticated) return;
    if (!didInitialSync) return;

    // Check if already shown this session (read from storage)
    try {
      const shownJson = sessionStorage.getItem(SYNC_TOAST_KEY) || "false";
      const alreadyShown = JSON.parse(shownJson);

      // Only show if not already shown
      if (!alreadyShown) {
        // Mark as shown in storage first
        sessionStorage.setItem(SYNC_TOAST_KEY, JSON.stringify(true));
        // Show toast after sync completes.
        // Disable ESLint: This setState is safe because it's a one-time response
        // to the didInitialSync flag changing. The effect only runs once per
        // login session (guarded by sessionStorage), preventing infinite loops.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToastState({ visible: true, count: favoritesCount });
      }
    } catch {
      // Ignore storage errors
    }
  }, [isAuthenticated, didInitialSync, favoritesCount]);

  // Clear session flag on logout so toast shows again on next login
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        sessionStorage.removeItem(SYNC_TOAST_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }, [isAuthenticated]);

  const handleDismiss = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  if (!toastState.visible) return null;

  const message =
    toastState.count > 0
      ? `Favorites synced (${toastState.count})`
      : "Favorites synced";

  return <Toast message={message} duration={3000} onDismiss={handleDismiss} />;
}

/**
 * Hook for syncing newsletter subscription status across devices.
 *
 * On login, checks the server for subscription status and updates localStorage.
 * This ensures that if a user unsubscribes on one device, other devices
 * reflect the correct status on next login.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { newsletterApi } from "../lib/api";
import {
  markNewsletterSubscribed,
  clearNewsletterSubscribed,
} from "../lib/newsletterStorage";

/**
 * Sync newsletter subscription status on login.
 *
 * This hook should be used in a top-level component (e.g., App)
 * to ensure subscription status is synced whenever a user logs in.
 */
export function useNewsletterSync(): void {
  const { user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const wasLoggedOut = previousUserIdRef.current === null;
    const isNowLoggedIn = currentUserId !== null;

    // Detect login (was null, now has user ID)
    if (wasLoggedOut && isNowLoggedIn) {
      syncNewsletterStatus();
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id]);
}

/**
 * Fetch subscription status from server and update localStorage.
 */
async function syncNewsletterStatus(): Promise<void> {
  try {
    const { subscribed } = await newsletterApi.getStatus();

    if (subscribed) {
      markNewsletterSubscribed();
    } else {
      clearNewsletterSubscribed();
    }
  } catch {
    // Silently fail - newsletter status is not critical
    // User can still see accurate status from localStorage (may be stale)
  }
}

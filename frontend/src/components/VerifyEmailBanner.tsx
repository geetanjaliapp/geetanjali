/**
 * VerifyEmailBanner - Subtle reminder for users with unverified email
 *
 * Shows a minimal inline notice below the navbar prompting email verification.
 * Designed to be unobtrusive: no background color, small text, dismissible.
 * Dismissal is stored in localStorage with 7-day expiry.
 */

import { useState } from "react";
import { SpinnerIcon, CloseIcon } from "./icons";
import { STORAGE_KEYS } from "../lib/storage";
import { useResendVerification } from "../hooks";
import { useAuth } from "../contexts/AuthContext";

const DISMISS_EXPIRY_DAYS = 7;
const DISMISS_EXPIRY_MS = DISMISS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Check if the banner was dismissed and dismissal hasn't expired.
 * Cleans up expired/invalid values for storage hygiene.
 */
function isDismissalValid(): boolean {
  try {
    const dismissedAt = localStorage.getItem(STORAGE_KEYS.verifyBannerDismissed);
    if (!dismissedAt) return false;

    const timestamp = parseInt(dismissedAt, 10);
    if (isNaN(timestamp)) {
      // Invalid value - clean up
      localStorage.removeItem(STORAGE_KEYS.verifyBannerDismissed);
      return false;
    }

    const isValid = Date.now() - timestamp < DISMISS_EXPIRY_MS;
    if (!isValid) {
      // Expired - clean up
      localStorage.removeItem(STORAGE_KEYS.verifyBannerDismissed);
    }
    return isValid;
  } catch {
    return false;
  }
}

export function VerifyEmailBanner() {
  const { user, refreshUser } = useAuth();
  const [isDismissed, setIsDismissed] = useState(isDismissalValid);
  const { resend, isResending, message } = useResendVerification();

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEYS.verifyBannerDismissed, Date.now().toString());
    } catch {
      // Ignore storage errors - dismissal still works for this session
    }
  };

  const handleResend = () => {
    resend(refreshUser);
  };

  // Don't show if: not logged in, already verified, or dismissed
  if (!user || user.email_verified || isDismissed) {
    return null;
  }

  return (
    <div
      className="border-b border-gray-200 dark:border-gray-700"
      role="status"
      aria-label="Email verification reminder"
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5">
        <div className="flex items-center justify-center gap-2 text-xs">
          {/* Message */}
          <span className="text-gray-600 dark:text-gray-400">
            Please verify your email.
          </span>

          {/* Resend link */}
          <button
            onClick={handleResend}
            disabled={isResending}
            className="font-medium text-orange-600 dark:text-orange-400
                       hover:text-orange-700 dark:hover:text-orange-300
                       disabled:opacity-50 disabled:cursor-not-allowed
                       inline-flex items-center gap-1
                       focus:outline-none focus:underline"
          >
            {isResending ? (
              <>
                <SpinnerIcon className="w-3 h-3 animate-spin" />
                Sending...
              </>
            ) : (
              "Resend"
            )}
          </button>

          {/* Status message (inline) */}
          {message && (
            <span
              role="alert"
              aria-live={message.type === "error" ? "assertive" : "polite"}
              className={
                message.type === "success"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {message.type === "success" ? "✓ Sent!" : message.text}
            </span>
          )}

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="p-0.5 text-gray-400 dark:text-gray-500
                       hover:text-gray-600 dark:hover:text-gray-300
                       rounded transition-colors
                       focus:outline-none focus:ring-1 focus:ring-gray-400"
            aria-label="Dismiss"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

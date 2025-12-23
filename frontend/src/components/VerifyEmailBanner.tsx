/**
 * VerifyEmailBanner - Reminder banner for users with unverified email
 *
 * Shows a non-intrusive banner prompting users to verify their email.
 * Includes a button to resend the verification email and can be dismissed.
 * Dismissal is stored in localStorage with 7-day expiry (respects user choice
 * while gently reminding after a week).
 */

import { useState } from "react";
import { MailIcon, SpinnerIcon, CloseIcon } from "./icons";
import { STORAGE_KEYS } from "../lib/storage";
import { useResendVerification } from "../hooks";

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

interface VerifyEmailBannerProps {
  onVerified?: () => void;
}

export function VerifyEmailBanner({ onVerified }: VerifyEmailBannerProps) {
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
    resend(onVerified);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800"
      role="status"
      aria-label="Email verification reminder"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          {/* Icon and message */}
          <div className="flex items-center gap-2 flex-1">
            <MailIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Please verify your email address to access all features.
            </p>
          </div>

          {/* Resend button */}
          <button
            onClick={handleResend}
            disabled={isResending}
            className="text-sm font-medium text-amber-700 dark:text-amber-300
                       hover:text-amber-900 dark:hover:text-amber-100
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-1.5 whitespace-nowrap
                       focus:outline-none focus:underline"
          >
            {isResending ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Resend verification email"
            )}
          </button>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="p-1 text-amber-600 dark:text-amber-400
                       hover:text-amber-800 dark:hover:text-amber-200
                       hover:bg-amber-100 dark:hover:bg-amber-800/30
                       rounded transition-colors
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label="Dismiss verification reminder"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Status message */}
        {message && (
          <p
            role="alert"
            aria-live={message.type === "error" ? "assertive" : "polite"}
            className={`mt-2 text-sm ${
              message.type === "success"
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * VerifyEmailBanner - Reminder banner for users with unverified email
 *
 * Shows a non-intrusive banner prompting users to verify their email.
 * Includes a button to resend the verification email.
 */

import { useState } from "react";
import { api } from "../lib/api";
import { MailIcon, SpinnerIcon } from "./icons";

interface VerifyEmailBannerProps {
  onVerified?: () => void;
}

export function VerifyEmailBanner({ onVerified }: VerifyEmailBannerProps) {
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setMessage(null);

    try {
      await api.post("/auth/resend-verification");
      setMessage({
        type: "success",
        text: "Verification email sent! Check your inbox.",
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        // If already verified, trigger refresh
        if (axiosErr.response?.data?.detail?.includes("already verified")) {
          setMessage({ type: "success", text: "Your email is already verified!" });
          onVerified?.();
          return;
        }
        setMessage({
          type: "error",
          text: axiosErr.response?.data?.detail || "Failed to send email. Try again later.",
        });
      } else {
        setMessage({
          type: "error",
          text: "Failed to send email. Try again later.",
        });
      }
    } finally {
      setIsResending(false);
    }
  };

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

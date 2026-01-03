/**
 * useResendVerification - Shared hook for resending email verification
 *
 * Used by both VerifyEmailBanner and Settings page to ensure consistent
 * behavior and avoid code duplication.
 */

import { useState, useCallback } from "react";
import { api } from "../lib/api";
import { isAxiosError } from "../lib/errorMessages";
import { useAuth } from "../contexts/AuthContext";

interface VerificationMessage {
  type: "success" | "error";
  text: string;
}

interface UseResendVerificationResult {
  /** Whether a resend request is in progress */
  isResending: boolean;
  /** Current message to display (success or error) */
  message: VerificationMessage | null;
  /** Clear the current message */
  clearMessage: () => void;
  /** Resend verification email */
  resend: (onSuccess?: () => void) => Promise<void>;
}

/**
 * Hook for handling verification email resend logic.
 *
 * @example
 * ```tsx
 * const { resend, isResending, message } = useResendVerification();
 *
 * <button onClick={() => resend()} disabled={isResending}>
 *   {isResending ? "Sending..." : "Resend verification email"}
 * </button>
 * {message && <p className={message.type}>{message.text}</p>}
 * ```
 */
export function useResendVerification(): UseResendVerificationResult {
  const { refreshUser } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<VerificationMessage | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const resend = useCallback(
    async (onSuccess?: () => void) => {
      setIsResending(true);
      setMessage(null);

      try {
        await api.post("/auth/resend-verification");
        setMessage({
          type: "success",
          text: "Verification email sent! Check your inbox.",
        });
        onSuccess?.();
      } catch (err: unknown) {
        if (isAxiosError(err)) {
          const detail = err.response?.data?.detail;
          const detailStr = typeof detail === "string" ? detail : "";

          // If already verified, refresh user state and show success
          if (detailStr.includes("already verified")) {
            setMessage({
              type: "success",
              text: "Your email is already verified!",
            });
            // Refresh user state to update email_verified flag
            // Wrapped in try-catch to ensure success message shows even if refresh fails
            try {
              await refreshUser();
            } catch {
              // Refresh failed (network error) - message still shows, user can refresh manually
            }
            onSuccess?.();
            return;
          }

          setMessage({
            type: "error",
            text: detailStr || "Failed to send email. Try again later.",
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
    },
    [refreshUser],
  );

  return { isResending, message, clearMessage, resend };
}

export default useResendVerification;

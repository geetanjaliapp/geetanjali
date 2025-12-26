import { useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircleIcon,
  XCircleIcon,
  SpinnerIcon,
  MailIcon,
} from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

type VerifyState = "confirm" | "loading" | "success" | "error" | "already_verified";

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const { refreshUser } = useAuth();

  // Validate token upfront - if invalid, initialize with error state
  const initialState = useMemo<{
    state: VerifyState;
    error: string;
  }>(() => {
    if (!token) {
      return { state: "error", error: "Invalid verification link" };
    }
    return { state: "confirm", error: "" };
  }, [token]);

  const [state, setState] = useState<VerifyState>(initialState.state);
  const [errorMessage, setErrorMessage] = useState<string>(initialState.error);

  const handleConfirm = useCallback(async () => {
    if (!token) return;

    setState("loading");
    try {
      const response = await api.post(`/auth/verify-email/${token}`);

      // Refresh user data to update email_verified status
      await refreshUser();

      if (response.data.status === "already_verified") {
        setState("already_verified");
      } else {
        setState("success");
      }
    } catch (err: unknown) {
      setState("error");
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setErrorMessage(
          axiosErr.response?.data?.detail || "Failed to verify email"
        );
      } else {
        setErrorMessage("Failed to verify email");
      }
    }
  }, [token, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] px-4">
      <div className="max-w-md w-full bg-[var(--surface-elevated)] rounded-2xl shadow-xl p-8 text-center">
        {state === "confirm" && (
          <>
            <MailIcon className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Verify Your Email
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              Click the button below to verify your email address and complete your account setup.
            </p>
            <button
              onClick={handleConfirm}
              className="w-full px-6 py-3 bg-linear-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all focus:outline-hidden focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)]"
            >
              Verify Email Address
            </button>
          </>
        )}

        {state === "loading" && (
          <div role="status" aria-live="polite" aria-label="Verifying email">
            <SpinnerIcon className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Verifying your email...
            </h1>
            <p className="text-[var(--text-tertiary)]">
              Please wait while we confirm your email address.
            </p>
          </div>
        )}

        {state === "success" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-[var(--status-success-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Email Verified!
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              Your email has been verified successfully. You now have full access to all features.
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-linear-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
            >
              Continue to Geetanjali
            </Link>
          </>
        )}

        {state === "already_verified" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Already Verified
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              Your email address is already verified. You're all set!
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-linear-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
            >
              Continue to Geetanjali
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <XCircleIcon className="w-16 h-16 text-[var(--status-error-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Verification Failed
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              {errorMessage}
            </p>
            <div className="space-y-3">
              <Link
                to="/settings"
                className="block px-6 py-3 bg-linear-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
              >
                Go to Settings
              </Link>
              <Link
                to="/"
                className="block px-6 py-3 border border-[var(--border-default)] text-[var(--text-secondary)] font-medium rounded-lg hover:bg-[var(--surface-muted)] transition-all"
              >
                Go Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircleIcon,
  XCircleIcon,
  SpinnerIcon,
  MailIcon,
} from "../components/icons";
import { markNewsletterSubscribed } from "../components";
import { api } from "../lib/api";

type VerifyState =
  | "confirm"
  | "loading"
  | "success"
  | "error"
  | "already_verified";

export default function NewsletterVerify() {
  const { token } = useParams<{ token: string }>();

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
  const [email, setEmail] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>(initialState.error);

  const handleConfirm = useCallback(async () => {
    if (!token) return;

    setState("loading");
    try {
      const response = await api.post(`/newsletter/verify/${token}`);
      setEmail(response.data.email);
      // Mark as subscribed in localStorage (hides home page card)
      markNewsletterSubscribed();
      if (response.data.message.includes("already")) {
        setState("already_verified");
      } else {
        setState("success");
      }
    } catch (err: unknown) {
      setState("error");
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setErrorMessage(
          axiosErr.response?.data?.detail || "Failed to verify subscription",
        );
      } else {
        setErrorMessage("Failed to verify subscription");
      }
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] px-4">
      <div className="max-w-md w-full bg-[var(--surface-elevated)] rounded-[var(--radius-modal)] shadow-[var(--shadow-modal)] p-8 text-center">
        {state === "confirm" && (
          <>
            <MailIcon className="w-16 h-16 text-[var(--text-accent)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Confirm Your Subscription
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              Click the button below to complete your Daily Wisdom subscription.
            </p>
            <button
              onClick={handleConfirm}
              className="w-full px-6 py-3 bg-linear-to-r from-[var(--interactive-gradient-from)] to-[var(--interactive-gradient-to)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] hover:from-[var(--interactive-gradient-from-hover)] hover:to-[var(--interactive-gradient-to-hover)] transition-[var(--transition-all)] focus:outline-hidden focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)]"
            >
              Confirm Subscription
            </button>
          </>
        )}

        {state === "loading" && (
          <>
            <SpinnerIcon className="w-16 h-16 text-[var(--text-accent)] animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Verifying your subscription...
            </h1>
            <p className="text-[var(--text-tertiary)]">
              Please wait while we confirm your email.
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-[var(--status-success-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Subscription Confirmed!
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              Welcome to Daily Wisdom! You'll receive your first verse at your
              preferred time.
            </p>
            {email && (
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Subscribed as: {email}
              </p>
            )}
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-linear-to-r from-[var(--interactive-gradient-from)] to-[var(--interactive-gradient-to)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] hover:from-[var(--interactive-gradient-from-hover)] hover:to-[var(--interactive-gradient-to-hover)] transition-[var(--transition-all)]"
            >
              Explore Geetanjali
            </Link>
          </>
        )}

        {state === "already_verified" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-[var(--status-info-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Already Verified
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              Your subscription is already active. You're all set to receive
              Daily Wisdom!
            </p>
            {email && (
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Subscribed as: {email}
              </p>
            )}
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-linear-to-r from-[var(--interactive-gradient-from)] to-[var(--interactive-gradient-to)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] hover:from-[var(--interactive-gradient-from-hover)] hover:to-[var(--interactive-gradient-to-hover)] transition-[var(--transition-all)]"
            >
              Explore Geetanjali
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <XCircleIcon className="w-16 h-16 text-[var(--status-error-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Verification Failed
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">{errorMessage}</p>
            <div className="space-y-3">
              <Link
                to="/settings#newsletter"
                className="block px-6 py-3 bg-linear-to-r from-[var(--interactive-gradient-from)] to-[var(--interactive-gradient-to)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] hover:from-[var(--interactive-gradient-from-hover)] hover:to-[var(--interactive-gradient-to-hover)] transition-[var(--transition-all)]"
              >
                Subscribe Again
              </Link>
              <Link
                to="/"
                className="block px-6 py-3 border border-[var(--border-default)] text-[var(--text-secondary)] font-medium rounded-[var(--radius-button)] hover:bg-[var(--surface-muted)] transition-all"
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

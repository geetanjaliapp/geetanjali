import { useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircleIcon,
  XCircleIcon,
  SpinnerIcon,
  MailIcon,
} from "../components/icons";
import { api } from "../lib/api";

type UnsubscribeState = "confirm" | "loading" | "success" | "already_unsubscribed" | "error";

export default function NewsletterUnsubscribe() {
  const { token } = useParams<{ token: string }>();

  // Validate token upfront - if invalid, initialize with error state
  const initialState = useMemo<{
    state: UnsubscribeState;
    error: string;
  }>(() => {
    if (!token) {
      return { state: "error", error: "Invalid unsubscribe link" };
    }
    return { state: "confirm", error: "" };
  }, [token]);

  const [state, setState] = useState<UnsubscribeState>(initialState.state);
  const [email, setEmail] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>(initialState.error);

  const handleConfirm = useCallback(async () => {
    if (!token) return;

    setState("loading");
    try {
      const response = await api.post(`/newsletter/unsubscribe/${token}`);
      setEmail(response.data.email);
      if (response.data.message.includes("already")) {
        setState("already_unsubscribed");
      } else {
        setState("success");
      }
    } catch (err: unknown) {
      setState("error");
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setErrorMessage(
          axiosErr.response?.data?.detail || "Failed to unsubscribe"
        );
      } else {
        setErrorMessage("Failed to unsubscribe");
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
              Unsubscribe from Daily Wisdom?
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              You'll stop receiving daily verse emails. You can always subscribe again later.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleConfirm}
                className="w-full px-6 py-3 bg-[var(--interactive-secondary-bg)] border border-[var(--interactive-secondary-border)] text-[var(--interactive-secondary-text)] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-all focus:outline-hidden focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)]"
              >
                Yes, Unsubscribe
              </button>
              <Link
                to="/"
                className="block px-6 py-3 border border-[var(--border-default)] text-[var(--text-secondary)] font-medium rounded-[var(--radius-button)] hover:bg-[var(--surface-muted)] transition-all"
              >
                Cancel
              </Link>
            </div>
          </>
        )}

        {state === "loading" && (
          <>
            <SpinnerIcon className="w-16 h-16 text-[var(--text-accent)] animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Processing your request...
            </h1>
            <p className="text-[var(--text-tertiary)]">
              Please wait while we update your subscription.
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-[var(--status-success-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Unsubscribed
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              You've been unsubscribed from Daily Wisdom. We're sorry to see you
              go!
            </p>
            {email && (
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Unsubscribed: {email}
              </p>
            )}
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Changed your mind?
              </p>
              <Link
                to="/settings#newsletter"
                className="inline-block px-6 py-3 bg-linear-to-r from-[var(--interactive-gradient-from)] to-[var(--interactive-gradient-to)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] hover:from-[var(--interactive-gradient-from-hover)] hover:to-[var(--interactive-gradient-to-hover)] transition-[var(--transition-all)]"
              >
                Subscribe Again
              </Link>
            </div>
          </>
        )}

        {state === "already_unsubscribed" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-[var(--status-info-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Already Unsubscribed
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              You've already been unsubscribed from Daily Wisdom.
            </p>
            {email && (
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Email: {email}
              </p>
            )}
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Want to come back?
              </p>
              <Link
                to="/settings#newsletter"
                className="inline-block px-6 py-3 bg-linear-to-r from-[var(--interactive-gradient-from)] to-[var(--interactive-gradient-to)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] hover:from-[var(--interactive-gradient-from-hover)] hover:to-[var(--interactive-gradient-to-hover)] transition-[var(--transition-all)]"
              >
                Subscribe Again
              </Link>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <XCircleIcon className="w-16 h-16 text-[var(--status-error-text)] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Something Went Wrong
            </h1>
            <p className="text-[var(--text-tertiary)] mb-6">
              {errorMessage}
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-linear-to-r from-[var(--interactive-gradient-from)] to-[var(--interactive-gradient-to)] text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] hover:from-[var(--interactive-gradient-from-hover)] hover:to-[var(--interactive-gradient-to-hover)] transition-[var(--transition-all)]"
            >
              Go Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

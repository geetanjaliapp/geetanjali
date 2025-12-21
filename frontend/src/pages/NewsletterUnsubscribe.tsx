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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        {state === "confirm" && (
          <>
            <MailIcon className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Unsubscribe from Daily Wisdom?
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You'll stop receiving daily verse emails. You can always subscribe again later.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleConfirm}
                className="w-full px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                Yes, Unsubscribe
              </button>
              <Link
                to="/"
                className="block px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </Link>
            </div>
          </>
        )}

        {state === "loading" && (
          <>
            <SpinnerIcon className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Processing your request...
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we update your subscription.
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Unsubscribed
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You've been unsubscribed from Daily Wisdom. We're sorry to see you
              go!
            </p>
            {email && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Unsubscribed: {email}
              </p>
            )}
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Changed your mind?
              </p>
              <Link
                to="/settings#newsletter"
                className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
              >
                Subscribe Again
              </Link>
            </div>
          </>
        )}

        {state === "already_unsubscribed" && (
          <>
            <CheckCircleIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Already Unsubscribed
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You've already been unsubscribed from Daily Wisdom.
            </p>
            {email && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Email: {email}
              </p>
            )}
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Want to come back?
              </p>
              <Link
                to="/settings#newsletter"
                className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
              >
                Subscribe Again
              </Link>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Something Went Wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage}
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
            >
              Go Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

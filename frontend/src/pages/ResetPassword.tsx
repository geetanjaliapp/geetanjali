import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { Navbar } from "../components";
import { getErrorMessage } from "../lib/errorMessages";
import { useSEO } from "../hooks";

export default function ResetPassword() {
  useSEO({
    title: "Set New Password",
    description: "Set a new password for your Geetanjali account.",
    canonical: "/reset-password",
    noIndex: true,
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if no token provided
  useEffect(() => {
    if (!token) {
      navigate("/forgot-password");
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password requirements (must match Signup.tsx)
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (!/[a-zA-Z]/.test(password)) {
      setError("Password must contain at least one letter");
      return;
    }

    if (!/\d/.test(password)) {
      setError("Password must contain at least one number");
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token!, password);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err, "general"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null; // Will redirect via useEffect
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="max-w-md w-full space-y-6 sm:space-y-8 text-center">
            <div>
              <Link
                to="/"
                className="inline-block mb-3 sm:mb-4 hover:opacity-80 transition-opacity"
              >
                <img
                  src="/logo.svg"
                  alt="Geetanjali"
                  loading="lazy"
                  className="h-12 w-12 sm:h-16 sm:w-16 mx-auto"
                />
              </Link>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[var(--status-success-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--status-success-text)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-primary)]">
                Password Reset
              </h2>
              <p className="mt-3 text-sm text-[var(--text-tertiary)] max-w-sm mx-auto">
                Your password has been reset successfully. You can now sign in
                with your new password.
              </p>
            </div>

            <div className="pt-4">
              <Link
                to="/login"
                className="w-full inline-flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[var(--interactive-primary)] hover:opacity-90 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)] focus:ring-[var(--border-focus)] transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)]">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          <div className="text-center">
            <Link
              to="/"
              className="inline-block mb-3 sm:mb-4 hover:opacity-80 transition-opacity"
            >
              <img
                src="/logo.svg"
                alt="Geetanjali"
                loading="lazy"
                className="h-12 w-12 sm:h-16 sm:w-16 mx-auto"
              />
            </Link>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-primary)]">
              Set New Password
            </h2>
            <p className="mt-1.5 sm:mt-2 text-sm text-[var(--text-tertiary)]">
              Enter your new password below
            </p>
          </div>

          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg bg-[var(--status-error-bg)] p-3 sm:p-4"
              >
                <div className="text-sm text-[var(--status-error-text)]">
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                >
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] placeholder-[var(--text-muted)] text-[var(--text-primary)] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-base sm:text-sm"
                  placeholder="••••••••"
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  At least 8 characters with one letter and one number
                </p>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] placeholder-[var(--text-muted)] text-[var(--text-primary)] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-base sm:text-sm"
                  placeholder="Re-enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[var(--interactive-primary)] hover:opacity-90 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)] focus:ring-[var(--border-focus)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </div>

            <div className="text-center text-sm">
              <Link
                to="/login"
                className="font-medium text-[var(--interactive-ghost-text)] hover:text-[var(--text-link-hover)]"
              >
                Back to Sign In
              </Link>
            </div>
          </form>

          <div className="text-center text-xs text-[var(--text-muted)]">
            <p>Ethical guidance rooted in timeless wisdom</p>
          </div>
        </div>
      </div>
    </div>
  );
}

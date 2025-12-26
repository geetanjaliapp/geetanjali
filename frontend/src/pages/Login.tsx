import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components";
import { errorMessages } from "../lib/errorMessages";
import { useSEO } from "../hooks";

export default function Login() {
  useSEO({
    title: "Sign In",
    description:
      "Sign in to your Geetanjali account to access your ethical consultations.",
    canonical: "/login",
    noIndex: true, // Auth pages shouldn't be indexed
  });
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(errorMessages.login(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-page)]">
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
              Sign In
            </h2>
            <p className="mt-1.5 sm:mt-2 text-sm text-[var(--text-tertiary)]">
              Access your saved consultations and continue your journey
            </p>
          </div>

          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-[var(--radius-button)] bg-[var(--status-error-bg)] p-3 sm:p-4"
              >
                <div className="text-sm text-[var(--status-error-text)]">
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] placeholder-[var(--text-muted)] text-[var(--text-primary)] rounded-[var(--radius-button)] focus:outline-hidden focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent text-base sm:text-sm"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[var(--text-secondary)]"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[var(--text-accent)] hover:text-[var(--text-accent-hover)]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] placeholder-[var(--text-muted)] text-[var(--text-primary)] rounded-[var(--radius-button)] focus:outline-hidden focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent text-base sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-[var(--radius-button)] text-[var(--interactive-primary-text)] bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)] focus:ring-[var(--focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed transition-[var(--transition-color)]"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>

            <div className="text-center text-sm">
              <span className="text-[var(--text-tertiary)]">
                New here?{" "}
              </span>
              <Link
                to="/signup"
                className="font-semibold text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:underline"
              >
                Create an account →
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

import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/auth";
import { Navbar } from "../components";
import { getErrorMessage } from "../lib/errorMessages";
import { useSEO } from "../hooks";

export default function ForgotPassword() {
  useSEO({
    title: "Reset Password",
    description: "Reset your Geetanjali account password.",
    canonical: "/forgot-password",
    noIndex: true,
  });

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err, "general"));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-red-50">
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
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
                Check Your Email
              </h2>
              <p className="mt-3 text-sm text-gray-600 max-w-sm mx-auto">
                If an account exists with{" "}
                <span className="font-medium text-gray-900">{email}</span>, you
                will receive a password reset link shortly.
              </p>
              <p className="mt-4 text-xs text-gray-500">
                Don't see the email? Check your spam folder.
              </p>
            </div>

            <div className="pt-4">
              <Link
                to="/login"
                className="text-sm font-medium text-orange-600 hover:text-orange-500"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-red-50">
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
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
              Reset Password
            </h2>
            <p className="mt-1.5 sm:mt-2 text-sm text-gray-600">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 p-3 sm:p-4">
                <div className="text-sm text-red-600">{error}</div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
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
                className="block w-full px-3 py-2.5 sm:py-2 border border-amber-200 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base sm:text-sm"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>

            <div className="text-center text-sm">
              <Link
                to="/login"
                className="font-medium text-orange-600 hover:text-orange-500"
              >
                Back to Sign In
              </Link>
            </div>
          </form>

          <div className="text-center text-xs text-gray-500">
            <p>Ethical guidance rooted in timeless wisdom</p>
          </div>
        </div>
      </div>
    </div>
  );
}

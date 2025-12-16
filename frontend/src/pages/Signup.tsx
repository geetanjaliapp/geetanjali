import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components";
import { errorMessages } from "../lib/errorMessages";
import { useSEO } from "../hooks";

export default function Signup() {
  useSEO({
    title: "Sign Up",
    description:
      "Create a Geetanjali account to save your ethical consultations and access wisdom from the Bhagavad Geeta.",
    canonical: "/signup",
    noIndex: true, // Auth pages shouldn't be indexed
  });
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

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
      await signup({ name, email, password });
      navigate("/");
    } catch (err) {
      setError(errorMessages.signup(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-red-50">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">
        <div className="max-w-md w-full space-y-5 sm:space-y-6">
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
              Create Account
            </h2>
            <p className="mt-1.5 sm:mt-2 text-sm text-gray-600">
              Save your consultations and continue your journey anytime
            </p>
          </div>

          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 p-3 sm:p-4">
                <div className="text-sm text-red-600">{error}</div>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 border border-amber-200 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base sm:text-sm"
                  placeholder="Your name"
                />
              </div>
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
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 border border-amber-200 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base sm:text-sm"
                  placeholder="••••••••"
                />
                <p className="mt-1 text-xs text-gray-500">
                  At least 8 characters with one letter and one number
                </p>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
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
                  className="block w-full px-3 py-2.5 sm:py-2 border border-amber-200 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating account..." : "Sign up"}
              </button>
            </div>

            <div className="text-center text-sm">
              <span className="text-gray-600">Already a member? </span>
              <Link
                to="/login"
                className="font-semibold text-orange-600 hover:text-orange-500 hover:underline"
              >
                Sign in →
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

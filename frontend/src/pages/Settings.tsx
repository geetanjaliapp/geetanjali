import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar, markNewsletterSubscribed } from "../components";
import { Footer } from "../components/Footer";
import { GoalSelector } from "../components/GoalSelector";
import { TimeSelector, type SendTime } from "../components/TimeSelector";
import {
  SunIcon,
  CheckIcon,
  MailIcon,
  HeartIcon,
} from "../components/icons";
import { useSyncedGoal, useSyncedFavorites, useSyncedReading, useSEO } from "../hooks";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type SubscriptionStatus = "idle" | "pending" | "subscribed";

/**
 * Extract name from email address.
 * e.g., "vikram.sharma@example.com" -> "Vikram"
 */
function getNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  if (!localPart) return "";
  // Take first part before any dots/underscores, capitalize
  const firstName = localPart.split(/[._-]/)[0] ?? localPart;
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

/**
 * Get initials from name
 */
function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function Settings() {
  useSEO({
    title: "Settings",
    description:
      "Manage your Geetanjali preferences and Daily Wisdom subscription.",
    canonical: "/settings",
  });

  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { selectedGoals } = useSyncedGoal();
  const { favoritesCount } = useSyncedFavorites();
  const { position } = useSyncedReading();

  // Refs for form validation focus
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Newsletter form state - prefill from user if logged in
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendTime, setSendTime] = useState<SendTime>("morning");
  const [status, setStatus] = useState<SubscriptionStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from logged-in user
  useEffect(() => {
    if (user) {
      if (user.email && !email) {
        setEmail(user.email);
      }
      if (user.name && !name) {
        setName(user.name);
      }
    }
  }, [user, email, name]);

  // Derived name from email (shown as placeholder, used if name is empty)
  const derivedName = useMemo(() => getNameFromEmail(email), [email]);

  // Effective name to use (user input or derived from email)
  const effectiveName = name.trim() || derivedName;

  // Selected goals labels for display
  const selectedGoalLabels = selectedGoals.map((g) => g.label).join(", ");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Focus email input if empty
    if (!email.trim()) {
      emailInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post("/newsletter/subscribe", {
        email: email.trim(),
        name: effectiveName || null,
        goal_ids: selectedGoals.map((g) => g.id),
        send_time: sendTime,
      });

      if (response.data.requires_verification === false) {
        // Already subscribed
        setStatus("subscribed");
        markNewsletterSubscribed();
      } else {
        // Verification email sent
        setStatus("pending");
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(
          axiosErr.response?.data?.detail ||
            "Something went wrong. Please try again."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  const getTimeLabel = (time: SendTime): string => {
    const labels = {
      morning: "6 AM IST",
      afternoon: "12:30 PM IST",
      evening: "6 PM IST",
    };
    return labels[time];
  };

  // Reading position display
  const readingDisplay = position?.chapter
    ? `Chapter ${position.chapter}, Verse ${position.verse || 1}`
    : "Not started";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 animate-fadeIn">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 dark:text-gray-100 mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account and preferences.
          </p>
        </div>

        {/* Section 1: Account */}
        <section className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100">
                Account
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isAuthenticated ? "Your account details" : "You're browsing as a guest"}
              </p>
            </div>
          </div>

          {isAuthenticated ? (
            // Authenticated state
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-600 text-white flex items-center justify-center text-lg font-medium flex-shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {user?.name || user?.email?.split("@")[0]}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckIcon className="w-4 h-4" />
                  Synced across devices
                </p>
                <button
                  onClick={handleLogout}
                  className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            // Guest state
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-400 dark:bg-gray-600 text-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Guest
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Your data is saved locally on this device. Create an account to sync across devices.
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/signup"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                    >
                      <span>✨</span>
                      Create account
                    </Link>
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 font-medium transition-colors"
                    >
                      Already have one? Sign in →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Learning Goals */}
        <section className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100">
                Learning Goals
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                What brings you to the Geeta?
              </p>
            </div>
          </div>

          <GoalSelector />

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Your goals personalize verse recommendations and daily wisdom emails.
          </p>
        </section>

        {/* Section 3: Daily Wisdom */}
        <section className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <SunIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100">
                Daily Wisdom
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Start each day with a verse chosen for your journey
              </p>
            </div>
          </div>

          {status === "subscribed" ? (
            // Subscribed state
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
                  <CheckIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800 dark:text-green-300 mb-1">
                    You're subscribed{effectiveName ? `, ${effectiveName}` : ""}
                  </h3>
                  <p className="text-green-700 dark:text-green-400 text-sm mb-4">
                    Daily verses
                    {selectedGoalLabels
                      ? ` for "${selectedGoalLabels}"`
                      : ""}{" "}
                    arrive around {getTimeLabel(sendTime)}.
                  </p>
                  <p className="text-green-600 dark:text-green-500 text-sm">
                    Subscribed as: {email}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      className="min-h-[44px] px-4 py-2 text-sm text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 active:bg-green-100 dark:active:bg-green-900/40 font-medium rounded-lg transition-colors"
                      onClick={() => setStatus("idle")}
                    >
                      Change preferences
                    </button>
                    <button
                      type="button"
                      className="min-h-[44px] px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded-lg transition-colors"
                    >
                      Unsubscribe
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : status === "pending" ? (
            // Pending verification state
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-800/40 text-amber-600 dark:text-amber-400">
                  <MailIcon className="w-8 h-8" />
                </div>
              </div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">
                Check your email
              </h3>
              <p className="text-amber-700 dark:text-amber-400 text-sm mb-4">
                We've sent a confirmation link to <strong>{email}</strong>.
                <br />
                Click the link to activate your subscription.
              </p>
              <button
                type="button"
                className="min-h-[44px] px-4 py-2 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:bg-amber-200 dark:active:bg-amber-900/50 font-medium rounded-lg transition-colors"
                onClick={() => setStatus("idle")}
              >
                Use a different email
              </button>
            </div>
          ) : (
            // Subscription form
            <form onSubmit={handleSubscribe} className="space-y-6">
              {/* Note about goals */}
              {selectedGoals.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                  Verses will be selected based on your goals: <strong>{selectedGoalLabels}</strong>
                </p>
              )}

              {/* Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="newsletter-name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Your name
                  </label>
                  <input
                    type="text"
                    id="newsletter-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={derivedName || "How should we greet you?"}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base sm:text-sm placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="newsletter-email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Your email
                  </label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    id="newsletter-email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base sm:text-sm placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  When would you like to receive verses?
                </label>
                <TimeSelector
                  value={sendTime}
                  onChange={setSendTime}
                  disabled={isSubmitting}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm"
                >
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {isSubmitting ? "Subscribing..." : "Subscribe to Daily Wisdom"}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-right">
                  Unsubscribe anytime. We respect your inbox.
                </p>
              </div>
            </form>
          )}
        </section>

        {/* Section 4: Appearance */}
        <section className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100">
                Appearance
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Theme and display preferences
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Theme</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Currently following your system settings
                </p>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                System
              </span>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Use the theme toggle in the navigation bar for quick switching. Manual theme selection coming soon.
            </p>
          </div>
        </section>

        {/* Section 5: Your Data */}
        <section className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100">
                Your Data
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                What we've saved for you
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Favorites */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <HeartIcon className="w-5 h-5 text-red-400" filled />
                <span className="text-gray-700 dark:text-gray-300">Favorites</span>
              </div>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {favoritesCount} {favoritesCount === 1 ? "verse" : "verses"}
              </span>
            </div>

            {/* Reading progress */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">Reading progress</span>
              </div>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {readingDisplay}
              </span>
            </div>

            {/* Goals */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-purple-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">Learning goals</span>
              </div>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {selectedGoals.length} selected
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Your data is stored {isAuthenticated ? "securely in the cloud" : "locally on this device"}.
              {!isAuthenticated && " Create an account to sync across devices."}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled
                className="px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed"
              >
                Export my data (coming soon)
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

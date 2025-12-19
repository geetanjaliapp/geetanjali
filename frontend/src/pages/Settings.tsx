import { useState, useEffect, useMemo, useRef } from "react";
import { Navbar, markNewsletterSubscribed } from "../components";
import { Footer } from "../components/Footer";
import { GoalSelector } from "../components/GoalSelector";
import { TimeSelector, type SendTime } from "../components/TimeSelector";
import { SunIcon, CheckIcon, MailIcon } from "../components/icons";
import { useLearningGoal, useSEO } from "../hooks";
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

export default function Settings() {
  useSEO({
    title: "Settings",
    description:
      "Manage your Geetanjali preferences and Daily Wisdom subscription.",
    canonical: "/settings",
  });

  const { user } = useAuth();
  const { selectedGoals } = useLearningGoal();

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
      const response = await api.post("/api/v1/newsletter/subscribe", {
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

  const getTimeLabel = (time: SendTime): string => {
    const labels = {
      morning: "6 AM IST",
      afternoon: "12:30 PM IST",
      evening: "6 PM IST",
    };
    return labels[time];
  };

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
            Manage your preferences and subscriptions.
          </p>
        </div>

        {/* Daily Wisdom Section */}
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

                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      type="button"
                      className="text-sm text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
                      onClick={() => setStatus("idle")}
                    >
                      Change preferences
                    </button>
                    <button
                      type="button"
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
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
                className="text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
                onClick={() => setStatus("idle")}
              >
                Use a different email
              </button>
            </div>
          ) : (
            // Subscription form
            <form onSubmit={handleSubscribe} className="space-y-6">
              {/* Goal Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What brings you to the Geeta?
                </label>
                <GoalSelector />
              </div>

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
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
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

        {/* Appearance Section - Placeholder for future */}
        <section className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8">
          <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100 mb-4">
            Appearance
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Theme and display preferences follow your system settings. More
            customization options coming soon.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}

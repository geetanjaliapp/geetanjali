import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar, markNewsletterSubscribed, ConfirmModal } from "../components";
import { Footer } from "../components/Footer";
import { GoalSelector } from "../components/GoalSelector";
import { TimeSelector, type SendTime } from "../components/TimeSelector";
import {
  SunIcon,
  CheckIcon,
  MailIcon,
  HeartIcon,
  GoalIconsById,
} from "../components/icons";
import { useSyncedGoal, useSyncedFavorites, useSyncedReading, useSEO } from "../hooks";
import { useAuth } from "../contexts/AuthContext";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import { api } from "../lib/api";

type SubscriptionStatus = "idle" | "pending" | "subscribed";
type FontSize = "small" | "medium" | "large";

const READING_PREFS_KEY = "geetanjali:readingDefaults";

/**
 * Extract name from email address.
 */
function getNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  if (!localPart) return "";
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

/**
 * Load reading defaults from localStorage
 */
function loadReadingDefaults(): { fontSize: FontSize; showIAST: boolean; showHindi: boolean; showEnglish: boolean } {
  try {
    const stored = localStorage.getItem(READING_PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }
  return { fontSize: "medium", showIAST: true, showHindi: true, showEnglish: true };
}

export default function Settings() {
  useSEO({
    title: "Settings",
    description: "Manage your Geetanjali preferences and Daily Wisdom subscription.",
    canonical: "/settings",
  });

  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { selectedGoals } = useSyncedGoal();
  const { favoritesCount } = useSyncedFavorites();
  const { position } = useSyncedReading();

  // Newsletter form state
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendTime, setSendTime] = useState<SendTime>("morning");
  const [status, setStatus] = useState<SubscriptionStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGoalsPrompt, setShowGoalsPrompt] = useState(false);

  // Theme from context
  const { theme, setTheme } = useTheme();

  // Reading preferences
  const [readingPrefs, setReadingPrefs] = useState(loadReadingDefaults);

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Prefill from logged-in user
  useEffect(() => {
    if (user) {
      if (user.email && !email) setEmail(user.email);
      if (user.name && !name) setName(user.name);
    }
  }, [user, email, name]);

  // Save reading prefs
  useEffect(() => {
    try {
      localStorage.setItem(READING_PREFS_KEY, JSON.stringify(readingPrefs));
    } catch {
      // Ignore
    }
  }, [readingPrefs]);

  const derivedName = useMemo(() => getNameFromEmail(email), [email]);
  const effectiveName = name.trim() || derivedName;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      emailInputRef.current?.focus();
      return;
    }

    // Prompt for goals if none selected
    if (selectedGoals.length === 0 && !showGoalsPrompt) {
      setShowGoalsPrompt(true);
      return;
    }

    setIsSubmitting(true);
    setShowGoalsPrompt(false);

    try {
      const response = await api.post("/newsletter/subscribe", {
        email: email.trim(),
        name: effectiveName || null,
        goal_ids: selectedGoals.map((g) => g.id),
        send_time: sendTime,
      });

      if (response.data.requires_verification === false) {
        setStatus("subscribed");
        markNewsletterSubscribed();
      } else {
        setStatus("pending");
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || "Something went wrong. Please try again.");
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

  const handleExportData = () => {
    const data = {
      exported_at: new Date().toISOString(),
      version: "1.0",
      favorites: JSON.parse(localStorage.getItem("geetanjali_favorites") || "[]"),
      reading: {
        position: JSON.parse(localStorage.getItem("geetanjali:readingPosition") || "null"),
        settings: JSON.parse(localStorage.getItem("geetanjali:readingSettings") || "{}"),
      },
      goals: JSON.parse(localStorage.getItem("geetanjali:learningGoals") || "{}"),
      theme: localStorage.getItem("geetanjali:theme") || "system",
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geetanjali-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteLocalData = async () => {
    setIsDeleting(true);
    try {
      // Clear all local data
      const keysToRemove = [
        "geetanjali_favorites",
        "geetanjali:learningGoals",
        "geetanjali:readingPosition",
        "geetanjali:readingSettings",
        "geetanjali:theme",
        "geetanjali:readingDefaults",
      ];
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Reload page to reset all state
      window.location.reload();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await api.delete("/auth/account");

      // Clear local data
      const keysToRemove = [
        "geetanjali_favorites",
        "geetanjali:learningGoals",
        "geetanjali:readingPosition",
        "geetanjali:readingSettings",
        "geetanjali:theme",
        "geetanjali:readingDefaults",
      ];
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Redirect to home
      navigate("/");
      window.location.reload();
    } catch (err) {
      console.error("Failed to delete account:", err);
      setIsDeletingAccount(false);
      setShowDeleteAccountConfirm(false);
    }
  };

  const getTimeLabel = (time: SendTime): string => {
    const labels = { morning: "6 AM IST", afternoon: "12:30 PM IST", evening: "6 PM IST" };
    return labels[time];
  };

  const readingDisplay = position?.chapter
    ? `Chapter ${position.chapter}, Verse ${position.verse || 1}`
    : "Not started";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-gray-100 mb-1">
            Settings
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage your account and preferences
          </p>
        </div>

        {/* Section 1: Account (Full Width) */}
        <section id="account" className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-4 scroll-mt-20">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Account</h2>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-600 text-white flex items-center justify-center text-base font-medium flex-shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {user?.name || user?.email?.split("@")[0]}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1">
                  <CheckIcon className="w-3 h-3" />
                  Synced across devices
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="w-10 h-10 rounded-full bg-gray-400 dark:bg-gray-600 text-white flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">Guest</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Data saved locally on this device</p>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/signup"
                  className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
                >
                  Create account
                </Link>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* 2-Column Grid: Goals + Newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Learning Goals */}
          <section id="goals" className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 scroll-mt-20">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Learning Goals</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              What brings you to the Geeta?
            </p>
            <GoalSelector />
          </section>

          {/* Daily Wisdom */}
          <section id="newsletter" className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 scroll-mt-20">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <SunIcon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Daily Wisdom</h2>
            </div>

            {status === "subscribed" ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      Subscribed{effectiveName ? ` as ${effectiveName}` : ""}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                      Verses arrive at {getTimeLabel(sendTime)}
                    </p>
                    <button
                      onClick={() => setStatus("idle")}
                      className="text-xs text-green-600 dark:text-green-500 hover:underline mt-1"
                    >
                      Change preferences
                    </button>
                  </div>
                </div>
              </div>
            ) : status === "pending" ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
                <MailIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-amber-900 dark:text-amber-300">Check your email</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Confirmation sent to <strong>{email}</strong>
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="text-xs text-amber-600 dark:text-amber-500 hover:underline mt-2"
                >
                  Use different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                {/* Goals prompt */}
                {showGoalsPrompt && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                    <p className="text-sm text-purple-800 dark:text-purple-300 mb-2">
                      🎯 Select learning goals for personalized verses
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowGoalsPrompt(false);
                          // Scroll to goals section
                          document.getElementById("goals")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded"
                      >
                        Select goals ↑
                      </button>
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Subscribe anyway
                      </button>
                    </div>
                  </div>
                )}

                {/* Reserved space for selected goals - always visible */}
                <div className="flex items-center gap-2 h-10 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Goals:</span>
                  {selectedGoals.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedGoals.map((goal) => {
                        const IconComponent = GoalIconsById[goal.id];
                        return (
                          <div
                            key={goal.id}
                            className="w-7 h-7 rounded-full bg-amber-200 dark:bg-amber-700/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-sm"
                            title={goal.label}
                          >
                            {IconComponent && <IconComponent className="w-4 h-4" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {/* Placeholder circles to match height */}
                      <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600" />
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Select above
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={derivedName || "Your name"}
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <input
                    ref={emailInputRef}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <TimeSelector value={sendTime} onChange={setSendTime} disabled={isSubmitting} />

                {error && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {isSubmitting ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
            )}
          </section>
        </div>

        {/* 2-Column Grid: Reading Preferences + Appearance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Reading Preferences */}
          <section id="reading" className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 scroll-mt-20">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reading Preferences</h2>
            </div>

            <div className="space-y-3">
              {/* Font Size */}
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1.5">Font size</label>
                <div className="flex gap-1">
                  {(["small", "medium", "large"] as FontSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setReadingPrefs((p) => ({ ...p, fontSize: size }))}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        readingPrefs.fontSize === size
                          ? "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400"
                          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section toggles */}
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1.5">Default sections</label>
                <div className="space-y-1.5">
                  {[
                    { key: "showIAST", label: "IAST (Romanized)" },
                    { key: "showHindi", label: "Hindi translation" },
                    { key: "showEnglish", label: "English translation" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={readingPrefs[key as keyof typeof readingPrefs] as boolean}
                        onChange={(e) =>
                          setReadingPrefs((p) => ({ ...p, [key]: e.target.checked }))
                        }
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section id="appearance" className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 scroll-mt-20">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
            </div>

            <div>
              <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1.5">Theme</label>
              <div className="flex gap-1">
                {(["system", "light", "dark"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      theme === t
                        ? "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400"
                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {t === "system" ? "System" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {theme === "system"
                  ? "Following your device settings"
                  : `Always use ${theme} mode`}
              </p>
            </div>
          </section>
        </div>

        {/* Your Data (Full Width) */}
        <section id="data" className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-4 scroll-mt-20">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Data</h2>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mb-3 text-sm">
            <div className="flex items-center gap-2">
              <HeartIcon className="w-4 h-4 text-red-400" filled />
              <span className="text-gray-700 dark:text-gray-300">
                {favoritesCount} {favoritesCount === 1 ? "favorite" : "favorites"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300">{readingDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300">{selectedGoals.length} goals</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {isAuthenticated ? "Synced securely in the cloud" : "Stored locally on this device"}
          </p>

          <button
            onClick={handleExportData}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Export my data
          </button>
        </section>

        {/* Danger Zone */}
        <section id="danger" className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 scroll-mt-20">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Danger Zone</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
            >
              Delete local data
            </button>
            {isAuthenticated && (
              <button
                onClick={() => setShowDeleteAccountConfirm(true)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
              >
                Delete account
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {isAuthenticated
              ? "Delete local data clears this device only. Delete account removes all data from the cloud permanently."
              : "Deleting local data will clear favorites, reading progress, and preferences from this device."
            }
          </p>
        </section>
      </main>

      <Footer />

      {/* Delete local data confirmation modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteLocalData}
        title="Delete local data?"
        message="This will clear all your favorites, reading progress, goals, and preferences from this device. This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        variant="danger"
        loading={isDeleting}
      />

      {/* Delete account confirmation modal */}
      <ConfirmModal
        isOpen={showDeleteAccountConfirm}
        onCancel={() => setShowDeleteAccountConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="We're sad to see you go"
        message="This will permanently delete your account and all associated data including consultations, preferences, and favorites. You can create a new account with the same email later if you wish to return."
        confirmLabel={isDeletingAccount ? "Deleting..." : "Delete my account"}
        variant="danger"
        loading={isDeletingAccount}
        requireText="goodbye"
      />
    </div>
  );
}

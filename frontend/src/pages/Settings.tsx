import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Navbar,
  markNewsletterSubscribed,
  ConfirmModal,
  ThemeSelector,
} from "../components";
import { Footer } from "../components/Footer";
import { GoalSelector } from "../components/GoalSelector";
import { TimeSelector, type SendTime } from "../components/TimeSelector";
import {
  SunIcon,
  CheckIcon,
  MailIcon,
  HeartIcon,
  SpinnerIcon,
} from "../components/icons";
import {
  useSyncedGoal,
  useSyncedFavorites,
  useSyncedReading,
  useSEO,
  useResendVerification,
} from "../hooks";
import { useAuth } from "../contexts/AuthContext";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import { FONT_FAMILY_OPTIONS, FONT_FAMILIES } from "../config/fonts";
import { api, newsletterApi, type NewsletterPreferences } from "../lib/api";
import {
  exportUserData,
  clearAllLocalStorage,
  clearAllSessionStorage,
  STORAGE_KEYS,
  getStorageItem,
  setStorageItem,
} from "../lib/storage";

type SubscriptionStatus = "idle" | "pending" | "subscribed";
type FontSize = "small" | "medium" | "large";
type DefaultVersesTab =
  | "default"
  | "featured"
  | "for-you"
  | "favorites"
  | "all";

/** Section IDs for collapsible content in ReadingMode */
type SectionPrefs = {
  iast: boolean;
  insight: boolean;
  hindi: boolean;
  english: boolean;
};

const DEFAULT_SECTION_PREFS: SectionPrefs = {
  iast: true,
  insight: true,
  hindi: true,
  english: true,
};

/**
 * Load section preferences from localStorage (shared with VerseFocus)
 */
function loadSectionPrefs(): SectionPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.readingSectionPrefs);
    if (stored) {
      return { ...DEFAULT_SECTION_PREFS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore
  }
  return DEFAULT_SECTION_PREFS;
}

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

  // Newsletter form state
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendTime, setSendTime] = useState<SendTime>("morning");
  const [status, setStatus] = useState<SubscriptionStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGoalsPrompt, setShowGoalsPrompt] = useState(false);

  // Existing subscription state (for authenticated users)
  const [existingSubscription, setExistingSubscription] =
    useState<NewsletterPreferences | null>(null);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);
  const [showSubscribeOther, setShowSubscribeOther] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Theme from context
  const { theme, setTheme, fontFamily, setFontFamily } = useTheme();

  // Reading preferences (font size via useSyncedReading, sections via localStorage)
  const { settings: readingSettings, setFontSize } = useSyncedReading();
  const [sectionPrefs, setSectionPrefs] =
    useState<SectionPrefs>(loadSectionPrefs);

  // Default Verses tab preference
  const [defaultVersesTab, setDefaultVersesTab] = useState<DefaultVersesTab>(
    () =>
      getStorageItem<DefaultVersesTab>(
        STORAGE_KEYS.defaultVersesTab,
        "default",
      ),
  );

  const handleDefaultTabChange = (tab: DefaultVersesTab) => {
    setDefaultVersesTab(tab);
    setStorageItem(STORAGE_KEYS.defaultVersesTab, tab);
  };

  // Email verification resend (shared hook with VerifyEmailBanner)
  const {
    resend: resendVerification,
    isResending: isResendingVerification,
    message: verificationMessage,
  } = useResendVerification();

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] =
    useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Prefill from logged-in user
  useEffect(() => {
    if (user) {
      if (user.email && !email) setEmail(user.email);
      if (user.name && !name) setName(user.name);
    }
  }, [user, email, name]);

  // Fetch newsletter subscription status for authenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      setExistingSubscription(null);
      return;
    }

    const fetchStatus = async () => {
      setIsFetchingStatus(true);
      try {
        const response = await newsletterApi.getStatus();
        if (response.subscribed && response.preferences) {
          setExistingSubscription(response.preferences);
          // Prefill form with existing preferences for editing
          if (response.preferences.name) setName(response.preferences.name);
          setSendTime(response.preferences.send_time as SendTime);
        } else {
          setExistingSubscription(null);
        }
      } catch (err) {
        console.error("Failed to fetch newsletter status:", err);
        setExistingSubscription(null);
      } finally {
        setIsFetchingStatus(false);
      }
    };

    fetchStatus();
  }, [isAuthenticated]);

  // Save section prefs to localStorage (shared with VerseFocus)
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.readingSectionPrefs, sectionPrefs);
  }, [sectionPrefs]);

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
        // If this was the account email, refresh subscription status
        if (
          isAuthenticated &&
          email.trim().toLowerCase() === user?.email?.toLowerCase()
        ) {
          const statusResponse = await newsletterApi.getStatus();
          if (statusResponse.subscribed && statusResponse.preferences) {
            setExistingSubscription(statusResponse.preferences);
          }
        }
      } else {
        setStatus("pending");
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(
          axiosErr.response?.data?.detail ||
            "Something went wrong. Please try again.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing subscription preferences
  const handleUpdatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(false);
    setIsUpdatingPrefs(true);

    try {
      const updated = await newsletterApi.updateMyPreferences({
        name: name.trim() || null,
        goal_ids: selectedGoals.map((g) => g.id),
        send_time: sendTime,
      });
      setExistingSubscription(updated);
      setUpdateSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setUpdateError(
          axiosErr.response?.data?.detail || "Failed to update preferences.",
        );
      } else {
        setUpdateError("Failed to update preferences.");
      }
    } finally {
      setIsUpdatingPrefs(false);
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
    const data = exportUserData();

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
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
      // Clear all local data using centralized registry
      clearAllLocalStorage();
      clearAllSessionStorage();

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

      // Clear all local data using centralized registry
      clearAllLocalStorage();
      clearAllSessionStorage();

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
    const labels = {
      morning: "6 AM IST",
      afternoon: "12:30 PM IST",
      evening: "6 PM IST",
    };
    return labels[time];
  };

  const readingDisplay = position?.chapter
    ? `Chapter ${position.chapter}, Verse ${position.verse || 1}`
    : "Not started";

  return (
    <div className="min-h-screen bg-[var(--surface-page)] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-heading text-[var(--text-primary)] mb-1">
            Settings
          </h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            Manage your account and preferences
          </p>
        </div>

        {/* Section 1: Account (Full Width) */}
        <section
          id="account"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 mb-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-[var(--radius-button)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]">
              <svg
                className="w-5 h-5"
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
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Account
            </h2>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[var(--radius-avatar)] bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] flex items-center justify-center text-base font-medium shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--text-primary)]">
                  {user?.name || user?.email?.split("@")[0]}
                </p>
                <p className="text-sm text-[var(--text-muted)] truncate">
                  {user?.email}
                </p>
                {user?.email_verified ? (
                  <p className="text-xs text-[var(--status-success-text)] mt-0.5 flex items-center gap-1">
                    <CheckIcon className="w-3 h-3" />
                    Verified · Synced across devices
                  </p>
                ) : (
                  <div className="mt-0.5">
                    <button
                      onClick={() => resendVerification()}
                      disabled={isResendingVerification}
                      className="text-xs text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] flex items-center gap-1 disabled:opacity-50"
                    >
                      {isResendingVerification ? (
                        <>
                          <SpinnerIcon className="w-3 h-3 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          Email not verified – Resend
                        </>
                      )}
                    </button>
                    {verificationMessage && (
                      <p
                        role="alert"
                        aria-live={
                          verificationMessage.type === "error"
                            ? "assertive"
                            : "polite"
                        }
                        className={`text-xs mt-1 ${
                          verificationMessage.type === "success"
                            ? "text-[var(--status-success-text)]"
                            : "text-[var(--status-error-text)]"
                        }`}
                      >
                        {verificationMessage.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-[var(--surface-warm)] border border-[var(--border-warm)] rounded-[var(--radius-button)] p-3">
              <div className="w-10 h-10 rounded-[var(--radius-avatar)] bg-[var(--avatar-placeholder-bg)] text-[var(--text-inverted)] flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  Guest
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Data saved locally on this device
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/signup"
                  className="px-3 py-1.5 text-sm bg-[var(--interactive-primary)] hover:opacity-90 text-[var(--interactive-primary-text)] font-medium rounded-[var(--radius-button)] transition-[var(--transition-color)]"
                >
                  Create account
                </Link>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Learning Goals (Full Width) */}
        <section
          id="goals"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 mb-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-[var(--radius-button)] bg-[var(--section-icon-goals-bg)] text-[var(--section-icon-goals-text)]">
              <svg
                className="w-5 h-5"
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
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Learning Goals
            </h2>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mb-3">
            What brings you to the Geeta?
          </p>
          <GoalSelector />

          {/* Default Verses Tab */}
          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Default Verses tab
              </label>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-3">
                When you open Verses
              </p>
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2">
                {[
                  { value: "default", label: "Default" },
                  { value: "featured", label: "Featured" },
                  ...(selectedGoals.length > 0 &&
                  selectedGoals.some((g) => g.id !== "exploring")
                    ? [{ value: "for-you", label: "For You" }]
                    : []),
                  { value: "favorites", label: "Favorites" },
                  { value: "all", label: "All" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`inline-flex items-center px-2.5 py-1 rounded-[var(--radius-chip)] text-xs sm:text-sm cursor-pointer transition-[var(--transition-color)] whitespace-nowrap ${
                      defaultVersesTab === option.value
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-[var(--chip-selected-ring)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-tertiary)] hover:bg-[var(--interactive-secondary-hover-bg)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="defaultVersesTab"
                      value={option.value}
                      checked={defaultVersesTab === option.value}
                      onChange={(e) =>
                        handleDefaultTabChange(
                          e.target.value as DefaultVersesTab,
                        )
                      }
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Daily Wisdom (Full Width) */}
        <section
          id="newsletter"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 mb-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-[var(--radius-button)] bg-[var(--section-icon-newsletter-bg)] text-[var(--text-accent)]">
              <SunIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Daily Wisdom
            </h2>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mb-4 ml-9">
            A verse each day, personalized to your learning goals
          </p>

          {/* Loading state while fetching subscription status */}
          {isFetchingStatus ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-[var(--interactive-contextual)] border-t-transparent rounded-[var(--radius-avatar)] animate-spin" />
            </div>
          ) : existingSubscription ? (
            /* Authenticated user with existing subscription - show update form */
            <div className="space-y-3">
              {/* Subscribed status badge */}
              <div className="flex items-center gap-2 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-[var(--radius-button)] px-3 py-2">
                <CheckIcon className="w-4 h-4 text-[var(--status-success-text)]" />
                <span className="text-sm text-[var(--status-success-text)]">
                  Subscribed as <strong>{existingSubscription.email}</strong>
                </span>
              </div>

              {/* Update preferences form */}
              <form onSubmit={handleUpdatePreferences} className="space-y-4">
                {/* Goals connection hint - only show if no goals selected */}
                {selectedGoals.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] bg-[var(--surface-muted)] rounded-[var(--radius-button)] px-3 py-2">
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      <button
                        type="button"
                        onClick={() =>
                          document
                            .getElementById("goals")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }
                        className="text-[var(--text-link)] hover:underline"
                      >
                        Select learning goals
                      </button>{" "}
                      to receive personalized verses
                    </span>
                  </div>
                )}

                {/* Name input */}
                <div>
                  <label htmlFor="newsletter-name" className="sr-only">
                    Your name
                  </label>
                  <input
                    id="newsletter-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={derivedName || "Your name"}
                    aria-describedby={
                      updateError ? "newsletter-prefs-error" : undefined
                    }
                    className="w-full px-3 py-2 text-sm border border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent"
                  />
                </div>

                <TimeSelector
                  value={sendTime}
                  onChange={setSendTime}
                  disabled={isUpdatingPrefs}
                />

                {updateError && (
                  <p
                    id="newsletter-prefs-error"
                    role="alert"
                    className="text-xs text-[var(--status-error-text)] bg-[var(--status-error-bg)] rounded-[var(--radius-skeleton)] px-2 py-1"
                  >
                    {updateError}
                  </p>
                )}

                {updateSuccess && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-xs text-[var(--status-success-text)] bg-[var(--status-success-bg)] rounded-[var(--radius-skeleton)] px-2 py-1"
                  >
                    Preferences updated!
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isUpdatingPrefs}
                  className="w-full bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] disabled:bg-[var(--interactive-primary-disabled-bg)] disabled:text-[var(--interactive-primary-disabled-text)] text-[var(--interactive-primary-text)] text-sm font-medium px-4 py-2 rounded-[var(--radius-button)] transition-[var(--transition-color)]"
                >
                  {isUpdatingPrefs ? "Saving..." : "Update preferences"}
                </button>
              </form>

              {/* Expandable: Subscribe another email */}
              <div className="border-t border-[var(--border-default)] pt-3">
                <button
                  type="button"
                  onClick={() => setShowSubscribeOther(!showSubscribeOther)}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-[var(--transition-color)]"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${showSubscribeOther ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  Subscribe another email
                </button>

                {showSubscribeOther && (
                  <form onSubmit={handleSubscribe} className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="subscribe-other-name"
                          className="sr-only"
                        >
                          Name
                        </label>
                        <input
                          id="subscribe-other-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Name"
                          className="w-full px-3 py-2 text-sm border border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="subscribe-other-email"
                          className="sr-only"
                        >
                          Email address
                        </label>
                        <input
                          id="subscribe-other-email"
                          ref={emailInputRef}
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Different email"
                          aria-describedby={
                            error ? "subscribe-other-error" : undefined
                          }
                          className="w-full px-3 py-2 text-sm border border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent"
                        />
                      </div>
                    </div>

                    {error && (
                      <p
                        id="subscribe-other-error"
                        role="alert"
                        className="text-xs text-[var(--status-error-text)] bg-[var(--status-error-bg)] rounded-[var(--radius-skeleton)] px-2 py-1"
                      >
                        {error}
                      </p>
                    )}

                    {status === "pending" && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="bg-[var(--surface-warm)] border border-[var(--border-warm)] rounded-[var(--radius-button)] p-2 text-center"
                      >
                        <p className="text-xs text-[var(--text-accent)]">
                          Confirmation sent to <strong>{email}</strong>
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[var(--interactive-secondary-bg)] hover:opacity-90 disabled:opacity-60 text-[var(--interactive-secondary-text)] border border-[var(--interactive-secondary-border)] text-sm font-medium px-4 py-1.5 rounded-[var(--radius-button)] transition-[var(--transition-color)]"
                    >
                      {isSubmitting ? "Subscribing..." : "Subscribe this email"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : status === "subscribed" ? (
            /* Just subscribed successfully (non-account email or guest) */
            <div
              role="status"
              aria-live="polite"
              className="bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-[var(--radius-button)] p-3"
            >
              <div className="flex items-start gap-2">
                <CheckIcon className="w-5 h-5 text-[var(--status-success-text)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--status-success-text)]">
                    Subscribed{effectiveName ? ` as ${effectiveName}` : ""}
                  </p>
                  <p className="text-xs text-[var(--status-success-text)] mt-0.5">
                    Verses arrive at {getTimeLabel(sendTime)}
                  </p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="text-xs text-[var(--status-success-text)] hover:underline mt-1"
                  >
                    Change preferences
                  </button>
                </div>
              </div>
            </div>
          ) : status === "pending" ? (
            /* Awaiting email verification */
            <div
              role="status"
              aria-live="polite"
              className="bg-[var(--surface-warm)] border border-[var(--border-warm)] rounded-[var(--radius-button)] p-3 text-center"
            >
              <MailIcon className="w-6 h-6 text-[var(--text-accent)] mx-auto mb-2" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Check your email
              </p>
              <p className="text-xs text-[var(--text-accent)] mt-1">
                Confirmation sent to <strong>{email}</strong>
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="text-xs text-[var(--text-accent)] hover:underline mt-2"
              >
                Use different email
              </button>
            </div>
          ) : (
            /* Default: Subscribe form */
            <form onSubmit={handleSubscribe} className="space-y-4">
              {/* Goals connection hint - only show if no goals selected */}
              {selectedGoals.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] bg-[var(--surface-muted)] rounded-[var(--radius-button)] px-3 py-2">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("goals")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="text-[var(--text-link)] hover:underline"
                    >
                      Select learning goals
                    </button>{" "}
                    above to receive personalized verses
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="newsletter-anon-name" className="sr-only">
                    Your name
                  </label>
                  <input
                    id="newsletter-anon-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={derivedName || "Your name"}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="newsletter-anon-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="newsletter-anon-email"
                    ref={emailInputRef}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    aria-describedby={
                      error ? "newsletter-anon-error" : undefined
                    }
                    className="w-full px-3 py-2 text-sm border border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent"
                  />
                </div>
              </div>

              <TimeSelector
                value={sendTime}
                onChange={setSendTime}
                disabled={isSubmitting}
              />

              {error && (
                <p
                  id="newsletter-anon-error"
                  role="alert"
                  className="text-xs text-[var(--status-error-text)] bg-[var(--status-error-bg)] rounded-[var(--radius-skeleton)] px-2 py-1"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] disabled:bg-[var(--interactive-primary-disabled-bg)] disabled:text-[var(--interactive-primary-disabled-text)] text-[var(--interactive-primary-text)] text-sm font-medium px-4 py-2 rounded-[var(--radius-button)] transition-[var(--transition-color)]"
              >
                {isSubmitting ? "Subscribing..." : "Subscribe"}
              </button>
            </form>
          )}
        </section>

        {/* 2-Column Grid: Reading Preferences + Appearance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Reading Preferences */}
          <section
            id="reading"
            className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 scroll-mt-20"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-[var(--radius-button)] bg-[var(--section-icon-reading-bg)] text-[var(--section-icon-reading-text)]">
                <svg
                  className="w-5 h-5"
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
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Reading Preferences
              </h2>
            </div>

            <div className="space-y-3">
              {/* Font Size */}
              <div>
                <label className="text-sm text-[var(--text-secondary)] block mb-1.5">
                  Font size
                </label>
                <div className="flex gap-1">
                  {(["small", "medium", "large"] as FontSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-[var(--radius-button)] transition-[var(--transition-color)] ${
                        readingSettings.fontSize === size
                          ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                          : "bg-[var(--surface-muted)] text-[var(--text-tertiary)] hover:bg-[var(--surface-field)]"
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Style */}
              <div>
                <label className="text-sm text-[var(--text-secondary)] block mb-1.5">
                  Font style
                </label>
                <div className="flex gap-1">
                  {FONT_FAMILY_OPTIONS.map((family) => (
                    <button
                      key={family}
                      onClick={() => setFontFamily(family)}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-[var(--radius-button)] transition-[var(--transition-color)] ${
                        fontFamily === family
                          ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                          : "bg-[var(--surface-muted)] text-[var(--text-tertiary)] hover:bg-[var(--surface-field)]"
                      }`}
                      title={FONT_FAMILIES[family].description}
                    >
                      {FONT_FAMILIES[family].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section toggles - controls which sections are expanded by default in Reading Mode */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-sm text-[var(--text-secondary)]">
                    Default sections
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded-[var(--radius-skeleton)]">
                    This device
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Unchecked sections will start collapsed in Reading Mode
                </p>
                <div className="space-y-1.5">
                  {[
                    { key: "iast" as const, label: "IAST (Romanized)" },
                    { key: "insight" as const, label: "Leadership Insight" },
                    { key: "hindi" as const, label: "Hindi translation" },
                    { key: "english" as const, label: "English translation" },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={sectionPrefs[key]}
                        onChange={(e) =>
                          setSectionPrefs((p) => ({
                            ...p,
                            [key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded-[var(--radius-skeleton)] border-[var(--border-default)] text-[var(--interactive-primary)] focus:ring-[var(--border-focus)]"
                      />
                      <span className="text-sm text-[var(--text-secondary)]">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section
            id="appearance"
            className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 scroll-mt-20"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-[var(--radius-button)] bg-[var(--section-icon-appearance-bg)] text-[var(--section-icon-appearance-text)]">
                <svg
                  className="w-5 h-5"
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Appearance
              </h2>
            </div>

            {/* Theme Mode (Light/Dark/System) */}
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-1.5">
                Mode
              </label>
              <div className="flex gap-1">
                {(["system", "light", "dark"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-[var(--radius-button)] transition-[var(--transition-color)] ${
                      theme === t
                        ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)] ring-1 ring-inset ring-[var(--chip-selected-ring)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-tertiary)] hover:bg-[var(--surface-field)]"
                    }`}
                  >
                    {t === "system"
                      ? "System"
                      : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {theme === "system"
                  ? "Following your device settings"
                  : `Always use ${theme} mode`}
              </p>
            </div>

            {/* Color Palette Selector */}
            <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
              <ThemeSelector />
            </div>
          </section>
        </div>

        {/* Your Data (Full Width) */}
        <section
          id="data"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 mb-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-[var(--radius-button)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
              <svg
                className="w-5 h-5"
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
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Your Data
            </h2>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mb-3 text-sm">
            <div className="flex items-center gap-2">
              <HeartIcon
                className="w-4 h-4 text-[var(--decorative-heart)]"
                filled
              />
              <span className="text-[var(--text-secondary)]">
                {favoritesCount}{" "}
                {favoritesCount === 1 ? "favorite" : "favorites"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[var(--section-icon-reading-text)]"
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
              <span className="text-[var(--text-secondary)]">
                {readingDisplay}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[var(--section-icon-goals-text)]"
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
              <span className="text-[var(--text-secondary)]">
                {selectedGoals.length} goals
              </span>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] mb-3">
            {isAuthenticated
              ? "Synced securely in the cloud"
              : "Stored locally on this device"}
          </p>

          <button
            onClick={handleExportData}
            className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-muted)] hover:bg-[var(--interactive-secondary-hover-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)]"
          >
            Export my data
          </button>
        </section>

        {/* Danger Zone */}
        <section
          id="danger"
          className="border border-dashed border-[var(--border-default)] rounded-[var(--radius-card)] p-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-[var(--radius-button)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Danger Zone
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm font-medium text-[var(--status-error-text)] bg-[var(--status-error-bg)] hover:bg-[var(--status-error-hover-bg)] border border-[var(--status-error-border)] hover:border-[var(--status-error-hover-border)] active:bg-[var(--status-error-active-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
            >
              Delete local data
            </button>
            {isAuthenticated && (
              <button
                onClick={() => setShowDeleteAccountConfirm(true)}
                className="px-3 py-1.5 text-sm font-medium text-[var(--status-error-text)] bg-[var(--status-error-bg)] hover:bg-[var(--status-error-hover-bg)] border border-[var(--status-error-border)] hover:border-[var(--status-error-hover-border)] active:bg-[var(--status-error-active-bg)] rounded-[var(--radius-button)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
              >
                Delete account
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {isAuthenticated
              ? "Delete local data clears this device only. Delete account removes all data from the cloud permanently."
              : "Deleting local data will clear favorites, reading progress, and preferences from this device."}
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

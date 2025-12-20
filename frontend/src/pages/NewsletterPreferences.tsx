import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircleIcon,
  XCircleIcon,
  SpinnerIcon,
  SettingsIcon,
} from "../components/icons";
import { GoalSelector } from "../components/GoalSelector";
import { TimeSelector, type SendTime } from "../components/TimeSelector";
import { api } from "../lib/api";
import { useLearningGoal } from "../hooks";

type PageState = "loading" | "loaded" | "saving" | "saved" | "error";

interface Preferences {
  email: string;
  name: string | null;
  goal_ids: string[];
  send_time: string;
  verified: boolean;
}

export default function NewsletterPreferences() {
  const { token } = useParams<{ token: string }>();
  const { setGoals } = useLearningGoal();

  // Validate token upfront - if invalid, initialize with error state
  const initialError = useMemo<{ state: PageState; error: string }>(() => {
    if (!token) {
      return { state: "error", error: "Invalid preferences link" };
    }
    return { state: "loading", error: "" };
  }, [token]);

  // Page state - initialized from validation
  const [pageState, setPageState] = useState<PageState>(initialError.state);
  const [errorMessage, setErrorMessage] = useState<string>(initialError.error);

  // Form state
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [name, setName] = useState<string>("");
  const [sendTime, setSendTime] = useState<SendTime>("morning");

  // Load preferences
  useEffect(() => {
    // Skip if already in error state (invalid token)
    if (!token || initialError.state === "error") {
      return;
    }

    const loadPreferences = async () => {
      try {
        const response = await api.get(`/newsletter/preferences/${token}`);
        const prefs = response.data as Preferences;
        setPreferences(prefs);
        setName(prefs.name || "");
        setSendTime(prefs.send_time as SendTime);
        // Sync goal selection with local storage
        setGoals(prefs.goal_ids);
        setPageState("loaded");
      } catch (err: unknown) {
        setPageState("error");
        if (err && typeof err === "object" && "response" in err) {
          const axiosErr = err as { response?: { data?: { detail?: string } } };
          setErrorMessage(
            axiosErr.response?.data?.detail || "Failed to load preferences"
          );
        } else {
          setErrorMessage("Failed to load preferences");
        }
      }
    };

    loadPreferences();
  }, [token, initialError.state, setGoals]);

  // Get current goal selection from hook
  const { selectedGoalIds } = useLearningGoal();

  const handleSave = async () => {
    if (!token) return;

    setPageState("saving");
    setErrorMessage("");

    try {
      await api.patch(`/newsletter/preferences/${token}`, {
        name: name.trim() || null,
        goal_ids: selectedGoalIds,
        send_time: sendTime,
      });
      setPageState("saved");
    } catch (err: unknown) {
      setPageState("loaded");
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setErrorMessage(
          axiosErr.response?.data?.detail || "Failed to save preferences"
        );
      } else {
        setErrorMessage("Failed to save preferences");
      }
    }
  };

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!preferences) return false;
    const nameChanged = (name.trim() || null) !== preferences.name;
    const timeChanged = sendTime !== preferences.send_time;
    const goalsChanged =
      JSON.stringify(selectedGoalIds.sort()) !==
      JSON.stringify([...preferences.goal_ids].sort());
    return nameChanged || timeChanged || goalsChanged;
  }, [preferences, name, sendTime, selectedGoalIds]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 mb-4">
            <SettingsIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manage Preferences
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Customize your Daily Wisdom experience
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
          {pageState === "loading" && (
            <div className="text-center py-12">
              <SpinnerIcon className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Loading your preferences...
              </p>
            </div>
          )}

          {pageState === "error" && (
            <div className="text-center py-12">
              <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Something Went Wrong
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {errorMessage}
              </p>
              <Link
                to="/"
                className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
              >
                Go Home
              </Link>
            </div>
          )}

          {pageState === "saved" && (
            <div className="text-center py-12">
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Preferences Saved!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your Daily Wisdom will be personalized with your new settings.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => setPageState("loaded")}
                  className="block w-full sm:w-auto sm:inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
                >
                  Edit Again
                </button>
                <Link
                  to="/"
                  className="block w-full sm:w-auto sm:inline-block sm:ml-3 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Explore Geetanjali
                </Link>
              </div>
            </div>
          )}

          {(pageState === "loaded" || pageState === "saving") && preferences && (
            <div className="space-y-6">
              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg">
                  {preferences.email}
                </div>
              </div>

              {/* Name */}
              <div>
                <label
                  htmlFor="pref-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Your name
                </label>
                <input
                  type="text"
                  id="pref-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should we greet you?"
                  disabled={pageState === "saving"}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
                />
              </div>

              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What brings you to the Geeta?
                </label>
                <GoalSelector />
              </div>

              {/* Send Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  When would you like to receive verses?
                </label>
                <TimeSelector
                  value={sendTime}
                  onChange={setSendTime}
                  disabled={pageState === "saving"}
                />
              </div>

              {/* Error message */}
              {errorMessage && pageState === "loaded" && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
                  {errorMessage}
                </div>
              )}

              {/* Save Button */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={pageState === "saving" || !hasChanges}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {pageState === "saving" ? "Saving..." : "Save Preferences"}
                </button>
                <Link
                  to="/"
                  className="text-center text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 text-sm"
                >
                  Cancel and go home
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer link */}
        {preferences && (pageState === "loaded" || pageState === "saving") && (
          <div className="text-center mt-6">
            <Link
              to={`/n/unsubscribe/${token}`}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Unsubscribe from Daily Wisdom
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

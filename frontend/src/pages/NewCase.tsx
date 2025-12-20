import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { casesApi } from "../lib/api";
import type { Case } from "../types";
import { Navbar } from "../components";
import { ExampleQuestions } from "../components/ExampleQuestions";
import { InspirationVerse } from "../components/InspirationVerse";
import { errorMessages } from "../lib/errorMessages";
import { validateContent } from "../lib/contentFilter";
import { useSEO } from "../hooks";
import { trackEvent } from "../lib/experiment";

// localStorage key for draft saving
const DRAFT_KEY = "geetanjali:caseDraft";
const DRAFT_DEBOUNCE_MS = 1000; // Save after 1s of inactivity

interface DraftData {
  question: string;
  context: string;
  roles: string[];
  stakeholders: string[];
  savedAt: number;
}

// Draft helpers
function loadDraft(): DraftData | null {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    const draft = JSON.parse(stored) as DraftData;
    // Expire drafts after 7 days
    if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(data: Omit<DraftData, "savedAt">): void {
  try {
    // Don't save empty drafts
    if (!data.question.trim() && !data.context.trim()) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() }),
    );
  } catch {
    // Ignore storage errors
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore
  }
}

interface LocationState {
  prefill?: string;
}

// Form options - defined outside component to avoid recreation on render
const ROLE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "parent", label: "Parent" },
  { value: "manager", label: "Manager / Leader" },
  { value: "employee", label: "Employee" },
  { value: "student", label: "Student" },
  { value: "entrepreneur", label: "Entrepreneur" },
];

const STAKEHOLDER_OPTIONS = [
  { value: "self", label: "Self" },
  { value: "family", label: "Family" },
  { value: "team", label: "Team" },
  { value: "organization", label: "Organization" },
  { value: "community", label: "Community" },
];

export default function NewCase() {
  useSEO({
    title: "Ask a Question",
    description:
      "Seek ethical guidance grounded in the Bhagavad Geeta. Describe your situation and receive wisdom for difficult decisions.",
    canonical: "/cases/new",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Support prefill from both URL query param (?prefill=...) and router state
  const prefill =
    searchParams.get("prefill") ||
    (location.state as LocationState)?.prefill ||
    "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Load draft on mount (only if no prefill)
  const draft = !prefill ? loadDraft() : null;

  const [formData, setFormData] = useState({
    question: prefill || draft?.question || "",
    context: draft?.context || "",
  });

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    new Set(draft?.roles || ["individual"]),
  );

  const [selectedStakeholders, setSelectedStakeholders] = useState<Set<string>>(
    new Set(draft?.stakeholders || ["self"]),
  );

  // Show draft restored message
  useEffect(() => {
    if (draft && (draft.question || draft.context)) {
      setDraftRestored(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => setDraftRestored(false), 3000);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced draft saving
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSaveDraft = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft({
        question: formData.question,
        context: formData.context,
        roles: Array.from(selectedRoles),
        stakeholders: Array.from(selectedStakeholders),
      });
    }, DRAFT_DEBOUNCE_MS);
  }, [formData.question, formData.context, selectedRoles, selectedStakeholders]);

  // Save draft when form data changes
  useEffect(() => {
    debouncedSaveDraft();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedSaveDraft]);

  const toggleSelection = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    setter((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return newSet;
    });
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formStartTracked, setFormStartTracked] = useState(!!prefill); // Skip if prefilled

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.question.trim()) {
      newErrors.question = "Please describe your situation";
    } else if (formData.question.length < 10) {
      newErrors.question =
        "Please provide more detail (at least 10 characters)";
    } else {
      // Content validation (gibberish, abuse detection)
      const combinedText = `${formData.question} ${formData.context}`.trim();
      const contentCheck = validateContent(combinedText);
      if (!contentCheck.valid && contentCheck.reason) {
        newErrors.question = contentCheck.reason;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let description = formData.question.trim();
      if (formData.context.trim()) {
        description += "\n\n" + formData.context.trim();
      }

      const generateSimpleTitle = (text: string): string => {
        const firstSentence = text.split(/[.!?]/)[0].trim();
        if (firstSentence.length > 0 && firstSentence.length <= 100) {
          return firstSentence;
        }
        return text.slice(0, 100).trim();
      };

      const roleLabels = ROLE_OPTIONS.filter((r) =>
        selectedRoles.has(r.value),
      ).map((r) => r.label);
      const roleLabel =
        roleLabels.length > 0 ? roleLabels.join(", ") : "Individual";
      const caseData: Omit<Case, "id" | "created_at"> = {
        title: generateSimpleTitle(formData.question),
        description: description,
        role: roleLabel,
        stakeholders: Array.from(selectedStakeholders),
        constraints: [],
        horizon: "medium", // Default: medium-term perspective
      };

      const createdCase = await casesApi.create(caseData);

      // Track case creation
      trackEvent("newcase", "case_created", {
        case_id: createdCase.id,
        had_prefill: !!prefill,
      });

      try {
        await casesApi.analyzeAsync(createdCase.id);
      } catch {
        // Silent fail
      }

      // Clear draft on successful submission
      clearDraft();

      navigate(`/cases/${createdCase.id}`);
    } catch (err) {
      setError(errorMessages.caseCreate(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    // Track form start (first keystroke in question field, once per session)
    if (name === "question" && !formStartTracked && value.length > 0) {
      trackEvent("newcase", "form_start", {});
      setFormStartTracked(true);
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePersonalizationToggle = () => {
    if (!showAdvanced) {
      trackEvent("newcase", "personalization_expand", {});
    }
    setShowAdvanced(!showAdvanced);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
      <Navbar />
      <div className="flex-1 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6 sm:mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 dark:text-gray-100 mb-2">
              Seek Guidance
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-4">
              Describe your situation and receive wisdom from the Bhagavad Geeta
            </p>
            <InspirationVerse />
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 sm:mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm"
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Main Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6"
          >
            {/* Main Question */}
            <div>
              <label
                htmlFor="question"
                className="block text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 sm:mb-3"
              >
                What dilemma are you facing?
              </label>
              <textarea
                id="question"
                name="question"
                value={formData.question}
                onChange={handleChange}
                rows={4}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 ${
                  errors.question
                    ? "border-red-500 dark:border-red-600"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="e.g., I'm torn between pursuing a promotion that requires relocating, or staying in my current role to care for aging parents..."
                autoFocus
              />
              <div className="flex justify-between items-center mt-1.5 sm:mt-2">
                {errors.question ? (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                    {errors.question}
                  </p>
                ) : draftRestored ? (
                  <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                    Draft restored
                  </p>
                ) : (
                  <span />
                )}
                <span
                  className={`text-xs ${
                    formData.question.length < 10
                      ? "text-gray-400 dark:text-gray-500"
                      : "text-green-600 dark:text-green-500"
                  }`}
                >
                  {formData.question.length < 10
                    ? `${formData.question.length}/10 min`
                    : "✓"}
                </span>
              </div>

              {/* Example Questions - smooth transition when hiding */}
              <div
                className={`transition-all duration-300 ease-out overflow-hidden ${
                  formData.question.length < 10
                    ? "opacity-100 max-h-32"
                    : "opacity-0 max-h-0"
                }`}
              >
                <ExampleQuestions
                  onSelect={(q) =>
                    setFormData((prev) => ({ ...prev, question: q }))
                  }
                />
              </div>
            </div>

            {/* Background & Constraints */}
            <div>
              <label
                htmlFor="context"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Background & constraints{" "}
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  (optional)
                </span>
              </label>
              <textarea
                id="context"
                name="context"
                value={formData.context}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm border border-amber-200 dark:border-gray-600 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-amber-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="What makes this difficult? Competing values, fears, past experiences..."
              />
            </div>

            {/* Context Options Toggle */}
            <div className="border-t dark:border-gray-700 pt-3 sm:pt-4">
              <button
                type="button"
                onClick={handlePersonalizationToggle}
                className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 rounded"
              >
                <span>{showAdvanced ? "−" : "+"}</span>
                <span>Personalize your guidance</span>
              </button>
            </div>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-4 pb-2 sm:pb-4">
                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    I'm asking as a...
                  </label>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {ROLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          toggleSelection(opt.value, setSelectedRoles)
                        }
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${
                          selectedRoles.has(opt.value)
                            ? "bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400"
                            : "bg-amber-50/50 dark:bg-gray-700 border-amber-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-gray-600"
                        }`}
                      >
                        {selectedRoles.has(opt.value) && (
                          <span className="mr-1">✓</span>
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stakeholders */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    This decision affects...
                  </label>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {STAKEHOLDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          toggleSelection(opt.value, setSelectedStakeholders)
                        }
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${
                          selectedStakeholders.has(opt.value)
                            ? "bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400"
                            : "bg-amber-50/50 dark:bg-gray-700 border-amber-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-gray-600"
                        }`}
                      >
                        {selectedStakeholders.has(opt.value) && (
                          <span className="mr-1">✓</span>
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Buttons - Stack on mobile */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-center text-sm sm:text-base inline-flex items-center justify-center gap-1"
              >
                <span className="hidden sm:inline">←</span>
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 sm:px-8 py-2.5 sm:py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium shadow-lg hover:shadow-xl text-sm sm:text-base"
              >
                {loading ? "Getting guidance..." : "Get Guidance"}
              </button>
            </div>
          </form>

          {/* Helper Text */}
          <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-4 sm:mt-6">
            Your question will be analyzed using wisdom from the Bhagavad Geeta.
            <br className="hidden sm:inline" />
            <span className="text-gray-400 dark:text-gray-500">
              {" "}
              You'll receive guidance in under a minute.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { casesApi, outputsApi } from "../lib/api";
import { messagesApi } from "../api/messages";
import type { Case, Message, Output, Option } from "../types";
import { useAuth } from "../contexts/AuthContext";
import {
  Navbar,
  ConfirmModal,
  ContentNotFound,
  GuidanceMarkdown,
} from "../components";
import { errorMessages } from "../lib/errorMessages";
import { validateContent } from "../lib/contentFilter";
import { groupMessagesIntoExchanges } from "../lib/messageGrouping";
import { useSEO, useFeedback } from "../hooks";
import {
  CaseHeader,
  CompletionBanner,
  OutputFeedback,
  PathsSection,
  StepsSection,
  ReflectionsSection,
  FollowUpInput,
  ThinkingIndicator,
} from "../components/case";

export default function CaseView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const { isAuthenticated } = useAuth();

  // Ref for scrolling to follow-up input
  const followUpInputRef = useRef<HTMLDivElement>(null);

  // Dynamic SEO - private consultations shouldn't be indexed
  useSEO({
    title: caseData?.title ? caseData.title.slice(0, 50) : "Consultation",
    description:
      "Your private ethical consultation with guidance from the Bhagavad Geeta.",
    canonical: id ? `/cases/${id}` : "/consultations",
    noIndex: true, // Private consultations shouldn't be indexed
  });

  // Expanded state for sections
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );
  const [showPaths, setShowPaths] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  const [showReflections, setShowReflections] = useState(true);

  // Feedback state (extracted to hook)
  const {
    feedbackGiven,
    feedbackLoading,
    expandedFeedback,
    feedbackText,
    savedComment,
    initializeFeedback,
    handleFeedback,
    handleSubmitNegativeFeedback,
    handleEditFeedback,
    handleCancelFeedback,
    handleFeedbackTextChange,
  } = useFeedback();

  // Share state
  const [shareLoading, setShareLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Analysis completion indicator
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [wasProcessing, setWasProcessing] = useState(false);

  // Path selection for options
  const [selectedOption, setSelectedOption] = useState(0);

  // Status-based flags for action visibility
  const isDraft = caseData?.status === "draft";
  const isProcessing =
    caseData?.status === "pending" || caseData?.status === "processing";
  const isFailed = caseData?.status === "failed";
  const isPolicyViolation = caseData?.status === "policy_violation";
  const isCompleted =
    caseData?.status === "completed" || isPolicyViolation || !caseData?.status;

  // Action visibility based on status
  const canSave = isCompleted && outputs.length > 0;
  // Don't allow sharing policy_violation cases - educational responses aren't meant to be shared
  const canShare = isCompleted && outputs.length > 0 && !isPolicyViolation;
  const canDelete = true;

  // Follow-up input visibility: show when completed with at least one output (but not policy_violation)
  // Policy violations don't allow follow-ups since the case can't be processed further
  const showFollowUpInput =
    isCompleted && !isPolicyViolation && outputs.length > 0;

  const loadCaseData = useCallback(async () => {
    if (!id) return;

    try {
      const data = await casesApi.get(id);
      setCaseData(data);

      // Always fetch messages and outputs (even during processing)
      // This ensures we can show existing content while follow-up is being analyzed
      const messagesData = await messagesApi.list(id);
      setMessages(messagesData);

      const outputsData = await outputsApi.listByCaseId(id);
      setOutputs(outputsData);

      // Initialize feedback state from loaded outputs
      initializeFeedback(outputsData);

      // When completed/failed/policy_violation, clear pending state and set up UI
      const isFinished =
        data.status === "completed" ||
        data.status === "failed" ||
        data.status === "policy_violation" ||
        !data.status;
      if (isFinished) {
        setPendingFollowUp(null);

        if (!isAuthenticated && outputsData.length > 0) {
          setShowSignupPrompt(true);
        }
      } else if (data.status === "processing" || data.status === "pending") {
        // During processing, detect pending follow-up from messages
        // If the last user message doesn't have a corresponding output, it's the pending one
        const userMessages = messagesData.filter((m) => m.role === "user");
        const lastUserMessage = userMessages[userMessages.length - 1];

        if (
          lastUserMessage &&
          outputsData.length > 0 &&
          outputsData.length < userMessages.length
        ) {
          // There's a user message without a response - that's the pending follow-up
          // Note: outputsData.length > 0 ensures this only triggers for follow-ups, not initial consultation
          setPendingFollowUp(lastUserMessage.content);
        }
      }
    } catch (err) {
      setError(errorMessages.caseLoad(err));
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated, initializeFeedback]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  // Track when case transitions from processing to completed
  useEffect(() => {
    if (isProcessing) {
      setWasProcessing(true);
    }
  }, [isProcessing]);

  // Show completion banner when analysis finishes
  useEffect(() => {
    if (wasProcessing && isCompleted && outputs.length > 0) {
      setShowCompletionBanner(true);
      setWasProcessing(false);
      // Auto-hide banner after 5 seconds
      const timer = setTimeout(() => setShowCompletionBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [wasProcessing, isCompleted, outputs.length]);

  // Polling for processing status
  // LLM operations take 1-3 minutes. Fixed 5s interval balances:
  // - Reasonable request count (~24 for 2-min op)
  // - Predictable latency (max 5s after completion)
  // - Simple to reason about
  useEffect(() => {
    if (!isProcessing || !id) return;

    const POLL_INTERVAL = 5000; // 5 seconds

    const pollInterval = setInterval(async () => {
      try {
        const data = await casesApi.get(id);
        setCaseData(data);

        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "policy_violation"
        ) {
          clearInterval(pollInterval);
          // Fetch final data
          const [messagesData, outputsData] = await Promise.all([
            messagesApi.list(id),
            outputsApi.listByCaseId(id),
          ]);
          setMessages(messagesData);
          setOutputs(outputsData);

          // Initialize feedback state from loaded outputs
          initializeFeedback(outputsData);

          setPendingFollowUp(null);
        }
      } catch {
        // Silent fail - polling will retry
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [isProcessing, id, initializeFeedback]);

  const handleRetry = async () => {
    if (!id || !caseData) return;
    try {
      if (caseData.status === "failed") {
        await casesApi.retry(id);
      }
      await casesApi.analyze(id);
      const data = await casesApi.get(id);
      setCaseData(data);
      setError(null);
    } catch (err) {
      setError(errorMessages.caseAnalyze(err));
    }
  };

  const handleDeleteClick = () => setShowDeleteModal(true);

  const handleDeleteConfirm = async () => {
    if (!id || !caseData) return;
    setDeleteLoading(true);
    try {
      await casesApi.delete(id);
      navigate("/consultations");
    } catch (err) {
      setError(errorMessages.general(err));
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!deleteLoading) setShowDeleteModal(false);
  };

  const toggleSources = (outputId: string) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(outputId)) newSet.delete(outputId);
      else newSet.add(outputId);
      return newSet;
    });
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !followUp.trim() || !caseData) return;

    const messageContent = followUp.trim();

    // Client-side content validation (gibberish, abuse detection)
    // Use lenient mode for follow-ups - they're often specialized questions
    const contentCheck = validateContent(messageContent, true);
    if (!contentCheck.valid) {
      setFollowUpError(
        contentCheck.reason || "Please check your input and try again.",
      );
      return;
    }

    setSubmittingFollowUp(true);
    setFollowUpError(null);

    try {
      // Store the pending message for display while waiting
      setPendingFollowUp(messageContent);
      setFollowUp("");

      // Submit follow-up (async - returns 202 with user message)
      // Assistant response is processed in background
      const userMessage = await messagesApi.followUp(id, {
        content: messageContent,
      });

      // Add the user message to the list immediately
      setMessages((prev) => [
        ...prev,
        {
          id: userMessage.id,
          case_id: userMessage.case_id,
          role: userMessage.role,
          content: userMessage.content,
          output_id: userMessage.output_id ?? undefined,
          created_at: userMessage.created_at,
        },
      ]);

      // Update case status to "processing" to trigger existing polling
      // The polling will detect when status becomes "completed" and fetch messages
      setCaseData({ ...caseData, status: "processing" });

      // Keep pendingFollowUp set - polling will clear it when assistant responds
      // This ensures the thinking indicator shows while background processes
    } catch (err) {
      // On error, restore the message and clear pending state
      setFollowUp(messageContent);
      setPendingFollowUp(null);
      setFollowUpError(errorMessages.followUp(err));
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  // Handler for "refine this guidance" CTA on low-confidence outputs
  const handleRefineGuidance = useCallback((prefillText?: string) => {
    if (prefillText) {
      setFollowUp(prefillText);
    }
    // Scroll to follow-up input after a brief delay to ensure it's rendered
    setTimeout(() => {
      followUpInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      // Focus the textarea inside the follow-up input
      const textarea = followUpInputRef.current?.querySelector("textarea");
      textarea?.focus();
    }, 100);
  }, []);

  const handleSave = () => {
    if (!caseData) return;

    // Get the first (main) output for paths, steps, and reflections
    const firstOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null;

    let markdown = `# ${caseData.title}

*Consultation on ${caseData.created_at ? new Date(caseData.created_at).toLocaleDateString() : "Unknown date"}*
`;

    // Add policy violation notice if applicable
    if (isPolicyViolation) {
      markdown += `
> **Note:** This consultation could not be processed as submitted. The response below contains suggestions for rephrasing your question to receive guidance from the Bhagavad Geeta.

`;
    }

    markdown += `---

${messages
  .map((msg) => {
    if (msg.role === "user") {
      return `## Question\n\n${msg.content}\n`;
    } else {
      const msgOutput = outputs.find((o) => o.id === msg.output_id);
      let text = `## Guidance\n\n${msg.content}\n`;
      if (msgOutput?.result_json.sources?.length) {
        text += `\n### Verse References\n\n${msgOutput.result_json.sources
          .map(
            (s) =>
              `- **${s.canonical_id.replace(/_/g, " ")}**: "${s.paraphrase}"`,
          )
          .join("\n")}\n`;
      }
      return text;
    }
  })
  .join("\n---\n\n")}

---
`;

    // Add Guidance Summary section header if any summary sections exist
    const hasPaths = firstOutput && firstOutput.result_json.options?.length > 0;
    const hasSteps =
      firstOutput &&
      typeof firstOutput.result_json.recommended_action === "object" &&
      (firstOutput.result_json.recommended_action as { steps?: string[] })
        ?.steps?.length;
    const hasReflections =
      firstOutput && firstOutput.result_json.reflection_prompts?.length > 0;

    if (hasPaths || hasSteps || hasReflections) {
      markdown += `\n# Guidance Summary\n\n*Key insights from your consultation*\n\n---\n`;
    }

    // Add Paths Before You (Options)
    if (hasPaths) {
      markdown += `\n## Paths Before You\n\n`;
      firstOutput.result_json.options.forEach((option: Option, idx: number) => {
        markdown += `### Path ${idx + 1}: ${option.title}\n\n`;
        if (option.description) {
          markdown += `${option.description}\n\n`;
        }

        if (option.pros?.length) {
          markdown += `**Strengths:**\n`;
          option.pros.forEach((pro: string) => {
            markdown += `- ${pro}\n`;
          });
          markdown += "\n";
        }

        if (option.cons?.length) {
          markdown += `**Considerations:**\n`;
          option.cons.forEach((con: string) => {
            markdown += `- ${con}\n`;
          });
          markdown += "\n";
        }

        if (option.sources?.length) {
          markdown += `**Related Verses:** ${option.sources.join(", ")}\n\n`;
        }
      });
      markdown += `---\n`;
    }

    // Add Recommended Steps
    if (hasSteps) {
      markdown += `\n## Recommended Steps\n\n`;
      const recommendedAction = firstOutput.result_json.recommended_action as {
        steps?: string[];
        sources?: string[];
      };
      (recommendedAction.steps ?? []).forEach((step: string, idx: number) => {
        markdown += `${idx + 1}. ${step}\n`;
      });

      if (recommendedAction.sources?.length) {
        markdown += `\n**Supporting Verses:** ${recommendedAction.sources.join(", ")}\n`;
      }
      markdown += `\n---\n`;
    }

    // Add Reflection Prompts
    if (hasReflections) {
      markdown += `\n## Reflection Prompts\n\nTake time to reflect on these questions:\n\n`;
      firstOutput.result_json.reflection_prompts.forEach(
        (prompt: string, idx: number) => {
          markdown += `${idx + 1}. ${prompt}\n`;
        },
      );
      markdown += `\n---\n`;
    }

    markdown += `\n*Exported from Geetanjali*\n`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consultation-${caseData.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!caseData || !id) return;

    setShareLoading(true);
    try {
      const updated = await casesApi.toggleShare(id, true, "full");
      setCaseData(updated);

      // Auto-copy link when sharing is enabled
      if (updated.public_slug) {
        const url = `${window.location.origin}/c/${updated.public_slug}`;
        await navigator.clipboard.writeText(url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch {
      setError("Failed to share consultation");
    } finally {
      setShareLoading(false);
    }
  };

  const handleModeChange = async (mode: "full" | "essential") => {
    if (!caseData || !id) return;

    setShareLoading(true);
    try {
      const updated = await casesApi.toggleShare(id, true, mode);
      setCaseData(updated);
    } catch {
      setError("Failed to update share mode");
    } finally {
      setShareLoading(false);
    }
  };

  const handleStopSharing = async () => {
    if (!caseData || !id) return;

    setShareLoading(true);
    try {
      const updated = await casesApi.toggleShare(id, false);
      setCaseData(updated);
    } catch {
      setError("Failed to stop sharing");
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = () => {
    if (!caseData?.public_slug) return;
    const url = `${window.location.origin}/c/${caseData.public_slug}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Group messages into exchanges using shared utility
  const exchanges = useMemo(
    () => groupMessagesIntoExchanges(messages, outputs),
    [messages, outputs],
  );

  // Get first output for paths/steps/reflections
  const firstOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600 dark:text-gray-400">
            Loading consultation...
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <ContentNotFound variant="case" isAuthenticated={isAuthenticated} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
      <Navbar />

      <CaseHeader
        caseData={caseData}
        canSave={canSave}
        canDelete={canDelete}
        canShare={canShare}
        shareLoading={shareLoading}
        copySuccess={copySuccess}
        onSave={handleSave}
        onDeleteClick={handleDeleteClick}
        onShare={handleShare}
        onModeChange={handleModeChange}
        onStopSharing={handleStopSharing}
        onCopyShareLink={copyShareLink}
      />

      <div className="flex-1 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto px-3 sm:px-4">
          {/* Analysis Complete Banner */}
          {showCompletionBanner && (
            <CompletionBanner
              isPolicyViolation={isPolicyViolation}
              onDismiss={() => setShowCompletionBanner(false)}
            />
          )}

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl"
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Signup reminder */}
          {showSignupPrompt && !isAuthenticated && (
            <div className="mb-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <Link
                  to="/signup"
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium"
                >
                  Sign up
                </Link>{" "}
                to save this consultation permanently.
              </p>
              <button
                onClick={() => setShowSignupPrompt(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-4 rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Main Content - Timeline */}
          {/* Show timeline when there are messages - handles all statuses consistently */}
          {messages.length > 0 && (
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-2.5 sm:left-3 top-6 bottom-0 w-0.5 bg-linear-to-b from-amber-300 via-orange-300 to-red-300 dark:from-amber-600 dark:via-orange-600 dark:to-red-600" />

              {/* Exchanges */}
              {exchanges.map((exchange, exchangeIdx) => {
                const isFirst = exchangeIdx === 0;
                const isSourcesExpanded = exchange.output
                  ? expandedSources.has(exchange.output.id)
                  : false;
                const feedback = exchange.output
                  ? feedbackGiven[exchange.output.id]
                  : null;

                return (
                  <div key={exchange.user.id}>
                    {/* Question */}
                    <div className="relative pl-8 sm:pl-10 pb-3 sm:pb-4">
                      <div
                        className={`absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ${
                          isFirst
                            ? "bg-amber-600 text-white"
                            : "bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-600"
                        }`}
                      >
                        {isFirst ? (
                          <svg
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : (
                          <span className="text-xs text-blue-700 dark:text-blue-400">
                            +
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          isFirst
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {isFirst ? "Your Question" : "Follow-up"}
                      </div>
                      <div
                        className={`rounded-xl p-3 sm:p-4 ${
                          isFirst
                            ? "bg-white dark:bg-gray-800 shadow-lg border-2 border-amber-200 dark:border-amber-700"
                            : "bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800"
                        }`}
                      >
                        <p
                          className={`leading-relaxed whitespace-pre-wrap ${isFirst ? "text-gray-900 dark:text-gray-100 text-sm sm:text-base" : "text-gray-700 dark:text-gray-300 text-sm"}`}
                        >
                          {exchange.user.content}
                        </p>
                        {isFirst &&
                          ((caseData.stakeholders?.length ?? 0) > 1 ||
                            (caseData.stakeholders?.[0] &&
                              caseData.stakeholders[0] !== "self") ||
                            (caseData.constraints?.length ?? 0) > 0 ||
                            (caseData.role &&
                              caseData.role !== "Individual")) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {caseData.role &&
                                caseData.role !== "Individual" && (
                                  <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 px-2 py-1 rounded-full font-medium">
                                    {caseData.role}
                                  </span>
                                )}
                              {caseData.stakeholders
                                ?.filter((s) => s !== "self")
                                .map((s, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full"
                                  >
                                    {s}
                                  </span>
                                ))}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Status indicator - show when no assistant response yet */}
                    {!exchange.assistant && (
                      <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
                        {/* Draft state */}
                        {isDraft && (
                          <>
                            <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-300 dark:border-amber-700 flex items-center justify-center">
                              <span className="text-xs">📝</span>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                                <span className="font-medium">Draft</span> —
                                Your question is saved. Click below to receive
                                wisdom from the Bhagavad Geeta.
                              </p>
                              <button
                                onClick={handleRetry}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Get Guidance
                              </button>
                            </div>
                          </>
                        )}

                        {/* Processing state - uses unified ThinkingIndicator (only for initial, not follow-ups) */}
                        {isProcessing && !pendingFollowUp && (
                          <ThinkingIndicator variant="initial" />
                        )}

                        {/* Failed state */}
                        {isFailed && (
                          <>
                            <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-red-100 dark:bg-red-900/40 border-2 border-red-300 dark:border-red-700 flex items-center justify-center">
                              <span className="text-xs">⚠️</span>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                              <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                                <span className="font-medium">
                                  Unable to Complete
                                </span>{" "}
                                — We encountered an issue while preparing your
                                guidance. Please try again.
                              </p>
                              <button
                                onClick={handleRetry}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Get Guidance
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Response - only show if assistant message exists */}
                    {exchange.assistant && (
                      <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
                        <div
                          className={`absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ${
                            isFirst
                              ? "bg-orange-500 text-white"
                              : "bg-orange-100 dark:bg-orange-900/40 border-2 border-orange-300 dark:border-orange-700"
                          }`}
                        >
                          {isFirst ? (
                            <svg
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
                          ) : (
                            <span className="text-xs text-orange-600 dark:text-orange-400">
                              ~
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                            isFirst
                              ? "text-orange-700 dark:text-orange-400"
                              : "text-orange-600 dark:text-orange-400"
                          }`}
                        >
                          {isFirst ? "Wisdom from the Geeta" : "Guidance"}
                        </div>

                        <div
                          className={`rounded-xl p-3 sm:p-4 border ${
                            isFirst
                              ? "bg-white dark:bg-gray-800 shadow-lg border-orange-200 dark:border-orange-800"
                              : "bg-white dark:bg-gray-800 shadow-md border-orange-100 dark:border-orange-900"
                          }`}
                        >
                          <GuidanceMarkdown
                            content={exchange.assistant.content}
                            sources={exchange.output?.result_json.sources}
                            className={`leading-relaxed prose dark:prose-invert max-w-none ${isFirst ? "text-gray-900 dark:text-gray-100" : "text-gray-800 dark:text-gray-200"} prose-p:my-2 prose-ul:my-2 prose-li:my-0.5`}
                          />

                          {/* Scholar flag with refine option */}
                          {exchange.output?.scholar_flag && (
                            <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm font-medium">
                                <span>⚠️</span>
                                <span>This guidance has lower confidence</span>
                              </div>
                              {showFollowUpInput && (
                                <button
                                  onClick={() =>
                                    handleRefineGuidance(
                                      "Can you provide more detail or clarify the recommended approach?",
                                    )
                                  }
                                  className="mt-2 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline flex items-center gap-1 rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                                    />
                                  </svg>
                                  Ask a follow-up to refine this guidance
                                </button>
                              )}
                            </div>
                          )}

                          {/* Verse Sources */}
                          {exchange.output &&
                            exchange.output.result_json.sources?.length > 0 && (
                              <div className="mt-4">
                                <button
                                  onClick={() =>
                                    exchange.output &&
                                    toggleSources(exchange.output.id)
                                  }
                                  className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1 rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                                >
                                  <svg
                                    className={`w-3 h-3 transition-transform ${isSourcesExpanded ? "rotate-90" : ""}`}
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
                                  {exchange.output.result_json.sources.length}{" "}
                                  verse reference
                                  {exchange.output.result_json.sources.length >
                                  1
                                    ? "s"
                                    : ""}
                                </button>

                                {isSourcesExpanded && (
                                  <div className="mt-3 space-y-2">
                                    {exchange.output.result_json.sources.map(
                                      (source) => (
                                        <div
                                          key={source.canonical_id}
                                          className="bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg p-3 border border-orange-100 dark:border-orange-800"
                                        >
                                          <div className="flex items-center justify-between">
                                            <Link
                                              to={`/verses/${source.canonical_id}`}
                                              className="font-mono text-orange-700 dark:text-orange-400 font-semibold text-sm hover:underline"
                                            >
                                              {source.canonical_id.replace(
                                                /_/g,
                                                " ",
                                              )}
                                            </Link>
                                          </div>
                                          <p className="mt-1.5 text-gray-700 dark:text-gray-300 italic text-sm">
                                            "{source.paraphrase}"
                                          </p>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                          {/* Feedback row */}
                          {exchange.output && (
                            <OutputFeedback
                              output={exchange.output}
                              feedback={feedback}
                              feedbackLoading={feedbackLoading}
                              expandedFeedback={expandedFeedback}
                              savedComment={savedComment}
                              feedbackText={feedbackText}
                              onFeedback={handleFeedback}
                              onEditFeedback={handleEditFeedback}
                              onSubmitNegativeFeedback={
                                handleSubmitNegativeFeedback
                              }
                              onCancelFeedback={handleCancelFeedback}
                              onFeedbackTextChange={handleFeedbackTextChange}
                            />
                          )}

                          {/* Interpretive tradition disclosure - subtle, first exchange only */}
                          {isFirst && (
                            <p className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 italic">
                              Guidance reflects practical Vedantic principles.{" "}
                              <Link
                                to="/about#our-approach"
                                className="underline hover:text-gray-600 dark:hover:text-gray-400"
                              >
                                Learn about our approach
                              </Link>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Follow-up thinking indicator - shows during submission and background processing */}
              {/* Don't show pendingMessage if it's already in the messages list (async flow adds it immediately) */}
              {(submittingFollowUp || isProcessing) && pendingFollowUp && (
                <ThinkingIndicator
                  variant="followup"
                  pendingMessage={
                    messages.some(
                      (m) => m.role === "user" && m.content === pendingFollowUp,
                    )
                      ? undefined
                      : pendingFollowUp
                  }
                />
              )}

              {/* Follow-up Input - at end of conversation flow */}
              {showFollowUpInput && (
                <div
                  ref={followUpInputRef}
                  className="relative pl-8 sm:pl-10 pt-2 pb-4"
                >
                  <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <FollowUpInput
                    value={followUp}
                    submitting={submittingFollowUp}
                    disabled={submittingFollowUp}
                    error={followUpError}
                    onChange={(val) => {
                      setFollowUp(val);
                      if (followUpError) setFollowUpError(null);
                    }}
                    onSubmit={handleFollowUpSubmit}
                  />
                </div>
              )}
            </div>
          )}

          {/* Guidance Summary - Static sections from initial analysis */}
          {firstOutput &&
            (firstOutput.result_json.options?.length > 0 ||
              (typeof firstOutput.result_json.recommended_action === "object" &&
                (firstOutput.result_json.recommended_action.steps?.length ??
                  0) > 0) ||
              firstOutput.result_json.reflection_prompts?.length > 0) && (
              <div className="mt-8 pt-6 border-t border-orange-200/50 dark:border-orange-800/50">
                {/* Section Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-orange-600 dark:text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Guidance Summary
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Key insights from your consultation
                    </p>
                  </div>
                </div>

                {/* Paths/Options Section */}
                {firstOutput.result_json.options?.length > 0 && (
                  <PathsSection
                    options={firstOutput.result_json.options}
                    selectedOption={selectedOption}
                    showPaths={showPaths}
                    onToggle={() => setShowPaths(!showPaths)}
                    onSelectOption={setSelectedOption}
                  />
                )}

                {/* Recommended Steps */}
                {typeof firstOutput.result_json.recommended_action ===
                  "object" &&
                  (firstOutput.result_json.recommended_action.steps?.length ??
                    0) > 0 && (
                    <StepsSection
                      steps={
                        (
                          firstOutput.result_json.recommended_action as {
                            steps: string[];
                          }
                        ).steps
                      }
                      showSteps={showSteps}
                      onToggle={() => setShowSteps(!showSteps)}
                    />
                  )}

                {/* Reflection Prompts */}
                {firstOutput.result_json.reflection_prompts?.length > 0 && (
                  <ReflectionsSection
                    prompts={firstOutput.result_json.reflection_prompts}
                    showReflections={showReflections}
                    onToggle={() => setShowReflections(!showReflections)}
                  />
                )}
              </div>
            )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Consultation"
        message={`Are you sure you want to delete "${caseData?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { casesApi } from "../lib/api";
import type { Case, Message, Output } from "../types";
import {
  Navbar,
  ContentNotFound,
  Footer,
  GuidanceMarkdown,
} from "../components";
import { groupMessagesIntoExchanges } from "../lib/messageGrouping";
import { useSEO } from "../hooks";

/**
 * Public view of a shared consultation.
 * Read-only, no follow-up input, no share/save actions.
 */
export default function PublicCaseView() {
  const { slug } = useParams<{ slug: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic SEO based on case data
  useSEO({
    title: caseData?.title
      ? `${caseData.title.slice(0, 50)}`
      : "Shared Consultation",
    description: caseData?.description
      ? `${caseData.description.slice(0, 150)}...`
      : "View this shared ethical consultation with guidance from the Bhagavad Geeta.",
    canonical: slug ? `/c/${slug}` : "/",
    ogType: "article",
  });

  // Expanded state for sections
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );
  const [showPaths, setShowPaths] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  const [showReflections, setShowReflections] = useState(true);
  const [selectedOption, setSelectedOption] = useState(0);

  const loadData = useCallback(async () => {
    if (!slug) return;

    try {
      const [caseRes, messagesRes, outputsRes] = await Promise.all([
        casesApi.getPublic(slug),
        casesApi.getPublicMessages(slug),
        casesApi.getPublicOutputs(slug),
      ]);

      setCaseData(caseRes);
      setMessages(messagesRes);
      setOutputs(outputsRes);

      // Expand first output's sources by default
      if (outputsRes.length > 0) {
        setExpandedSources(new Set([outputsRes[0].id]));
      }
    } catch {
      setError(
        "This consultation is not publicly accessible or does not exist.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Record view once per session
  useEffect(() => {
    if (!slug) return;

    // Only record once per session per case
    const viewedKey = `geetanjali:viewed:${slug}`;
    if (sessionStorage.getItem(viewedKey)) return;

    casesApi
      .recordPublicView(slug)
      .then(() => {
        sessionStorage.setItem(viewedKey, "true");
      })
      .catch(() => {
        // Ignore errors - view tracking is non-critical
      });
  }, [slug]);

  const toggleSources = (outputId: string) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(outputId)) newSet.delete(outputId);
      else newSet.add(outputId);
      return newSet;
    });
  };

  // Group messages into exchanges using shared utility
  const exchanges = useMemo(
    () => groupMessagesIntoExchanges(messages, outputs),
    [messages, outputs],
  );

  const firstOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col overflow-x-hidden">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[var(--text-secondary)]">
            Loading consultation...
          </div>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col overflow-x-hidden">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <ContentNotFound variant="shared" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col overflow-x-hidden">
      <Navbar />

      {/* Header */}
      <div className="border-b border-[var(--border-warm-subtle)] bg-[var(--surface-warm-subtle)] backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="text-[var(--text-accent)] hover:text-[var(--badge-warm-text)] text-sm flex items-center gap-1"
          >
            ← Home
          </Link>
          <div className="text-xs text-[var(--text-tertiary)] bg-[var(--surface-muted)] px-2 py-1 rounded-sm">
            Shared Consultation
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto px-3 sm:px-4">
          {/* Call to action for starting own consultation */}
          <div className="mb-4 sm:mb-6 bg-linear-to-r from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] border border-[var(--border-warm)] rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
            <p className="text-xs sm:text-sm text-[var(--text-primary)]">
              Want guidance for your own situation?{" "}
              <Link
                to="/cases/new"
                className="text-[var(--interactive-ghost-text)] hover:text-[var(--text-primary)] font-medium"
              >
                Start a consultation →
              </Link>
            </p>
          </div>

          {/* Main Content - Timeline */}
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-2.5 sm:left-3 top-6 bottom-0 w-0.5 bg-linear-to-b from-[var(--gradient-warm-from)] via-[var(--interactive-primary)] to-[var(--gradient-page-to)]" />

            {/* Exchanges */}
            {exchanges.map((exchange, exchangeIdx) => {
              const isFirst = exchangeIdx === 0;
              const isSourcesExpanded = exchange.output
                ? expandedSources.has(exchange.output.id)
                : false;

              return (
                <div key={exchange.user.id}>
                  {/* Question */}
                  <div className="relative pl-8 sm:pl-10 pb-3 sm:pb-4">
                    <div
                      className={`absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ${
                        isFirst
                          ? "bg-amber-600 text-white"
                          : "bg-[var(--status-info-bg)] border-2 border-[var(--status-info-border)]"
                      }`}
                    >
                      {isFirst ? (
                        <svg
                          className="w-3 h-3 sm:w-4 sm:h-4"
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
                        <span className="text-xs text-[var(--status-info-text)]">
                          +
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs font-semibold uppercase tracking-wide mb-1.5 sm:mb-2 ${
                        isFirst
                          ? "text-[var(--text-accent)]"
                          : "text-[var(--status-info-text)]"
                      }`}
                    >
                      {isFirst ? "Question" : "Follow-up"}
                    </div>
                    <div
                      className={`rounded-xl p-3 sm:p-4 ${
                        isFirst
                          ? "bg-[var(--surface-elevated)] shadow-lg border-2 border-[var(--border-warm)]"
                          : "bg-[var(--status-info-bg)] border border-[var(--status-info-border)]"
                      }`}
                    >
                      <p
                        className={`leading-relaxed whitespace-pre-wrap ${isFirst ? "text-[var(--text-primary)] text-sm sm:text-base" : "text-[var(--text-primary)] text-sm"}`}
                      >
                        {exchange.user.content}
                      </p>
                    </div>
                  </div>

                  {/* Response - only show if assistant message exists */}
                  {exchange.assistant && (
                    <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
                      <div
                        className={`absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ${
                          isFirst
                            ? "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]"
                            : "bg-[var(--badge-primary-bg)] border-2 border-[var(--border-warm)]"
                        }`}
                      >
                        {isFirst ? (
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
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
                          <span className="text-xs text-[var(--interactive-ghost-text)]">
                            ~
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs font-semibold uppercase tracking-wide mb-1.5 sm:mb-2 ${
                          isFirst
                            ? "text-[var(--interactive-ghost-text)]"
                            : "text-[var(--interactive-ghost-text)]"
                        }`}
                      >
                        {isFirst ? "Wisdom from the Geeta" : "Guidance"}
                      </div>

                      <div
                        className={`rounded-xl p-3 sm:p-4 border ${
                          isFirst
                            ? "bg-[var(--surface-elevated)] shadow-lg border-[var(--border-warm)]"
                            : "bg-[var(--surface-elevated)] shadow-md border-[var(--border-warm)]"
                        }`}
                      >
                        <GuidanceMarkdown
                          content={exchange.assistant.content}
                          sources={exchange.output?.result_json.sources}
                          className={`leading-relaxed prose max-w-none ${isFirst ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"} prose-p:my-2 prose-ul:my-2 prose-li:my-0.5`}
                        />

                        {/* Verse Sources */}
                        {exchange.output &&
                          exchange.output.result_json.sources?.length > 0 && (
                            <div className="mt-3 sm:mt-4">
                              <button
                                onClick={() =>
                                  exchange.output &&
                                  toggleSources(exchange.output.id)
                                }
                                className="text-xs font-medium text-[var(--interactive-ghost-text)] hover:text-[var(--text-primary)] flex items-center gap-1"
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
                                {exchange.output.result_json.sources.length > 1
                                  ? "s"
                                  : ""}
                              </button>

                              {isSourcesExpanded && (
                                <div className="mt-2 sm:mt-3 space-y-2">
                                  {exchange.output.result_json.sources.map(
                                    (source) => (
                                      <div
                                        key={source.canonical_id}
                                        className="bg-linear-to-r from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] rounded-lg p-2.5 sm:p-3 border border-[var(--border-warm)]"
                                      >
                                        <div className="flex items-center justify-between">
                                          <Link
                                            to={`/verses/${source.canonical_id}`}
                                            className="font-mono text-[var(--interactive-ghost-text)] font-semibold text-xs sm:text-sm hover:underline"
                                          >
                                            {source.canonical_id.replace(
                                              /_/g,
                                              " ",
                                            )}
                                          </Link>
                                        </div>
                                        <p className="mt-1 sm:mt-1.5 text-[var(--text-primary)] italic text-xs sm:text-sm">
                                          "{source.paraphrase}"
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                        {/* Confidence */}
                        {exchange.output && (
                          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-[var(--border-default)] flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                            <span>Confidence:</span>
                            <div className="w-10 sm:w-12 bg-[var(--border-default)] rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  exchange.output.confidence >= 0.8
                                    ? "bg-green-500"
                                    : exchange.output.confidence >= 0.6
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{
                                  width: `${exchange.output.confidence * 100}%`,
                                }}
                              />
                            </div>
                            <span className="font-medium">
                              {(exchange.output.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}

                        {/* Interpretive tradition disclosure - subtle, first exchange only */}
                        {isFirst && (
                          <p className="mt-4 pt-3 border-t border-[var(--border-default)] text-[10px] sm:text-xs text-[var(--text-muted)] italic">
                            Guidance reflects practical Vedantic principles.{" "}
                            <Link
                              to="/about#our-approach"
                              className="underline hover:text-[var(--text-secondary)]"
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
          </div>

          {/* Guidance Summary - Static sections from initial analysis */}
          {firstOutput &&
            (firstOutput.result_json.options?.length > 0 ||
              (typeof firstOutput.result_json.recommended_action === "object" &&
                (firstOutput.result_json.recommended_action.steps?.length ??
                  0) > 0) ||
              firstOutput.result_json.reflection_prompts?.length > 0) && (
              <div className="mt-8 pt-6 border-t border-[var(--border-warm-subtle)]">
                {/* Section Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[var(--badge-warm-bg)] flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-[var(--interactive-ghost-text)]"
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
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                      Guidance Summary
                    </h2>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Key insights from this consultation
                    </p>
                  </div>
                </div>

                {/* Paths/Options Section */}
                {firstOutput.result_json.options?.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowPaths(!showPaths)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-xl p-3 sm:p-4 shadow-xs border border-[var(--border-warm)] hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--badge-primary-bg)] flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-[var(--interactive-ghost-text)]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                              />
                            </svg>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[var(--interactive-ghost-text)] uppercase tracking-wide">
                              Paths to Consider
                            </div>
                            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                              {firstOutput.result_json.options.length}{" "}
                              approaches
                            </p>
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${showPaths ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>

                    {showPaths && (
                      <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                        <div className="flex sm:grid sm:grid-cols-3 gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
                          {firstOutput.result_json.options.map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedOption(idx)}
                              className={`shrink-0 w-[140px] sm:w-auto p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all h-full ${
                                selectedOption === idx
                                  ? "bg-[var(--badge-primary-bg)] border-[var(--interactive-primary)] shadow-md"
                                  : "bg-[var(--surface-elevated)] border-[var(--border-default)] hover:border-[var(--border-warm)]"
                              }`}
                            >
                              <div
                                className={`text-xs font-semibold ${selectedOption === idx ? "text-[var(--interactive-ghost-text)]" : "text-[var(--text-tertiary)]"}`}
                              >
                                Path {idx + 1}
                              </div>
                              <div
                                className={`text-sm font-medium mt-1 leading-snug ${selectedOption === idx ? "text-[var(--badge-primary-text)]" : "text-[var(--text-primary)]"}`}
                              >
                                {opt.title.replace(" Approach", "")}
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="bg-[var(--surface-elevated)] rounded-xl shadow-xs p-3 sm:p-4 border border-[var(--border-default)]">
                          <h4 className="font-semibold text-[var(--text-primary)] text-sm sm:text-base">
                            {
                              firstOutput.result_json.options[selectedOption]
                                .title
                            }
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
                            <div>
                              <div className="text-xs font-semibold text-[var(--status-success-text)] mb-1">
                                Benefits
                              </div>
                              {firstOutput.result_json.options[
                                selectedOption
                              ].pros.map((pro, i) => (
                                <div
                                  key={i}
                                  className="text-sm sm:text-base text-[var(--text-primary)] flex items-start gap-1 mb-0.5"
                                >
                                  <span className="text-[var(--status-success-text)] mt-0.5 text-xs">
                                    +
                                  </span>{" "}
                                  {pro}
                                </div>
                              ))}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[var(--text-accent)] mb-1">
                                Consider
                              </div>
                              {firstOutput.result_json.options[
                                selectedOption
                              ].cons.map((con, i) => (
                                <div
                                  key={i}
                                  className="text-sm sm:text-base text-[var(--text-primary)] flex items-start gap-1 mb-0.5"
                                >
                                  <span className="text-[var(--text-accent)] mt-0.5 text-xs">
                                    -
                                  </span>{" "}
                                  {con}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommended Steps */}
                {typeof firstOutput.result_json.recommended_action ===
                  "object" &&
                  (firstOutput.result_json.recommended_action.steps?.length ??
                    0) > 0 && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowSteps(!showSteps)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-xl p-3 sm:p-4 shadow-xs border border-[var(--status-success-border)] hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--status-success-bg)] flex items-center justify-center">
                              <svg
                                className="w-4 h-4 text-[var(--status-success-text)]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[var(--status-success-text)] uppercase tracking-wide">
                                Recommended Steps
                              </div>
                              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                                {
                                  (
                                    firstOutput.result_json
                                      .recommended_action as { steps: string[] }
                                  ).steps.length
                                }{" "}
                                actionable steps
                              </p>
                            </div>
                          </div>
                          <svg
                            className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${showSteps ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {showSteps && (
                        <div className="mt-2 sm:mt-3 bg-[var(--surface-elevated)] rounded-xl shadow-xs p-3 sm:p-4 border border-[var(--status-success-border)]">
                          <div className="space-y-2.5 sm:space-y-3">
                            {(
                              firstOutput.result_json.recommended_action as {
                                steps: string[];
                              }
                            ).steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 sm:gap-3"
                              >
                                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)] flex items-center justify-center shrink-0 text-xs font-medium">
                                  {idx + 1}
                                </div>
                                <p className="text-sm sm:text-base text-[var(--text-primary)] pt-0.5">
                                  {step}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Reflection Prompts */}
                {firstOutput.result_json.reflection_prompts?.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowReflections(!showReflections)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between bg-[var(--surface-warm)] rounded-xl p-3 sm:p-4 shadow-xs border border-[var(--border-warm)] hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--badge-warm-bg)] flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-[var(--text-accent)]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                              />
                            </svg>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[var(--text-accent)] uppercase tracking-wide">
                              Questions for Reflection
                            </div>
                            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                              {
                                firstOutput.result_json.reflection_prompts
                                  .length
                              }{" "}
                              prompts
                            </p>
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${showReflections ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>

                    {showReflections && (
                      <div className="mt-2 sm:mt-3 bg-[var(--surface-warm)] rounded-xl p-3 sm:p-4 border border-[var(--border-warm)]">
                        <ul className="space-y-2.5 sm:space-y-3">
                          {firstOutput.result_json.reflection_prompts.map(
                            (prompt, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-[var(--text-primary)]"
                              >
                                <span className="text-[var(--text-accent-muted)] mt-0.5 text-xs sm:text-sm">
                                  ◆
                                </span>
                                <span className="text-sm sm:text-base italic">
                                  {prompt}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* CTA at bottom */}
          <div className="mt-6 sm:mt-8 bg-[var(--surface-elevated)] rounded-xl shadow-md p-4 sm:p-6 text-center">
            <h3 className="font-semibold text-[var(--text-primary)] text-sm sm:text-base mb-1.5 sm:mb-2">
              Need guidance for your situation?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-3 sm:mb-4">
              Start your own consultation and receive personalized wisdom from
              the Bhagavad Geeta.
            </p>
            <Link
              to="/cases/new"
              className="inline-block px-4 sm:px-6 py-2.5 sm:py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium text-sm sm:text-base"
            >
              Start a Consultation
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

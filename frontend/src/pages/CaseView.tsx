import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { casesApi, outputsApi } from '../lib/api';
import { messagesApi } from '../api/messages';
import type { Case, Message, Output, CaseStatus, Option } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/Navbar';
import { errorMessages } from '../lib/errorMessages';
import { ConsultationWaiting } from '../components/ConsultationWaiting';
import { ConfirmModal } from '../components/ConfirmModal';
import { groupMessagesIntoExchanges } from '../lib/messageGrouping';
import {
  CaseHeader,
  OutputFeedback,
  PathsSection,
  StepsSection,
  ReflectionsSection,
  FollowUpInput,
  FollowUpThinking,
} from '../components/case';

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
  const [followUp, setFollowUp] = useState('');
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const { isAuthenticated } = useAuth();

  // Expanded state for sections
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showPaths, setShowPaths] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  const [showReflections, setShowReflections] = useState(true);

  // Feedback state
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down' | null>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});

  // Share state
  const [shareLoading, setShareLoading] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Analysis completion indicator
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [wasProcessing, setWasProcessing] = useState(false);

  // Path selection for options
  const [selectedOption, setSelectedOption] = useState(0);

  // Close share dropdown on escape key
  useEffect(() => {
    if (!showShareDropdown) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowShareDropdown(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showShareDropdown]);

  // Status-based flags for action visibility
  const isProcessing = caseData?.status === 'pending' || caseData?.status === 'processing';
  const isFailed = caseData?.status === 'failed';
  const isCompleted = caseData?.status === 'completed' || !caseData?.status;

  // Action visibility based on status
  const canSave = isCompleted && outputs.length > 0;
  const canShare = isCompleted && outputs.length > 0;
  const canDelete = true;

  // Follow-up input visibility: show when completed OR during follow-up processing (has outputs)
  const showFollowUpInput = isCompleted || (isProcessing && outputs.length > 0);
  // Follow-up is being processed (for inline thinking indicator)
  const isFollowUpProcessing = isProcessing && outputs.length > 0;

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

      // When completed/failed, clear pending state and set up UI
      const isFinished = data.status === 'completed' || data.status === 'failed' || !data.status;
      if (isFinished) {
        setPendingFollowUp(null);

        if (outputsData.length > 0) {
          setExpandedSources(new Set([outputsData[0].id]));
        }

        if (!isAuthenticated && outputsData.length > 0) {
          setShowSignupPrompt(true);
        }
      } else if (data.status === 'processing' || data.status === 'pending') {
        // During processing, detect pending follow-up from messages
        // If the last user message doesn't have a corresponding output, it's the pending one
        const userMessages = messagesData.filter(m => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];

        if (lastUserMessage && outputsData.length < userMessages.length) {
          // There's a user message without a response - that's the pending follow-up
          setPendingFollowUp(lastUserMessage.content);
        }
      }
    } catch (err) {
      setError(errorMessages.caseLoad(err));
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

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
  useEffect(() => {
    if (!isProcessing || !id) return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await casesApi.get(id);
        setCaseData(data);

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollInterval);
          loadCaseData();
        }
      } catch {
        // Silent fail - polling will retry
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isProcessing, id, loadCaseData]);

  const handleRetry = async () => {
    if (!id || !caseData) return;
    try {
      if (caseData.status === 'failed') {
        await casesApi.retry(id);
      }
      await casesApi.analyzeAsync(id);
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
      navigate('/consultations');
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
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(outputId)) newSet.delete(outputId);
      else newSet.add(outputId);
      return newSet;
    });
  };

  const handleFeedback = async (outputId: string, type: 'up' | 'down') => {
    if (feedbackLoading === outputId) return;

    const current = feedbackGiven[outputId];

    if (type === 'down' && current !== 'down') {
      setExpandedFeedback(outputId);
      return;
    }

    if (current === type) {
      setFeedbackGiven(prev => ({ ...prev, [outputId]: null }));
      setExpandedFeedback(null);
      return;
    }

    setFeedbackLoading(outputId);
    try {
      await outputsApi.submitFeedback(outputId, { rating: true });
      setFeedbackGiven(prev => ({ ...prev, [outputId]: 'up' }));
      setExpandedFeedback(null);
    } catch {
      setFeedbackGiven(prev => ({ ...prev, [outputId]: 'up' }));
    } finally {
      setFeedbackLoading(null);
    }
  };

  const handleSubmitNegativeFeedback = async (outputId: string) => {
    if (feedbackLoading === outputId) return;

    setFeedbackLoading(outputId);
    try {
      const comment = feedbackText[outputId]?.trim() || undefined;
      await outputsApi.submitFeedback(outputId, { rating: false, comment });
      setFeedbackGiven(prev => ({ ...prev, [outputId]: 'down' }));
      setExpandedFeedback(null);
    } catch {
      setFeedbackGiven(prev => ({ ...prev, [outputId]: 'down' }));
    } finally {
      setFeedbackLoading(null);
    }
  };

  const handleCancelFeedback = (outputId: string) => {
    setExpandedFeedback(null);
    setFeedbackText(prev => ({ ...prev, [outputId]: '' }));
  };

  const handleFeedbackTextChange = (outputId: string, text: string) => {
    setFeedbackText(prev => ({ ...prev, [outputId]: text }));
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !followUp.trim()) return;

    const messageContent = followUp.trim();
    setSubmittingFollowUp(true);
    setError(null);

    try {
      // Store the pending message for display
      setPendingFollowUp(messageContent);
      setFollowUp('');

      // Create the user message
      await messagesApi.create(id, { content: messageContent });

      // Trigger async analysis (returns immediately, sets case to PROCESSING)
      await casesApi.analyzeAsync(id);

      // Refresh case data to get the new status (will trigger polling)
      const data = await casesApi.get(id);
      setCaseData(data);
    } catch (err) {
      // On error, restore the message and clear pending state
      setFollowUp(messageContent);
      setPendingFollowUp(null);
      setError(errorMessages.caseAnalyze(err));
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleSave = () => {
    if (!caseData) return;

    // Get the first (main) output for paths, steps, and reflections
    const firstOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null;

    let markdown = `# ${caseData.title}

*Consultation on ${caseData.created_at ? new Date(caseData.created_at).toLocaleDateString() : 'Unknown date'}*

---

${messages.map(msg => {
  if (msg.role === 'user') {
    return `## Question\n\n${msg.content}\n`;
  } else {
    const msgOutput = outputs.find(o => o.id === msg.output_id);
    let text = `## Guidance\n\n${msg.content}\n`;
    if (msgOutput?.result_json.sources?.length) {
      text += `\n### Verse References\n\n${msgOutput.result_json.sources.map(s =>
        `- **${s.canonical_id.replace(/_/g, ' ')}**: "${s.paraphrase}"`
      ).join('\n')}\n`;
    }
    return text;
  }
}).join('\n---\n\n')}

---
`;

    // Add Guidance Summary section header if any summary sections exist
    const hasPaths = firstOutput && firstOutput.result_json.options?.length > 0;
    const hasSteps = firstOutput && typeof firstOutput.result_json.recommended_action === 'object' && (firstOutput.result_json.recommended_action as { steps?: string[] })?.steps?.length;
    const hasReflections = firstOutput && firstOutput.result_json.reflection_prompts?.length > 0;

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
          markdown += '\n';
        }

        if (option.cons?.length) {
          markdown += `**Considerations:**\n`;
          option.cons.forEach((con: string) => {
            markdown += `- ${con}\n`;
          });
          markdown += '\n';
        }

        if (option.sources?.length) {
          markdown += `**Related Verses:** ${option.sources.join(', ')}\n\n`;
        }
      });
      markdown += `---\n`;
    }

    // Add Recommended Steps
    if (hasSteps) {
      markdown += `\n## Recommended Steps\n\n`;
      const recommendedAction = firstOutput.result_json.recommended_action as { steps?: string[]; sources?: string[] };
      (recommendedAction.steps ?? []).forEach((step: string, idx: number) => {
        markdown += `${idx + 1}. ${step}\n`;
      });

      if (recommendedAction.sources?.length) {
        markdown += `\n**Supporting Verses:** ${recommendedAction.sources.join(', ')}\n`;
      }
      markdown += `\n---\n`;
    }

    // Add Reflection Prompts
    if (hasReflections) {
      markdown += `\n## Reflection Prompts\n\nTake time to reflect on these questions:\n\n`;
      firstOutput.result_json.reflection_prompts.forEach((prompt: string, idx: number) => {
        markdown += `${idx + 1}. ${prompt}\n`;
      });
      markdown += `\n---\n`;
    }

    markdown += `\n*Exported from Geetanjali*\n`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultation-${caseData.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleShare = async () => {
    if (!caseData || !id) return;

    setShareLoading(true);
    try {
      const newIsPublic = !caseData.is_public;
      const updated = await casesApi.toggleShare(id, newIsPublic);
      setCaseData(updated);

      if (newIsPublic) {
        setCopySuccess(false);
      } else {
        setShowShareDropdown(false);
      }
    } catch {
      setError(`Failed to ${caseData.is_public ? 'make private' : 'share'}`);
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
    [messages, outputs]
  );

  // Get first output for paths/steps/reflections
  const firstOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading consultation...</div>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Consultation not found</p>
            <Link to="/" className="text-red-600 hover:text-red-700">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-red-50 flex flex-col overflow-x-hidden">
      <Navbar />

      <CaseHeader
        caseData={caseData}
        canSave={canSave}
        canDelete={canDelete}
        canShare={canShare}
        shareLoading={shareLoading}
        showShareDropdown={showShareDropdown}
        copySuccess={copySuccess}
        onSave={handleSave}
        onDeleteClick={handleDeleteClick}
        onToggleShareDropdown={() => setShowShareDropdown(!showShareDropdown)}
        onToggleShare={handleToggleShare}
        onCopyShareLink={copyShareLink}
      />

      <div className="flex-1 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto px-3 sm:px-4">
          {/* Analysis Complete Banner */}
          {showCompletionBanner && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-800 font-medium">Analysis Complete</p>
                  <p className="text-green-600 text-sm">Your guidance is ready below</p>
                </div>
              </div>
              <button
                onClick={() => setShowCompletionBanner(false)}
                className="text-green-500 hover:text-green-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Signup reminder */}
          {showSignupPrompt && !isAuthenticated && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <Link to="/signup" className="text-orange-600 hover:text-orange-700 font-medium">Sign up</Link>
                {' '}to save this consultation permanently.
              </p>
              <button
                onClick={() => setShowSignupPrompt(false)}
                className="text-gray-400 hover:text-gray-600 ml-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Processing/Failed state - only show for initial case (no outputs yet) */}
          {(isProcessing || isFailed) && outputs.length === 0 && (
            <div className="mb-8">
              <ConsultationWaiting status={caseData.status as CaseStatus} onRetry={handleRetry} />
            </div>
          )}

          {/* Main Content - Timeline */}
          {(isCompleted || isFollowUpProcessing) && (
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-2.5 sm:left-3 top-6 bottom-0 w-0.5 bg-gradient-to-b from-amber-300 via-orange-300 to-red-300" />

              {/* Exchanges */}
              {exchanges.map((exchange, exchangeIdx) => {
                const isFirst = exchangeIdx === 0;
                const isSourcesExpanded = exchange.output ? expandedSources.has(exchange.output.id) : false;
                const feedback = exchange.output ? feedbackGiven[exchange.output.id] : null;

                return (
                  <div key={exchange.user.id}>
                    {/* Question */}
                    <div className="relative pl-8 sm:pl-10 pb-3 sm:pb-4">
                      <div className={`absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ${
                        isFirst ? 'bg-amber-500 text-white' : 'bg-blue-100 border-2 border-blue-400'
                      }`}>
                        {isFirst ? (
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <span className="text-xs text-blue-700">+</span>
                        )}
                      </div>
                      <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isFirst ? 'text-amber-700' : 'text-blue-600'
                      }`}>
                        {isFirst ? 'Your Question' : 'Follow-up'}
                      </div>
                      <div className={`rounded-xl p-3 sm:p-4 ${
                        isFirst ? 'bg-white shadow-lg border-2 border-amber-200' : 'bg-blue-50 border border-blue-100'
                      }`}>
                        <p className={`leading-relaxed whitespace-pre-wrap ${isFirst ? 'text-gray-900 text-sm sm:text-base' : 'text-gray-700 text-sm'}`}>
                          {exchange.user.content}
                        </p>
                        {isFirst && (caseData.stakeholders.length > 1 || caseData.stakeholders[0] !== 'self' ||
                          caseData.constraints.length > 0 || caseData.role !== 'Individual') && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {caseData.role !== 'Individual' && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                                {caseData.role}
                              </span>
                            )}
                            {caseData.stakeholders.filter(s => s !== 'self').map((s, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Response */}
                    <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
                      <div className={`absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ${
                        isFirst ? 'bg-orange-500 text-white' : 'bg-orange-100 border-2 border-orange-300'
                      }`}>
                        {isFirst ? (
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : (
                          <span className="text-xs text-orange-600">~</span>
                        )}
                      </div>
                      <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isFirst ? 'text-orange-700' : 'text-orange-600'
                      }`}>
                        {isFirst ? 'Wisdom from the Geeta' : 'Guidance'}
                      </div>

                      <div className={`rounded-xl p-3 sm:p-4 border ${
                        isFirst ? 'bg-white shadow-lg border-orange-200' : 'bg-white shadow-md border-orange-100'
                      }`}>
                        <p className={`leading-relaxed whitespace-pre-wrap ${isFirst ? 'text-gray-900 text-sm sm:text-base' : 'text-gray-800 text-sm'}`}>
                          {exchange.assistant.content}
                        </p>

                        {/* Scholar flag */}
                        {exchange.output?.scholar_flag && (
                          <div className="mt-3 flex items-center gap-2 text-yellow-700 text-sm bg-yellow-50 px-3 py-2 rounded-lg">
                            <span>⚠️</span>
                            <span>Low confidence - consider seeking expert guidance</span>
                          </div>
                        )}

                        {/* Verse Sources */}
                        {exchange.output && exchange.output.result_json.sources?.length > 0 && (
                          <div className="mt-4">
                            <button
                              onClick={() => exchange.output && toggleSources(exchange.output.id)}
                              className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1"
                            >
                              <svg className={`w-3 h-3 transition-transform ${isSourcesExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {exchange.output.result_json.sources.length} verse reference{exchange.output.result_json.sources.length > 1 ? 's' : ''}
                            </button>

                            {isSourcesExpanded && (
                              <div className="mt-3 space-y-2">
                                {exchange.output.result_json.sources.map((source) => (
                                  <div key={source.canonical_id} className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-100">
                                    <div className="flex items-center justify-between">
                                      <Link to={`/verses/${source.canonical_id}`} className="font-mono text-orange-700 font-semibold text-sm hover:underline">
                                        {source.canonical_id.replace(/_/g, ' ')}
                                      </Link>
                                    </div>
                                    <p className="mt-1.5 text-gray-700 italic text-sm">
                                      "{source.paraphrase}"
                                    </p>
                                  </div>
                                ))}
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
                            feedbackText={feedbackText}
                            onFeedback={handleFeedback}
                            onSubmitNegativeFeedback={handleSubmitNegativeFeedback}
                            onCancelFeedback={handleCancelFeedback}
                            onFeedbackTextChange={handleFeedbackTextChange}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Follow-up thinking indicator */}
              {isFollowUpProcessing && pendingFollowUp && (
                <FollowUpThinking pendingMessage={pendingFollowUp} />
              )}

              {/* Follow-up Input - at end of conversation flow */}
              {showFollowUpInput && (
                <div className="relative pl-8 sm:pl-10 pt-2 pb-4">
                  <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <FollowUpInput
                    value={followUp}
                    submitting={submittingFollowUp}
                    disabled={isFollowUpProcessing}
                    onChange={setFollowUp}
                    onSubmit={handleFollowUpSubmit}
                  />
                </div>
              )}
            </div>
          )}

          {/* Guidance Summary - Static sections from initial analysis */}
          {firstOutput && (
            firstOutput.result_json.options?.length > 0 ||
            (typeof firstOutput.result_json.recommended_action === 'object' &&
             (firstOutput.result_json.recommended_action.steps?.length ?? 0) > 0) ||
            firstOutput.result_json.reflection_prompts?.length > 0
          ) && (
            <div className="mt-8 pt-6 border-t border-orange-200/50">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Guidance Summary</h2>
                  <p className="text-xs text-gray-500">Key insights from your consultation</p>
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
              {typeof firstOutput.result_json.recommended_action === 'object' &&
               (firstOutput.result_json.recommended_action.steps?.length ?? 0) > 0 && (
                <StepsSection
                  steps={(firstOutput.result_json.recommended_action as { steps: string[] }).steps}
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

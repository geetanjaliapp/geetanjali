import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { casesApi, outputsApi } from '../lib/api';
import { messagesApi } from '../api/messages';
import type { Case, Message, Output, CaseStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/Navbar';
import { errorMessages } from '../lib/errorMessages';
import { ConsultationWaiting } from '../components/ConsultationWaiting';

export default function CaseView() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');
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

  // Share state
  const [shareLoading, setShareLoading] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Path selection for options
  const [selectedOption, setSelectedOption] = useState(0);

  // Check if case is still processing
  const isProcessing = caseData?.status === 'pending' || caseData?.status === 'processing';

  const loadCaseData = useCallback(async () => {
    if (!id) return;

    try {
      const data = await casesApi.get(id);
      setCaseData(data);

      // Expand sources for first output by default
      if (data.status === 'completed' || data.status === 'failed' || !data.status) {
        const messagesData = await messagesApi.list(id);
        setMessages(messagesData);

        const outputsData = await outputsApi.listByCaseId(id);
        setOutputs(outputsData);

        // Expand first output's sources by default
        if (outputsData.length > 0) {
          setExpandedSources(new Set([outputsData[0].id]));
        }

        if (!isAuthenticated && outputsData.length > 0) {
          setShowSignupPrompt(true);
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
    if (!id) return;
    try {
      await casesApi.analyzeAsync(id);
      const data = await casesApi.get(id);
      setCaseData(data);
      setError(null);
    } catch (err) {
      setError(errorMessages.caseAnalyze(err));
    }
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

    // Toggle if same feedback
    const current = feedbackGiven[outputId];
    const newValue = current === type ? null : type;

    setFeedbackLoading(outputId);
    try {
      if (newValue !== null) {
        await outputsApi.submitFeedback(outputId, { rating: newValue === 'up' });
      }
      setFeedbackGiven(prev => ({ ...prev, [outputId]: newValue }));
    } catch {
      // Could be 409 if already submitted - treat as success
      setFeedbackGiven(prev => ({ ...prev, [outputId]: newValue }));
    } finally {
      setFeedbackLoading(null);
    }
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !followUp.trim()) return;

    setSubmittingFollowUp(true);
    setError(null);

    try {
      await messagesApi.create(id, { content: followUp.trim() });
      const newOutput = await casesApi.analyze(id);
      const messagesData = await messagesApi.list(id);
      setMessages(messagesData);
      setOutputs(prev => [newOutput, ...prev]);
      setFollowUp('');
    } catch (err) {
      setError(errorMessages.caseAnalyze(err));
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleSave = () => {
    if (!caseData) return;

    // Generate markdown content
    const markdown = `# ${caseData.title}

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

*Exported from Geetanjali*
`;

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
      // Show success feedback
      if (newIsPublic) {
        setCopySuccess(false); // Reset copy state for new link
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

  // Group messages into exchanges
  const getOutput = (outputId?: string) => outputs.find(o => o.id === outputId);

  type Exchange = {
    user: Message;
    assistant: Message;
    output: Output | undefined;
  };

  const exchanges: Exchange[] = [];
  for (let i = 0; i < messages.length; i += 2) {
    if (messages[i] && messages[i + 1]) {
      exchanges.push({
        user: messages[i],
        assistant: messages[i + 1],
        output: getOutput(messages[i + 1].output_id),
      });
    }
  }

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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-red-50 flex flex-col">
      <Navbar />

      {/* Header - Sticky */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-amber-200/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <Link to="/consultations" className="text-amber-700 hover:text-amber-800 text-sm flex items-center gap-1">
          ← Back
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 bg-white rounded-lg shadow-sm text-gray-700 hover:bg-gray-50 border border-gray-200 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Save
          </button>
          <div className="relative">
            <button
              onClick={() => setShowShareDropdown(!showShareDropdown)}
              className={`text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 ${
                caseData.is_public
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {caseData.is_public ? 'Shared' : 'Share'}
              <svg className={`w-3 h-3 transition-transform ${showShareDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Share Dropdown */}
            {showShareDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <div className="fixed inset-0 z-10" onClick={() => setShowShareDropdown(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-20 p-4">
                  {/* Visibility Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Public sharing</div>
                      <div className="text-xs text-gray-500">Anyone with link can view</div>
                    </div>
                    <button
                      onClick={handleToggleShare}
                      disabled={shareLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        caseData.is_public ? 'bg-green-500' : 'bg-gray-200'
                      } ${shareLoading ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          caseData.is_public ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Share Link (only when public) */}
                  {caseData.is_public && caseData.public_slug && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">Share link</div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}/c/${caseData.public_slug}`}
                          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700 font-mono"
                        />
                        <button
                          onClick={copyShareLink}
                          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-medium"
                        >
                          {copySuccess ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Private notice */}
                  {!caseData.is_public && (
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                      Turn on to create a shareable link
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 py-6">
        <div className="max-w-2xl mx-auto px-4">
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

          {/* Processing state */}
          {isProcessing && (
            <div className="mb-8">
              <ConsultationWaiting status={caseData.status as CaseStatus} onRetry={handleRetry} />
            </div>
          )}

          {/* Failed state */}
          {caseData.status === 'failed' && !isProcessing && (
            <div className="mb-8">
              <ConsultationWaiting status={caseData.status as CaseStatus} onRetry={handleRetry} />
            </div>
          )}

          {/* Main Content - Timeline */}
          {(caseData.status === 'completed' || !caseData.status) && (
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gradient-to-b from-amber-300 via-orange-300 to-red-300" />

              {/* Exchanges */}
              {exchanges.map((exchange, exchangeIdx) => {
                const isFirst = exchangeIdx === 0;
                const isSourcesExpanded = exchange.output ? expandedSources.has(exchange.output.id) : false;
                const feedback = exchange.output ? feedbackGiven[exchange.output.id] : null;

                return (
                  <div key={exchange.user.id}>
                    {/* Question */}
                    <div className="relative pl-10 pb-4">
                      <div className={`absolute left-0 w-7 h-7 rounded-full flex items-center justify-center ${
                        isFirst ? 'bg-amber-500 text-white' : 'bg-blue-100 border-2 border-blue-400'
                      }`}>
                        {isFirst ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <div className={`rounded-xl p-4 ${
                        isFirst ? 'bg-white shadow-lg border-2 border-amber-200' : 'bg-blue-50 border border-blue-100'
                      }`}>
                        <p className={`leading-relaxed whitespace-pre-wrap ${isFirst ? 'text-gray-900 text-base' : 'text-gray-700 text-sm'}`}>
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
                    <div className="relative pl-10 pb-6">
                      <div className={`absolute left-0 w-7 h-7 rounded-full flex items-center justify-center ${
                        isFirst ? 'bg-orange-500 text-white' : 'bg-orange-100 border-2 border-orange-300'
                      }`}>
                        {isFirst ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : (
                          <span className="text-xs text-orange-600">~</span>
                        )}
                      </div>
                      <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isFirst ? 'text-orange-700' : 'text-orange-600'
                      }`}>
                        {isFirst ? 'Wisdom from the Gita' : 'Guidance'}
                      </div>

                      <div className={`rounded-xl p-4 border ${
                        isFirst ? 'bg-white shadow-lg border-orange-200' : 'bg-white shadow-md border-orange-100'
                      }`}>
                        <p className={`leading-relaxed whitespace-pre-wrap ${isFirst ? 'text-gray-900' : 'text-gray-800 text-sm'}`}>
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
                          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>Confidence:</span>
                              <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    exchange.output.confidence >= 0.8 ? 'bg-green-500' :
                                    exchange.output.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${exchange.output.confidence * 100}%` }}
                                />
                              </div>
                              <span className="font-medium">{(exchange.output.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => exchange.output && handleFeedback(exchange.output.id, 'up')}
                                disabled={feedbackLoading === exchange.output?.id}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                  feedback === 'up'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                              </button>
                              <button
                                onClick={() => exchange.output && handleFeedback(exchange.output.id, 'down')}
                                disabled={feedbackLoading === exchange.output?.id}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                  feedback === 'down'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Paths/Options Section */}
              {firstOutput && firstOutput.result_json.options?.length > 0 && (
                <div className="relative pl-10 pb-4">
                  <div className="absolute left-0 w-7 h-7 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>

                  <button onClick={() => setShowPaths(!showPaths)} className="w-full text-left">
                    <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-red-100 hover:shadow-md transition-shadow">
                      <div>
                        <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                          Paths Before You
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {firstOutput.result_json.options.length} approaches to consider
                        </p>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${showPaths ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {showPaths && (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                        {firstOutput.result_json.options.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedOption(idx)}
                            className={`flex-shrink-0 w-28 p-3 rounded-xl border-2 text-left transition-all ${
                              selectedOption === idx
                                ? 'bg-red-50 border-red-400 shadow-md'
                                : 'bg-white border-gray-200 hover:border-red-200'
                            }`}
                          >
                            <div className={`text-xs font-semibold ${selectedOption === idx ? 'text-red-700' : 'text-gray-500'}`}>
                              Path {idx + 1}
                            </div>
                            <div className={`text-sm font-medium mt-1 leading-tight ${selectedOption === idx ? 'text-red-900' : 'text-gray-700'}`}>
                              {opt.title.replace(' Approach', '')}
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="bg-white rounded-xl shadow-sm p-4 border border-red-100">
                        <h4 className="font-semibold text-gray-900">
                          {firstOutput.result_json.options[selectedOption].title}
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <div className="text-xs font-semibold text-green-700 mb-1">Benefits</div>
                            {firstOutput.result_json.options[selectedOption].pros.map((pro, i) => (
                              <div key={i} className="text-sm text-gray-700 flex items-start gap-1 mb-0.5">
                                <span className="text-green-500 mt-0.5 text-xs">+</span> {pro}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-amber-700 mb-1">Consider</div>
                            {firstOutput.result_json.options[selectedOption].cons.map((con, i) => (
                              <div key={i} className="text-sm text-gray-700 flex items-start gap-1 mb-0.5">
                                <span className="text-amber-500 mt-0.5 text-xs">-</span> {con}
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
              {firstOutput && typeof firstOutput.result_json.recommended_action === 'object' &&
               (firstOutput.result_json.recommended_action.steps?.length ?? 0) > 0 && (
                <div className="relative pl-10 pb-4">
                  <div className="absolute left-0 w-7 h-7 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  <button onClick={() => setShowSteps(!showSteps)} className="w-full text-left">
                    <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-green-100 hover:shadow-md transition-shadow">
                      <div>
                        <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                          Recommended Steps
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {(firstOutput.result_json.recommended_action as { steps: string[] }).steps.length} actionable steps
                        </p>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${showSteps ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {showSteps && (
                    <div className="mt-3 bg-white rounded-xl shadow-sm p-4 border border-green-100">
                      <div className="space-y-3">
                        {(firstOutput.result_json.recommended_action as { steps: string[] }).steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-gray-700 pt-0.5">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reflection Prompts */}
              {firstOutput && firstOutput.result_json.reflection_prompts?.length > 0 && (
                <div className="relative pl-10 pb-6">
                  <div className="absolute left-0 w-7 h-7 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>

                  <button onClick={() => setShowReflections(!showReflections)} className="w-full text-left">
                    <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 shadow-sm border border-purple-100 hover:shadow-md transition-shadow">
                      <div>
                        <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                          Questions for Reflection
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {firstOutput.result_json.reflection_prompts.length} prompts for deeper insight
                        </p>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${showReflections ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {showReflections && (
                    <div className="mt-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                      <ul className="space-y-3">
                        {firstOutput.result_json.reflection_prompts.map((prompt, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-700">
                            <span className="text-purple-400 mt-1">◆</span>
                            <span className="text-sm italic">{prompt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Follow-up Input */}
          {(caseData.status === 'completed' || !caseData.status) && (
            <div className="mt-4 bg-white rounded-xl shadow-md p-4">
              <form onSubmit={handleFollowUpSubmit}>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={submittingFollowUp}
                  />
                  <button
                    type="submit"
                    disabled={!followUp.trim() || submittingFollowUp}
                    className="px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {submittingFollowUp ? '...' : 'Ask'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

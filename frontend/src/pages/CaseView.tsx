import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { casesApi, outputsApi } from '../lib/api';
import { messagesApi } from '../api/messages';
import type { Case, Message, Output } from '../types';
import OptionTable from '../components/OptionTable';

export default function CaseView() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;

    const loadCase = async () => {
      try {
        // Load case data
        const data = await casesApi.get(id);
        setCaseData(data);

        // Load messages (conversation thread)
        const messagesData = await messagesApi.list(id);
        setMessages(messagesData);

        // Load outputs (for detailed content)
        const outputsData = await outputsApi.listByCaseId(id);
        setOutputs(outputsData);
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to load consultation');
      } finally {
        setLoading(false);
      }
    };

    loadCase();
  }, [id]);

  const toggleExpanded = (outputId: string) => {
    setExpandedOutputs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(outputId)) {
        newSet.delete(outputId);
      } else {
        newSet.add(outputId);
      }
      return newSet;
    });
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !followUp.trim()) return;

    setSubmittingFollowUp(true);
    setError(null);

    try {
      // Create the user message
      await messagesApi.create(id, { content: followUp.trim() });

      // Trigger analysis
      const newOutput = await casesApi.analyze(id);

      // Reload messages to get the full conversation thread
      const messagesData = await messagesApi.list(id);
      setMessages(messagesData);

      // Add new output to list
      setOutputs(prev => [newOutput, ...prev]);

      // Clear the input
      setFollowUp('');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to send follow-up');
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-gray-600">Loading consultation...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Consultation not found</p>
          <Link to="/" className="text-red-600 hover:text-red-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <Link to="/" className="text-red-600 hover:text-red-700">
              ← Back to Home
            </Link>
            <Link to="/consultations" className="text-red-600 hover:text-red-700">
              View All Consultations →
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{caseData.title}</h1>
          {caseData.created_at && (
            <p className="text-gray-500 text-sm mt-2">
              {new Date(caseData.created_at).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Conversation Thread */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {messages.map((message, idx) => {
              if (message.role === 'user') {
                // User message bubble (right side)
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="bg-red-100 rounded-2xl rounded-tr-sm p-6 max-w-3xl">
                      <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {idx === 0 && (caseData.stakeholders.length > 1 || caseData.stakeholders[0] !== 'self' ||
                        caseData.constraints.length > 0 || caseData.role !== 'Individual') && (
                        <div className="mt-4 pt-4 border-t border-red-200">
                          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                            {caseData.role !== 'Individual' && <span className="bg-white px-2 py-1 rounded">👤 {caseData.role}</span>}
                            {(caseData.stakeholders.length > 1 || caseData.stakeholders[0] !== 'self') &&
                              <span className="bg-white px-2 py-1 rounded">👥 {caseData.stakeholders.join(', ')}</span>}
                            {caseData.constraints.length > 0 &&
                              <span className="bg-white px-2 py-1 rounded">⚠️ {caseData.constraints.join(', ')}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else {
                // Assistant message bubble (left side)
                const output = outputs.find(o => o.id === message.output_id);
                const isExpanded = message.output_id ? expandedOutputs.has(message.output_id) : false;

                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-tl-sm shadow-lg p-6 max-w-3xl">
                      {/* Scholar Flag */}
                      {output?.scholar_flag && (
                        <div className="mb-4 flex items-center gap-2 text-yellow-700 text-sm">
                          <span>⚠️</span>
                          <span>Low confidence - consider seeking expert guidance</span>
                        </div>
                      )}

                      {/* Main Guidance */}
                      <div className="prose prose-lg max-w-none">
                        <p className="text-gray-800 leading-relaxed">{message.content}</p>
                      </div>

                      {/* Recommended Action */}
                      {output?.result_json.recommended_action && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h3 className="font-semibold text-gray-900 mb-3">Recommended Path:</h3>
                          {typeof output.result_json.recommended_action === 'string' ? (
                            <p className="text-gray-700 leading-relaxed">{output.result_json.recommended_action}</p>
                          ) : (
                            <div className="space-y-2">
                              {output.result_json.recommended_action.option && (
                                <p className="text-gray-700">Consider Option {output.result_json.recommended_action.option}</p>
                              )}
                              {output.result_json.recommended_action.steps && output.result_json.recommended_action.steps.length > 0 && (
                                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-2">
                                  {output.result_json.recommended_action.steps.map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show Details Toggle */}
                      {output && (
                        <div className="mt-6">
                          <button
                            onClick={() => message.output_id && toggleExpanded(message.output_id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                          >
                            {isExpanded ? '− Hide details' : '+ Show all paths & reflections'}
                          </button>
                        </div>
                      )}

                      {/* Detailed View (Collapsible) */}
                      {output && isExpanded && (
                        <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
                          {/* All Options */}
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-4">All Paths to Consider:</h3>
                            <OptionTable options={output.result_json.options} />
                          </div>

                          {/* Reflection Prompts */}
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-3">Questions to Reflect On:</h3>
                            <ul className="space-y-2">
                              {output.result_json.reflection_prompts.map((prompt, i) => (
                                <li key={i} className="text-gray-700 flex gap-2">
                                  <span className="text-red-600 mt-1">•</span>
                                  <span>{prompt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Sources */}
                          {output.result_json.sources && output.result_json.sources.length > 0 && (
                            <div>
                              <h3 className="font-semibold text-gray-900 mb-3">Referenced Verses:</h3>
                              <div className="space-y-3">
                                {output.result_json.sources.map((source, i) => (
                                  <div key={i} className="text-sm">
                                    <span className="font-mono text-red-600 font-medium">{source.canonical_id}</span>
                                    <p className="text-gray-600 mt-1 italic">{source.paraphrase}</p>
                                    {source.school && <span className="text-gray-500 text-xs">({source.school})</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Confidence Badge */}
                      {output && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                          <span>Confidence:</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[100px]">
                            <div
                              className={`h-1.5 rounded-full ${
                                output.confidence >= 0.8 ? 'bg-green-500' : output.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${output.confidence * 100}%` }}
                            />
                          </div>
                          <span className="font-medium">{(output.confidence * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            })}

            {/* Follow-up Input */}
            <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Continue the conversation</h3>
              <form onSubmit={handleFollowUpSubmit}>
                <textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Ask a follow-up question or share your thoughts..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  disabled={submittingFollowUp}
                />
                <div className="mt-3 flex justify-between items-center">
                  <p className="text-sm text-gray-500">Your follow-up will be added to this conversation thread</p>
                  <button
                    type="submit"
                    disabled={!followUp.trim() || submittingFollowUp}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {submittingFollowUp ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

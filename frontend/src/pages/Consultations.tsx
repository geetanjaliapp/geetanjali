import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { casesApi } from '../lib/api';
import type { Case, CaseStatus } from '../types';
import { Navbar } from '../components/Navbar';
import { errorMessages } from '../lib/errorMessages';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

// Status badge component
function StatusBadge({ status }: { status?: CaseStatus }) {
  if (!status || status === 'completed') {
    return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Completed</span>;
  }
  if (status === 'processing' || status === 'pending') {
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
        <span className="animate-pulse">●</span> Processing
      </span>
    );
  }
  if (status === 'failed') {
    return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Failed</span>;
  }
  return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Draft</span>;
}

export default function Consultations() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const handleRetry = async (e: React.MouseEvent, caseId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading(caseId);
    setError(null);
    try {
      const updatedCase = await casesApi.retry(caseId);
      setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
      // Navigate to the case view to trigger analysis
      navigate(`/cases/${caseId}`);
    } catch (err) {
      setError(errorMessages.general(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, caseId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id: caseId, title });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    setError(null);
    try {
      await casesApi.delete(deleteTarget.id);
      setCases(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(errorMessages.general(err));
      setDeleteTarget(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCancel = () => {
    if (!actionLoading) {
      setDeleteTarget(null);
    }
  };

  useEffect(() => {
    // Wait for auth to complete before fetching cases
    // This ensures token refresh happens first after page reload
    if (authLoading) return;

    casesApi.list(0, 100)
      .then(setCases)
      .catch((err) => setError(errorMessages.caseLoad(err)))
      .finally(() => setLoading(false));
  }, [authLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading your consultations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />
      <div className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Your Consultations</h1>
            <Link
              to="/cases/new"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Ask a Question
            </Link>
          </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Anonymous user notice */}
        {!isAuthenticated && cases.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-amber-600 text-lg">💡</span>
            <div>
              <p className="text-amber-800 text-sm">
                These consultations are stored in your browser session.
                <Link to="/signup" className="ml-1 text-amber-700 hover:text-amber-900 underline font-medium">
                  Create an account
                </Link>
                {' '}to save them permanently and access from any device.
              </p>
            </div>
          </div>
        )}

        {/* Consultations List */}
        {cases.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-5xl mb-4">🪷</div>
            <p className="text-gray-600 mb-6">You haven't asked any questions yet.</p>
            <Link
              to="/cases/new"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Ask Your First Question
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cases.map((case_) => (
              <div
                key={case_.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 hover:border-red-200 overflow-hidden"
              >
                <Link to={`/cases/${case_.id}`} className="block p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">{case_.title}</h2>
                        <StatusBadge status={case_.status} />
                      </div>
                      <p className="text-sm text-gray-400">
                        {new Date(case_.created_at || '').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 ml-4">
                      {case_.status === 'failed' && (
                        <button
                          onClick={(e) => handleRetry(e, case_.id)}
                          disabled={actionLoading === case_.id}
                          className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-full transition-colors disabled:opacity-50"
                          title="Retry analysis"
                        >
                          {actionLoading === case_.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDeleteClick(e, case_.id, case_.title)}
                        disabled={actionLoading === case_.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                        title="Delete consultation"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-3">{case_.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {case_.role && case_.role !== 'Individual' && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        👤 {case_.role}
                      </span>
                    )}
                    {case_.stakeholders && case_.stakeholders.length > 0 && case_.stakeholders[0] !== 'self' && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        👥 {case_.stakeholders.join(', ')}
                      </span>
                    )}
                    {case_.horizon && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        ⏱️ {case_.horizon} term
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Consultation"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        loading={!!actionLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

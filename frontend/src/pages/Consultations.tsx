import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { casesApi } from '../lib/api';
import type { Case } from '../types';

export default function Consultations() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    casesApi.list(0, 100)
      .then(setCases)
      .catch((err) => setError(err.response?.data?.detail || err.message || 'Failed to load consultations'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-gray-600">Loading your consultations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="Geetanjali" className="h-16 w-16" />
            </Link>
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-gray-900">Your Consultations</h1>
            <Link
              to="/cases/new"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Ask a Question
            </Link>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Consultations List */}
        {cases.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <p className="text-gray-600 mb-6">You haven't asked any questions yet.</p>
            <Link
              to="/cases/new"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Ask Your First Question
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="space-y-4">
              {cases.map((case_) => (
                <Link
                  key={case_.id}
                  to={`/cases/${case_.id}`}
                  className="block p-6 border border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-all hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-xl font-semibold text-gray-900 flex-1">{case_.title}</h2>
                    <div className="text-sm text-gray-400 ml-4">
                      {new Date(case_.created_at || '').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4 line-clamp-2">{case_.description}</p>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Role: {case_.role}</span>
                    <span>•</span>
                    <span>Horizon: {case_.horizon}</span>
                    {case_.stakeholders && case_.stakeholders.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{case_.stakeholders.length} stakeholder{case_.stakeholders.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

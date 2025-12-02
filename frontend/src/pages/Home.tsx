import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { checkHealth, casesApi, versesApi } from '../lib/api';
import type { Case, Verse } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { VerseCard } from '../components/VerseCard';

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [dailyVerse, setDailyVerse] = useState<Verse | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkHealth()
      .catch((err) => setError(err.message));

    // Load recent consultations only if authenticated
    if (isAuthenticated) {
      casesApi.list(0, 5)
        .then(setRecentCases)
        .catch((err) => console.error('Failed to load recent cases:', err))
        .finally(() => setCasesLoading(false));
    } else {
      setCasesLoading(false);
    }

    // Load random verse
    versesApi.getRandom()
      .then(setDailyVerse)
      .catch((err) => console.error('Failed to load verse:', err))
      .finally(() => setVerseLoading(false));
  }, [isAuthenticated]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="Geetanjali" className="h-10 w-10" />
              <span className="text-2xl font-serif font-bold text-orange-600">Geetanjali</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                to="/verses"
                className="text-gray-700 hover:text-orange-600 font-medium"
              >
                Browse Verses
              </Link>
              {isAuthenticated ? (
                <>
                  <span className="text-gray-500">|</span>
                  <Link
                    to="/consultations"
                    className="text-gray-700 hover:text-orange-600 font-medium"
                  >
                    My Consultations
                  </Link>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-700">
                    {user?.name}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-orange-600 font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <span className="text-gray-500">|</span>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-orange-600 font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Geetanjali" className="h-24 w-24" />
          </div>
          <p className="text-xl text-gray-600 mb-4">
            Ethical leadership guidance from the Bhagavad Gita
          </p>
          {!isAuthenticated && (
            <p className="text-sm text-gray-500 mb-8">
              Try it now - no signup required. Create an account to save your consultations.
            </p>
          )}

          {/* Backend Status - Only show errors */}
          {error && (
            <div className="mb-8 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-semibold mb-1">Service Unavailable</p>
                  <p className="text-sm text-red-600">Unable to connect to the service. Please try again later.</p>
                </div>
              </div>
            </div>
          )}

          {/* Verse of the Day */}
          {!verseLoading && dailyVerse && (
            <div className="mb-12 max-w-3xl mx-auto">
              <VerseCard verse={dailyVerse} />
            </div>
          )}

          {/* CTA Button */}
          <div className="mb-12">
            <Link
              to="/cases/new"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-12 py-4 rounded-lg transition-colors shadow-lg text-lg"
            >
              Ask a Question
            </Link>
          </div>

          {/* Recent Consultations */}
          {!casesLoading && recentCases.length > 0 && (
            <div className="mb-16 max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Recent Consultations</h2>
                  <Link to="/consultations" className="text-red-600 hover:text-red-700 font-medium">
                    View All →
                  </Link>
                </div>
                <div className="space-y-4">
                  {recentCases.map((case_) => (
                    <Link
                      key={case_.id}
                      to={`/cases/${case_.id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1">{case_.title}</h3>
                          <p className="text-sm text-gray-500 line-clamp-2">{case_.description}</p>
                        </div>
                        <div className="text-xs text-gray-400 ml-4">
                          {new Date(case_.created_at || '').toLocaleDateString()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Feature Overview */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Clear Guidance</h3>
              <p className="text-gray-600">
                Practical wisdom for life's difficult decisions
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Multiple Perspectives</h3>
              <p className="text-gray-600">
                Explore different approaches with pros and cons
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Grounded in Wisdom</h3>
              <p className="text-gray-600">
                Every insight backed by verses from the Gita
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

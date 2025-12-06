import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { checkHealth, casesApi, versesApi } from '../lib/api';
import type { Case, Verse } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { FeaturedVerse } from '../components/FeaturedVerse';
import { Navbar } from '../components/Navbar';

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [dailyVerse, setDailyVerse] = useState<Verse | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  // Cases loading state - only relevant when authenticated
  const [casesLoading, setCasesLoading] = useState(isAuthenticated);

  // Check backend health on mount
  useEffect(() => {
    checkHealth().catch((err) => setError(err.message));
  }, []);

  // Load recent consultations when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    casesApi.list(0, 3)
      .then((data) => {
        if (!cancelled) setRecentCases(data);
      })
      .catch(() => { /* Silent fail - cases section just won't show */ })
      .finally(() => {
        if (!cancelled) setCasesLoading(false);
      });

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Load random verse on mount
  useEffect(() => {
    let cancelled = false;
    versesApi.getRandom()
      .then((data) => {
        if (!cancelled) {
          setDailyVerse(data);
        }
      })
      .catch(() => { /* Silent fail - verse section just won't show */ })
      .finally(() => {
        if (!cancelled) setVerseLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
        <div className="text-center">
          {/* Hero Section */}
          <div className="mb-6 sm:mb-8">
            {/* Logo */}
            <div className="flex justify-center mb-4 sm:mb-5">
              <img src="/logo.svg" alt="Geetanjali" className="h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
            </div>

            {/* Main Tagline */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              Wisdom for Life's{' '}
              <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Difficult Decisions
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              Ethical guidance grounded in the timeless teachings of the Bhagavad Geeta
            </p>

            {/* Signup prompt for guests */}
            {!isAuthenticated && (
              <p className="text-sm text-gray-500 mt-3 sm:mt-4">
                Try it free — no signup required
              </p>
            )}
          </div>

          {/* Backend Status - Only show errors */}
          {error && (
            <div className="mb-6 sm:mb-8 bg-red-50 border border-red-200 text-red-600 px-4 sm:px-6 py-3 sm:py-4 rounded-lg max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <span className="text-lg sm:text-xl">⚠️</span>
                <div className="text-left">
                  <p className="font-semibold mb-1 text-sm sm:text-base">Service Unavailable</p>
                  <p className="text-xs sm:text-sm text-red-600">Unable to connect to the service. Please try again later.</p>
                </div>
              </div>
            </div>
          )}

          {/* Featured Verse of the Day */}
          <div className="mb-8 sm:mb-10 lg:mb-12">
            <FeaturedVerse
              verse={dailyVerse!}
              loading={verseLoading}
            />
          </div>

          {/* CTA Button - visible on desktop, hidden on mobile (FAB replaces it) */}
          <div className="hidden sm:flex flex-col items-center mb-10 lg:mb-12">
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 sm:px-10 sm:py-4 rounded-xl transition-all shadow-lg hover:shadow-xl text-base sm:text-lg group"
            >
              <span>Ask a Question</span>
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <p className="text-xs text-gray-500 mt-2">Get personalized guidance in minutes</p>
          </div>

          {/* Recent Consultations */}
          {!casesLoading && recentCases.length > 0 && (
            <div className="mb-8 sm:mb-10 max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Continue where you left off</h2>
                <Link to="/consultations" className="text-red-600 hover:text-red-700 font-medium text-sm">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {recentCases.map((case_) => (
                  <Link
                    key={case_.id}
                    to={`/cases/${case_.id}`}
                    className="flex items-center justify-between gap-4 p-3 bg-white rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-all group"
                  >
                    <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate group-hover:text-red-700 transition-colors">
                      {case_.title}
                    </h3>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(case_.created_at || '').toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Feature Overview */}
          <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 sm:p-6 rounded-xl border border-amber-100 text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5">Clear Guidance</h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Practical wisdom for navigating complex situations
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-red-50 p-5 sm:p-6 rounded-xl border border-orange-100 text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5">Multiple Paths</h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Explore different approaches with their trade-offs
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-rose-50 p-5 sm:p-6 rounded-xl border border-red-100 text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5">Rooted in Scripture</h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Every insight backed by verses from the Geeta
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom padding for FAB on mobile */}
      <div className="h-20 sm:hidden" />
    </div>
  );
}

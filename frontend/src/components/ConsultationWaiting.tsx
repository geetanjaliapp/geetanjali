import { useState, useEffect } from 'react';
import type { CaseStatus, Verse } from '../types';
import { versesApi } from '../lib/api';

interface ConsultationWaitingProps {
  status: CaseStatus;
  onRetry?: () => void;
}

// Wisdom quotes to display while waiting
const WISDOM_QUOTES = [
  { text: "The mind is restless and difficult to restrain, but it is subdued by practice.", source: "BG 6.35" },
  { text: "You have the right to work, but never to the fruit of work.", source: "BG 2.47" },
  { text: "The soul is neither born, and nor does it die.", source: "BG 2.20" },
  { text: "When meditation is mastered, the mind is unwavering like the flame of a lamp in a windless place.", source: "BG 6.19" },
  { text: "Set thy heart upon thy work, but never on its reward.", source: "BG 2.47" },
];

// Processing stages for progress indicator
const PROCESSING_STAGES = [
  { id: 'pending', label: 'Preparing your consultation', icon: '📋' },
  { id: 'retrieving', label: 'Finding relevant wisdom', icon: '📚' },
  { id: 'contemplating', label: 'Contemplating guidance', icon: '🧘' },
  { id: 'composing', label: 'Composing your brief', icon: '✍️' },
];

export function ConsultationWaiting({ status, onRetry }: ConsultationWaitingProps) {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [dailyVerse, setDailyVerse] = useState<Verse | null>(null);
  const [breathCount, setBreathCount] = useState(0);
  const [showBreathing, setShowBreathing] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  // Rotate quotes every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % WISDOM_QUOTES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Simulate progress stages
  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setCurrentStage((prev) => Math.min(prev + 1, PROCESSING_STAGES.length - 1));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Fetch daily verse for display
  useEffect(() => {
    versesApi.getDaily()
      .then(setDailyVerse)
      .catch(() => {
        // Fallback to random if daily fails
        versesApi.getRandom().then(setDailyVerse).catch(() => {});
      });
  }, []);

  // Breathing exercise counter
  useEffect(() => {
    if (showBreathing) {
      const interval = setInterval(() => {
        setBreathCount((prev) => prev + 1);
      }, 4000); // 4 seconds per breath cycle
      return () => clearInterval(interval);
    }
  }, [showBreathing]);

  const currentQuote = WISDOM_QUOTES[currentQuoteIndex];

  if (status === 'failed') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-center">
        <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">😔</div>
        <h3 className="text-lg sm:text-xl font-semibold text-red-800 mb-1.5 sm:mb-2">Analysis Could Not Complete</h3>
        <p className="text-sm sm:text-base text-red-600 mb-4 sm:mb-6">
          We encountered an issue while preparing your consultation. This can happen during high demand.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm sm:text-base"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (status === 'completed') {
    return null; // Don't render anything when complete
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header with animated indicator */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-white rounded-full shadow-lg mb-3 sm:mb-4 animate-pulse">
          <span className="text-2xl sm:text-3xl">{PROCESSING_STAGES[currentStage].icon}</span>
        </div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2">
          Consulting Ancient Wisdom
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          {PROCESSING_STAGES[currentStage].label}...
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center items-center space-x-1.5 sm:space-x-2">
        {PROCESSING_STAGES.map((stage, index) => (
          <div
            key={stage.id}
            className={`h-1.5 sm:h-2 rounded-full transition-all duration-500 ${
              index <= currentStage
                ? 'bg-red-500 w-6 sm:w-8'
                : 'bg-gray-200 w-3 sm:w-4'
            }`}
          />
        ))}
      </div>

      {/* Rotating wisdom quote */}
      <div className="bg-white/60 rounded-xl p-4 sm:p-5 lg:p-6 text-center transition-opacity duration-500">
        <blockquote className="text-sm sm:text-base lg:text-lg text-gray-700 italic mb-1.5 sm:mb-2">
          "{currentQuote.text}"
        </blockquote>
        <cite className="text-xs sm:text-sm text-gray-500">— {currentQuote.source}</cite>
      </div>

      {/* Activity options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Breathing Exercise */}
        <div className="bg-white rounded-xl p-3 sm:p-4 lg:p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
            <span className="mr-2">🌬️</span> Mindful Breathing
          </h3>
          {!showBreathing ? (
            <button
              onClick={() => setShowBreathing(true)}
              className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs sm:text-sm"
            >
              Start breathing exercise
            </button>
          ) : (
            <div className="text-center">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3">
                <div
                  className="absolute inset-0 rounded-full bg-red-100 animate-ping"
                  style={{ animationDuration: '4s' }}
                />
                <div className="absolute inset-1.5 sm:inset-2 rounded-full bg-red-200 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl font-bold text-red-600">{breathCount}</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">
                Breathe in... hold... breathe out...
              </p>
              <button
                onClick={() => { setShowBreathing(false); setBreathCount(0); }}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Stop
              </button>
            </div>
          )}
        </div>

        {/* Daily Verse Preview */}
        <div className="bg-white rounded-xl p-3 sm:p-4 lg:p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
            <span className="mr-2">📖</span> Verse of the Day
          </h3>
          {dailyVerse ? (
            <div className="text-xs sm:text-sm">
              <p className="text-gray-600 mb-1.5 sm:mb-2 line-clamp-3">
                {dailyVerse.paraphrase_en || dailyVerse.translation_en}
              </p>
              <p className="text-xs text-gray-400">
                {dailyVerse.canonical_id?.replace(/_/g, ' ')}
              </p>
            </div>
          ) : (
            <div className="animate-pulse">
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4" />
            </div>
          )}
        </div>
      </div>

      {/* Footer message */}
      <p className="text-center text-xs sm:text-sm text-gray-500">
        Your consultation typically takes 1-3 minutes. Feel free to explore or wait here.
      </p>
    </div>
  );
}

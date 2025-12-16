import { useState, useEffect } from "react";

// Wisdom quotes - reused from ConsultationWaiting for brand consistency
const WISDOM_QUOTES = [
  {
    text: "The mind is restless and difficult to restrain, but it is subdued by practice.",
    source: "BG 6.35",
  },
  {
    text: "You have the right to work, but never to the fruit of work.",
    source: "BG 2.47",
  },
  { text: "The soul is neither born, and nor does it die.", source: "BG 2.20" },
  {
    text: "When meditation is mastered, the mind is unwavering like the flame of a lamp in a windless place.",
    source: "BG 6.19",
  },
  {
    text: "Set thy heart upon thy work, but never on its reward.",
    source: "BG 2.47",
  },
];

interface FollowUpThinkingProps {
  pendingMessage?: string;
}

export function FollowUpThinking({ pendingMessage }: FollowUpThinkingProps) {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() =>
    Math.floor(Math.random() * WISDOM_QUOTES.length),
  );

  // Rotate quotes every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % WISDOM_QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const currentQuote = WISDOM_QUOTES[currentQuoteIndex];

  return (
    <div className="relative">
      {/* Pending user message */}
      {pendingMessage && (
        <div className="relative pl-8 sm:pl-10 pb-3 sm:pb-4">
          <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-blue-100 border-2 border-blue-400">
            <span className="text-xs text-blue-700">+</span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-blue-600">
            Follow-up
          </div>
          <div className="rounded-xl p-3 sm:p-4 bg-blue-50 border border-blue-100">
            <p className="leading-relaxed whitespace-pre-wrap text-gray-700 text-sm">
              {pendingMessage}
            </p>
          </div>
        </div>
      )}

      {/* Thinking indicator */}
      <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
        <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-orange-100 border-2 border-orange-400 animate-pulse">
          <span className="text-xs text-orange-600 font-medium">~</span>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-orange-600">
          Contemplating...
        </div>

        {/* Enhanced container with glow and shimmer */}
        <div className="relative rounded-xl p-4 sm:p-5 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-300 animate-glow-pulse overflow-hidden">
          {/* Shimmer overlay */}
          <div className="absolute inset-0 animate-shimmer pointer-events-none" />

          {/* Content */}
          <div className="relative">
            {/* Animated dots - refined pulse instead of bounce */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex space-x-1.5">
                <span
                  className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-dot-pulse"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-dot-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-dot-pulse"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
              <span className="text-sm text-orange-700 font-medium">
                Finding wisdom for your follow-up
              </span>
            </div>

            {/* Rotating quote */}
            <div className="bg-white/70 rounded-lg p-3 sm:p-4 transition-opacity duration-500">
              <blockquote className="text-sm text-gray-600 italic">
                "{currentQuote.text}"
              </blockquote>
              <cite className="text-xs text-gray-400 mt-1 block">
                — {currentQuote.source}
              </cite>
            </div>

            <p className="text-xs text-gray-500 mt-3 text-center">
              This usually takes about a minute...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

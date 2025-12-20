import { useState, useEffect } from "react";
import { WISDOM_QUOTES } from "../../constants/curatedVerses";

type ThinkingVariant = "initial" | "followup";

interface ThinkingIndicatorProps {
  variant?: ThinkingVariant;
  pendingMessage?: string;
}

const COPY = {
  initial: {
    label: "Consulting the Geeta...",
    message: "Preparing your consultation",
    footer: "Your guidance is being prepared...",
  },
  followup: {
    label: "Contemplating...",
    message: "Finding wisdom for your follow-up",
    footer: "This usually takes about a minute...",
  },
};

// Progress stages for initial consultation
const PROGRESS_STAGES = [
  { label: "Analyzing your situation", duration: 8000 },
  { label: "Finding relevant verses", duration: 12000 },
  { label: "Generating guidance", duration: 20000 },
];

export function ThinkingIndicator({
  variant = "followup",
  pendingMessage,
}: ThinkingIndicatorProps) {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() =>
    Math.floor(Math.random() * WISDOM_QUOTES.length),
  );
  const [currentStage, setCurrentStage] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Rotate quotes every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % WISDOM_QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Progress through stages (for initial variant only)
  useEffect(() => {
    if (variant !== "initial") return;

    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    PROGRESS_STAGES.forEach((stage, index) => {
      if (index > 0) {
        timers.push(
          setTimeout(() => {
            setCurrentStage(index);
          }, elapsed),
        );
      }
      elapsed += stage.duration;
    });

    return () => timers.forEach(clearTimeout);
  }, [variant]);

  // Elapsed time counter
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentQuote = WISDOM_QUOTES[currentQuoteIndex];
  const copy = COPY[variant];

  return (
    <div className="relative">
      {/* Pending user message (only for follow-up variant) */}
      {variant === "followup" && pendingMessage && (
        <div className="relative pl-8 sm:pl-10 pb-3 sm:pb-4">
          <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-600">
            <span className="text-xs text-blue-700 dark:text-blue-400">+</span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-blue-600 dark:text-blue-400">
            Follow-up
          </div>
          <div className="rounded-xl p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
            <p className="leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 text-sm">
              {pendingMessage}
            </p>
          </div>
        </div>
      )}

      {/* Thinking indicator */}
      <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
        <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-orange-100 dark:bg-orange-900/40 border-2 border-orange-400 dark:border-orange-600 animate-pulse">
          <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
            ~
          </span>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-orange-600 dark:text-orange-400">
          {copy.label}
        </div>

        {/* Enhanced container with glow and shimmer */}
        <div className="relative rounded-xl p-4 sm:p-5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 border border-orange-300 dark:border-orange-700 animate-glow-pulse overflow-hidden">
          {/* Shimmer overlay - warm amber */}
          <div className="absolute inset-0 animate-shimmer pointer-events-none" />

          {/* Content */}
          <div className="relative">
            {/* Progress stages (initial variant only) */}
            {variant === "initial" && (
              <div className="mb-4 space-y-2">
                {PROGRESS_STAGES.map((stage, index) => (
                  <div
                    key={stage.label}
                    className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                      index < currentStage
                        ? "text-green-600 dark:text-green-400"
                        : index === currentStage
                          ? "text-orange-700 dark:text-orange-400 font-medium"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    <span className="w-5 text-center">
                      {index < currentStage ? (
                        "✓"
                      ) : index === currentStage ? (
                        <span className="inline-block w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      ) : (
                        "○"
                      )}
                    </span>
                    <span>{stage.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Animated dots for follow-up variant */}
            {variant === "followup" && (
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
                <span className="text-sm text-orange-700 dark:text-orange-400 font-medium">
                  {copy.message}
                </span>
              </div>
            )}

            {/* Rotating quote - fixed height prevents layout shift */}
            <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 sm:p-4 transition-opacity duration-500 min-h-[72px] sm:min-h-[80px] flex flex-col justify-center">
              <blockquote className="text-sm text-gray-600 dark:text-gray-300 italic">
                "{currentQuote.text}"
              </blockquote>
              <cite className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">
                — {currentQuote.source}
              </cite>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
              {variant === "initial" && elapsedSeconds > 0
                ? `${elapsedSeconds}s elapsed · ${copy.footer}`
                : copy.footer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
          <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-[var(--status-info-bg)] border-2 border-[var(--status-info-border)]">
            <span className="text-xs text-[var(--status-info-text)]">+</span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-[var(--status-info-text)]">
            Follow-up
          </div>
          <div className="rounded-xl p-3 sm:p-4 bg-[var(--status-info-bg)] border border-[var(--status-info-border)]">
            <p className="leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)] text-sm">
              {pendingMessage}
            </p>
          </div>
        </div>
      )}

      {/* Thinking indicator */}
      <div className="relative pl-8 sm:pl-10 pb-4 sm:pb-6">
        <div className="absolute left-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-[var(--badge-warm-bg)] border-2 border-[var(--border-accent)] animate-pulse">
          <span className="text-xs text-[var(--text-accent)] font-medium">
            ~
          </span>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-[var(--text-accent)]">
          {copy.label}
        </div>

        {/* Enhanced container with glow and shimmer */}
        <div className="relative rounded-xl p-4 sm:p-5 bg-linear-to-br from-[var(--surface-warm)] to-[var(--surface-warm-subtle)] border border-[var(--border-accent)] animate-glow-pulse overflow-hidden">
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
                        ? "text-[var(--status-success-text)]"
                        : index === currentStage
                          ? "text-[var(--badge-warm-text)] font-medium"
                          : "text-[var(--text-muted)]"
                    }`}
                  >
                    <span className="w-5 text-center">
                      {index < currentStage ? (
                        "✓"
                      ) : index === currentStage ? (
                        <span className="inline-block w-2 h-2 bg-[var(--interactive-primary)] rounded-full animate-pulse" />
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
                    className="w-2.5 h-2.5 bg-[var(--interactive-primary)] rounded-full animate-dot-pulse"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2.5 h-2.5 bg-[var(--interactive-primary)] rounded-full animate-dot-pulse"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="w-2.5 h-2.5 bg-[var(--interactive-primary)] rounded-full animate-dot-pulse"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
                <span className="text-sm text-[var(--badge-warm-text)] font-medium">
                  {copy.message}
                </span>
              </div>
            )}

            {/* Rotating quote - fixed height prevents layout shift */}
            <div className="bg-[var(--surface-elevated)]/70 rounded-lg p-3 sm:p-4 transition-opacity duration-500 min-h-[72px] sm:min-h-[80px] flex flex-col justify-center">
              <blockquote className="text-sm text-[var(--text-secondary)] italic">
                "{currentQuote.text}"
              </blockquote>
              <cite className="text-xs text-[var(--text-muted)] mt-1 block">
                — {currentQuote.source}
              </cite>
            </div>

            <p className="text-xs text-[var(--text-tertiary)] mt-3 text-center">
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

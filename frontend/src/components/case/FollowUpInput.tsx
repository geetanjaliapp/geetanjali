import type { FormEvent } from "react";
import { Link } from "react-router-dom";

interface FollowUpInputProps {
  value: string;
  submitting: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function FollowUpInput({
  value,
  submitting,
  disabled = false,
  error,
  onChange,
  onSubmit,
}: FollowUpInputProps) {
  const isDisabled = submitting || disabled;

  return (
    <div
      className={`mt-4 bg-[var(--surface-elevated)] rounded-xl shadow-md p-3 sm:p-4 transition-opacity ${disabled ? "opacity-75" : ""}`}
    >
      {/* Inline error message */}
      {error && (
        <div
          id="followup-error"
          role="alert"
          className="mb-3 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-[var(--status-error-text)] px-3 py-2 rounded-lg text-sm"
        >
          {error}
        </div>
      )}
      {/* Processing indicator */}
      {disabled && (
        <div className="flex items-center gap-2 mb-3 text-[var(--text-accent)]">
          <div className="flex space-x-1">
            <span
              className="w-1.5 h-1.5 bg-[var(--interactive-primary)] rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-[var(--interactive-primary)] rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-[var(--interactive-primary)] rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-sm font-medium">Thinking...</span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <label htmlFor="followup-input" className="sr-only">
          Ask a follow-up question
        </label>
        <div className="flex gap-2 sm:gap-3">
          <textarea
            id="followup-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              // Submit on Enter (without Shift)
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (value.trim() && !isDisabled) {
                  onSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            placeholder={
              disabled ? "Please wait..." : "Ask a follow-up question..."
            }
            rows={2}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "followup-error" : undefined}
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent transition-colors resize-none bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] ${
              disabled
                ? "border-[var(--border-warm)] bg-[var(--surface-warm-subtle)]"
                : "border-[var(--border-default)]"
            }`}
            disabled={isDisabled}
          />
          <button
            type="submit"
            disabled={!value.trim() || isDisabled}
            className={`self-end px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-colors ${
              disabled
                ? "bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] cursor-not-allowed"
                : "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] hover:opacity-90 disabled:bg-[var(--interactive-disabled)] disabled:cursor-not-allowed"
            }`}
          >
            <span className="hidden sm:inline">
              {submitting ? "Sending..." : disabled ? "Thinking..." : "Ask"}
            </span>
            <svg
              className={`w-4 h-4 sm:hidden ${disabled ? "animate-pulse" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </button>
        </div>
      </form>

      {/* New Consultation link */}
      <div className="mt-3 pt-3 border-t border-[var(--border-default)] flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">
          Need a fresh perspective with new options?
        </p>
        <Link
          to="/cases/new"
          className="text-xs text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] font-medium flex items-center gap-1"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Consultation
        </Link>
      </div>
    </div>
  );
}

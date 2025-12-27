/**
 * ConfirmModal Component - Migrated to Token System (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 */
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../hooks";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  /** If set, user must type this text to enable confirm button */
  requireText?: string;
  /** Placeholder/hint for the text input */
  requireTextHint?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  requireText,
  requireTextHint,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const textMatches =
    !requireText || confirmInput.toLowerCase() === requireText.toLowerCase();

  // Wrap handlers to reset input
  const handleCancel = () => {
    setConfirmInput("");
    onCancel();
  };

  const handleConfirm = () => {
    setConfirmInput("");
    onConfirm();
  };

  // Trap focus within modal (WCAG 2.1)
  // Note: Focuses Cancel button first (safer default for destructive actions)
  useFocusTrap(modalRef, isOpen);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        setConfirmInput("");
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onCancel]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: (
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--status-error-text)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      iconBg: "bg-[var(--status-error-bg)]",
      confirmButton:
        "bg-[var(--status-error-text)] hover:opacity-90 focus-visible:ring-[var(--status-error-border)]",
    },
    warning: {
      icon: (
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--status-warning-text)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      iconBg: "bg-[var(--status-warning-bg)]",
      confirmButton:
        "bg-[var(--status-warning-text)] hover:opacity-90 focus-visible:ring-[var(--status-warning-border)]",
    },
    default: {
      icon: (
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      iconBg: "bg-[var(--surface-muted)]",
      confirmButton:
        "bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] focus-visible:ring-[var(--focus-ring)]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg)] transition-opacity"
        onClick={loading ? undefined : handleCancel}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className="relative bg-[var(--surface-elevated)] rounded-[var(--radius-modal)] shadow-[var(--shadow-modal)] max-w-sm w-full p-4 sm:p-6 transform transition-[var(--transition-all)] border border-[var(--border-default)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Icon */}
          <div
            className={`mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--radius-avatar)] ${styles.iconBg} flex items-center justify-center mb-3 sm:mb-4`}
          >
            {styles.icon}
          </div>

          {/* Content */}
          <div className="text-center">
            <h3
              id="modal-title"
              className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-1.5 sm:mb-2"
            >
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-4 sm:mb-6">
              {message}
            </p>
          </div>

          {/* Text confirmation input */}
          {requireText && (
            <div className="mb-4">
              <label
                htmlFor="confirm-text-input"
                className="block text-xs text-[var(--text-tertiary)] mb-1.5 text-center"
              >
                Type{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {requireText}
                </span>{" "}
                to confirm
              </label>
              <input
                id="confirm-text-input"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={requireTextHint || requireText}
                disabled={loading}
                aria-invalid={
                  confirmInput.length > 0 && !textMatches ? true : undefined
                }
                className="w-full px-3 py-2 text-sm text-center border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-text-placeholder)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent disabled:opacity-50 disabled:bg-[var(--input-bg-disabled)]"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--interactive-secondary-text)] bg-[var(--interactive-secondary-bg)] border border-[var(--interactive-secondary-border)] rounded-[var(--radius-card)] hover:bg-[var(--interactive-secondary-hover-bg)] hover:border-[var(--interactive-secondary-hover-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] focus-visible:ring-[var(--focus-ring)] disabled:opacity-50 transition-[var(--transition-color)]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !textMatches}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-inverted)] rounded-[var(--radius-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] disabled:opacity-50 disabled:cursor-not-allowed transition-[var(--transition-color)] ${styles.confirmButton}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Deleting...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

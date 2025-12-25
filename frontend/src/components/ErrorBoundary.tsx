import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Known chunk loading error patterns - matches lazyWithRetry.ts
 * Used to detect when error is due to stale chunks after deployment
 */
const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "loading chunk",
  "loading css chunk",
  "failed to load",
  "unable to preload",
  "networkerror when attempting to fetch resource",
  "load failed",
];

/**
 * Check if error is a chunk loading failure
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Minimal navbar for error state - no auth dependencies
 */
function ErrorNavbar() {
  return (
    <nav className="bg-[var(--surface-elevated)] shadow-xs border-b border-[var(--border-default)] h-14 sm:h-16 shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          <a
            href="/"
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src="/logo.svg"
              alt="Geetanjali"
              className="h-8 w-8 sm:h-10 sm:w-10"
            />
            <span className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-accent)]">
              Geetanjali
            </span>
          </a>
        </div>
      </div>
    </nav>
  );
}

/**
 * Error Boundary component that catches React errors and displays a fallback UI
 * instead of crashing the entire application
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error("Error caught by boundary:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = isChunkLoadError(this.state.error);

      // Special UI for chunk load errors (stale app after deployment)
      if (isChunkError) {
        return (
          <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
            <ErrorNavbar />
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-md mx-auto px-4 text-center">
                <div className="mb-6 p-6 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-lg">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--status-warning-bg)] flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-[var(--status-warning-text)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold text-[var(--status-warning-text)] mb-2">
                    Update Available
                  </h1>
                  <p className="text-[var(--status-warning-text)]">
                    A new version of Geetanjali is available. Please refresh to
                    get the latest updates.
                  </p>
                </div>
                <button
                  onClick={this.handleRefresh}
                  className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)]"
                >
                  Refresh Now
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Generic error UI for other errors
      return (
        <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
          <ErrorNavbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md mx-auto px-4 text-center">
              <div className="mb-6 p-6 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded-lg">
                <h1 className="text-2xl font-bold text-[var(--status-error-text)] mb-2">
                  Oops, something went wrong
                </h1>
                <p className="text-[var(--status-error-text)] mb-4">
                  We encountered an unexpected error. Please try again.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--status-error-text)] hover:text-[var(--status-error-text)]">
                      Error details (development only)
                    </summary>
                    <pre className="mt-2 overflow-auto bg-[var(--surface-elevated)] p-2 rounded-sm text-xs text-[var(--status-error-text)] border border-[var(--status-error-border)]">
                      {this.state.error.toString()}
                    </pre>
                  </details>
                )}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.reset}
                  className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)]"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleRefresh}
                  className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[var(--focus-ring-offset)]"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

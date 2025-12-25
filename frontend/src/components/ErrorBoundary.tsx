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
    <nav className="bg-white dark:bg-gray-900 shadow-xs border-b border-gray-200 dark:border-gray-700 h-14 sm:h-16 shrink-0">
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
            <span className="text-xl sm:text-2xl font-heading font-bold text-orange-600 dark:text-orange-400">
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
          <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
            <ErrorNavbar />
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-md mx-auto px-4 text-center">
                <div className="mb-6 p-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-amber-600 dark:text-amber-400"
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
                  <h1 className="text-2xl font-bold text-amber-800 dark:text-amber-300 mb-2">
                    Update Available
                  </h1>
                  <p className="text-amber-700 dark:text-amber-400">
                    A new version of Geetanjali is available. Please refresh to
                    get the latest updates.
                  </p>
                </div>
                <button
                  onClick={this.handleRefresh}
                  className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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
        <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900 flex flex-col">
          <ErrorNavbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md mx-auto px-4 text-center">
              <div className="mb-6 p-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <h1 className="text-2xl font-bold text-red-800 dark:text-red-300 mb-2">
                  Oops, something went wrong
                </h1>
                <p className="text-red-700 dark:text-red-400 mb-4">
                  We encountered an unexpected error. Please try again.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm font-semibold text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                      Error details (development only)
                    </summary>
                    <pre className="mt-2 overflow-auto bg-white dark:bg-gray-800 p-2 rounded-sm text-xs text-red-900 dark:text-red-300 border border-red-200 dark:border-red-700">
                      {this.state.error.toString()}
                    </pre>
                  </details>
                )}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.reset}
                  className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleRefresh}
                  className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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

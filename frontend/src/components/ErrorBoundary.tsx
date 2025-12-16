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
 * Minimal navbar for error state - no auth dependencies
 */
function ErrorNavbar() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 h-14 sm:h-16 flex-shrink-0">
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
            <span className="text-xl sm:text-2xl font-heading font-bold text-orange-600">
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
          <ErrorNavbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md mx-auto px-4 text-center">
              <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-lg">
                <h1 className="text-2xl font-bold text-red-800 mb-2">
                  Oops, something went wrong
                </h1>
                <p className="text-red-700 mb-4">
                  We encountered an unexpected error. The page will be reloaded
                  automatically.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm font-semibold text-red-700 hover:text-red-800">
                      Error details (development only)
                    </summary>
                    <pre className="mt-2 overflow-auto bg-white p-2 rounded text-xs text-red-900 border border-red-200">
                      {this.state.error.toString()}
                    </pre>
                  </details>
                )}
              </div>
              <button
                onClick={this.reset}
                className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

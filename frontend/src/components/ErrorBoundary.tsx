import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Navbar } from './Navbar';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
    console.error('Error caught by boundary:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
          <Navbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md mx-auto px-4 text-center">
              <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-lg">
                <h1 className="text-2xl font-bold text-red-800 mb-2">
                  Oops, something went wrong
                </h1>
                <p className="text-red-700 mb-4">
                  We encountered an unexpected error. The page will be reloaded automatically.
                </p>
                {process.env.NODE_ENV === 'development' && this.state.error && (
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

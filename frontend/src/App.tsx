import { Suspense } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { TTSProvider } from "./contexts/TTSContext";
import { useNewsletterSync } from "./hooks";
import { FloatingActionButton, SkipLink, OfflineIndicator } from "./components";
import { AppRoutes } from "./AppRoutes";

// Loading fallback component
function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[var(--surface-page)]"
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
    >
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 border-[var(--border-accent)] border-t-transparent rounded-[var(--radius-progress)] animate-spin mx-auto mb-2"
          aria-hidden="true"
        ></div>
        <div className="text-[var(--text-secondary)] text-sm">Loading...</div>
      </div>
    </div>
  );
}

function App() {
  const { loading } = useAuth();

  // Sync newsletter subscription status on login
  useNewsletterSync();

  // Show minimal loading state while checking auth
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[var(--surface-page)]"
        role="status"
        aria-live="polite"
        aria-label="Checking authentication"
      >
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <TTSProvider>
        <SkipLink />
        <OfflineIndicator />
        <FloatingActionButton />
        <div id="main-content">
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </div>
      </TTSProvider>
    </Router>
  );
}

export default App;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LearningGoalProvider } from "./contexts/LearningGoalContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  initSentry,
  initUmami,
  initWebVitals,
  registerServiceWorker,
} from "./lib/monitoring";
import { checkAppVersion, startPeriodicVersionCheck } from "./lib/versionCheck";

// Initialize monitoring and PWA features (production-only, silent if unconfigured)
initSentry();
initUmami();
initWebVitals();
registerServiceWorker();

// Check for app version changes and clear stale caches (production-only)
// This runs on app init and periodically for long-running sessions
checkAppVersion();
startPeriodicVersionCheck();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <LearningGoalProvider>
            <App />
          </LearningGoalProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

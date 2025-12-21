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

// Initialize monitoring and PWA features (production-only, silent if unconfigured)
initSentry();
initUmami();
initWebVitals();
registerServiceWorker();

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

import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useParams,
} from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useNewsletterSync } from "./hooks";
import {
  FloatingActionButton,
  SkipLink,
  OfflineIndicator,
  SyncToast,
} from "./components";

// Eagerly loaded (critical path)
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// Lazy loaded pages (code splitting)
const NewCase = lazy(() => import("./pages/NewCase"));
const CaseView = lazy(() => import("./pages/CaseView"));
const Consultations = lazy(() => import("./pages/Consultations"));
const Verses = lazy(() => import("./pages/Verses"));
const VerseDetail = lazy(() => import("./pages/VerseDetail"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const About = lazy(() => import("./pages/About"));
const PublicCaseView = lazy(() => import("./pages/PublicCaseView"));
const ReadingMode = lazy(() => import("./pages/ReadingMode"));
const Settings = lazy(() => import("./pages/Settings"));
const NewsletterVerify = lazy(() => import("./pages/NewsletterVerify"));
const NewsletterUnsubscribe = lazy(
  () => import("./pages/NewsletterUnsubscribe")
);
const NewsletterPreferences = lazy(
  () => import("./pages/NewsletterPreferences")
);
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));

/**
 * Redirect from old /search to unified /verses page
 * Preserves query params (e.g., /search?q=karma -> /verses?q=karma)
 */
function SearchRedirect() {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  return (
    <Navigate to={`/verses${queryString ? `?${queryString}` : ""}`} replace />
  );
}

/**
 * Redirect from path params to query params for reading mode
 * /read/2/4 -> /read?c=2&v=4
 */
function ReadingModeRedirect({
  chapter,
  verse,
}: {
  chapter: string;
  verse?: string;
}) {
  const params = new URLSearchParams();
  params.set("c", chapter);
  if (verse) {
    params.set("v", verse);
  }
  return <Navigate to={`/read?${params.toString()}`} replace />;
}

/**
 * Wrapper to extract route params and pass to ReadingModeRedirect
 */
function ReadingModePathRedirect() {
  const { chapter, verse } = useParams<{ chapter: string; verse?: string }>();
  if (!chapter) return <Navigate to="/read" replace />;
  return <ReadingModeRedirect chapter={chapter} verse={verse} />;
}

// Loading fallback component
function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900"
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
    >
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 border-orange-600 dark:border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"
          aria-hidden="true"
        ></div>
        <div className="text-gray-600 dark:text-gray-400 text-sm">
          Loading...
        </div>
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
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-900"
        role="status"
        aria-live="polite"
        aria-label="Checking authentication"
      >
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <SkipLink />
      <OfflineIndicator />
      <SyncToast />
      <FloatingActionButton />
      <main id="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes - accessible to everyone */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/cases/new" element={<NewCase />} />
            <Route path="/cases/:id" element={<CaseView />} />
            <Route path="/consultations" element={<Consultations />} />
            <Route path="/verses" element={<Verses />} />
            <Route path="/search" element={<SearchRedirect />} />
            <Route path="/verses/:canonicalId" element={<VerseDetail />} />
            <Route path="/read" element={<ReadingMode />} />
            {/* Redirects for legacy path-based reading URLs */}
            <Route
              path="/read/:chapter/:verse"
              element={<ReadingModePathRedirect />}
            />
            <Route
              path="/read/:chapter"
              element={<ReadingModePathRedirect />}
            />
            <Route path="/about" element={<About />} />
            <Route path="/settings" element={<Settings />} />

            {/* Public shared consultation view */}
            <Route path="/c/:slug" element={<PublicCaseView />} />

            {/* Email verification route */}
            <Route path="/verify-email/:token" element={<VerifyEmail />} />

            {/* Newsletter routes */}
            <Route path="/n/verify/:token" element={<NewsletterVerify />} />
            <Route
              path="/n/unsubscribe/:token"
              element={<NewsletterUnsubscribe />}
            />
            <Route
              path="/n/preferences/:token"
              element={<NewsletterPreferences />}
            />

            {/* 404 fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </Router>
  );
}

export default App;

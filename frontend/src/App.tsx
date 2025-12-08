import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { FloatingActionButton, SkipLink } from './components';

// Eagerly loaded (critical path)
import Home from './pages/Home';
import NotFound from './pages/NotFound';

// Lazy loaded pages (code splitting)
const NewCase = lazy(() => import('./pages/NewCase'));
const CaseView = lazy(() => import('./pages/CaseView'));
const Consultations = lazy(() => import('./pages/Consultations'));
const Verses = lazy(() => import('./pages/Verses'));
const VerseDetail = lazy(() => import('./pages/VerseDetail'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const About = lazy(() => import('./pages/About'));
const PublicCaseView = lazy(() => import('./pages/PublicCaseView'));

// Loading fallback component
function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50"
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
    >
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" aria-hidden="true"></div>
        <div className="text-gray-600 text-sm">Loading...</div>
      </div>
    </div>
  );
}

function App() {
  const { loading } = useAuth();

  // Show minimal loading state while checking auth
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50"
        role="status"
        aria-live="polite"
        aria-label="Checking authentication"
      >
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <SkipLink />
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
            <Route path="/verses/:canonicalId" element={<VerseDetail />} />
            <Route path="/about" element={<About />} />

            {/* Public shared consultation view */}
            <Route path="/c/:slug" element={<PublicCaseView />} />

            {/* 404 fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </Router>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import NewCase from './pages/NewCase';
import CaseView from './pages/CaseView';
import Consultations from './pages/Consultations';
import Verses from './pages/Verses';
import VerseDetail from './pages/VerseDetail';
import Login from './pages/Login';
import Signup from './pages/Signup';
import About from './pages/About';
import PublicCaseView from './pages/PublicCaseView';
import NotFound from './pages/NotFound';

function App() {
  const { loading } = useAuth();

  // Show minimal loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public routes - accessible to everyone */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
    </Router>
  );
}

export default App;

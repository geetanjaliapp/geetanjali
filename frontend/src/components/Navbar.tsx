import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  /** Show back button instead of full nav (for detail pages) */
  showBack?: boolean;
  /** Back button destination */
  backTo?: string;
  /** Back button label */
  backLabel?: string;
}

export function Navbar({ showBack, backTo = '/', backLabel = 'Back' }: NavbarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 h-16 flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          {/* Left side: Logo or Back button */}
          {showBack ? (
            <Link
              to={backTo}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="font-medium">{backLabel}</span>
            </Link>
          ) : (
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img src="/logo.svg" alt="Geetanjali" className="h-10 w-10" />
              <span className="text-2xl font-serif font-bold text-orange-600">
                Geetanjali
              </span>
            </Link>
          )}

          {/* Right side: Navigation links */}
          <div className="flex items-center space-x-1 sm:space-x-4">
            <Link
              to="/verses"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/verses') || location.pathname.startsWith('/verses/')
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
              }`}
            >
              Browse Verses
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  to="/consultations"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/consultations')
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
                  }`}
                >
                  My Consultations
                </Link>
                <div className="hidden sm:flex items-center space-x-2 ml-2 pl-4 border-l border-gray-200">
                  <span className="text-sm text-gray-600">{user?.name}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-orange-600 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/login')
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
                  }`}
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

import { useState, useRef, useEffect } from 'react';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      setIsDropdownOpen(false);
      await logout();
    } catch {
      // Silent fail - logout UI state already cleared
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user initials for avatar
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Get first name for display
  const getFirstName = (name: string | undefined) => {
    if (!name) return 'User';
    return name.trim().split(' ')[0];
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
            {/* Primary nav: Consultations first, then Verses */}
            <Link
              to="/consultations"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/consultations') || location.pathname.startsWith('/cases/')
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
              }`}
            >
              Consultations
            </Link>
            <Link
              to="/verses"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/verses') || location.pathname.startsWith('/verses/')
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
              }`}
            >
              Verses
            </Link>
            <Link
              to="/about"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/about')
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
              }`}
            >
              About
            </Link>

            {/* Auth section */}
            {isAuthenticated ? (
              <div className="relative ml-2 pl-4 border-l border-gray-200" ref={dropdownRef}>
                {/* User pill button */}
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {/* Avatar with initials */}
                  <div className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-medium">
                    {getInitials(user?.name)}
                  </div>
                  {/* First name - hidden on mobile */}
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {getFirstName(user?.name)}
                  </span>
                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {/* User info */}
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    {/* Sign out */}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
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

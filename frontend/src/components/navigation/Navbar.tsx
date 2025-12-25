import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { NavLogo } from "./NavLogo";
import { DesktopNav } from "./DesktopNav";
import { MobileDrawer } from "./MobileDrawer";
import { UserMenu } from "./UserMenu";
import { useClickOutside } from "./hooks";

interface NavbarProps {
  /** Show back button instead of full nav (for detail pages) */
  showBack?: boolean;
  /** Back button destination */
  backTo?: string;
  /** Back button label */
  backLabel?: string;
}

/**
 * Main navigation bar component
 *
 * Orchestrates:
 * - NavLogo (logo or back button)
 * - DesktopNav (desktop links + auth)
 * - MobileDrawer (slide-out menu)
 * - Mobile hamburger button
 * - Mobile user avatar
 */
export function Navbar({
  showBack,
  backTo = "/",
  backLabel = "Back",
}: NavbarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu when clicking outside
  useClickOutside(
    mobileMenuRef,
    () => setIsMobileMenuOpen(false),
    isMobileMenuOpen,
  );

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    try {
      await logout();
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  return (
    <>
      <nav className="bg-amber-50/90 dark:bg-gray-900/95 backdrop-blur-xs shadow-xs border-b border-amber-200/50 dark:border-gray-700/50 h-14 sm:h-16 shrink-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            {/* Left side: Hamburger + Logo */}
            <div className="flex items-center gap-2">
              {/* Hamburger button - mobile only */}
              {!showBack && (
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="mobile-nav-drawer"
                >
                  {isMobileMenuOpen ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </button>
              )}

              {/* Logo or Back button */}
              <NavLogo
                showBack={showBack}
                backTo={backTo}
                backLabel={backLabel}
              />
            </div>

            {/* Desktop navigation */}
            <DesktopNav
              pathname={location.pathname}
              isAuthenticated={isAuthenticated}
              user={user}
              onLogout={handleLogout}
            />

            {/* Mobile: User avatar (always shown - handles guest + authenticated) */}
            {!showBack && (
              <div className="md:hidden">
                <UserMenu
                  user={user}
                  isAuthenticated={isAuthenticated}
                  onLogout={handleLogout}
                  variant="mobile-header"
                />
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div ref={mobileMenuRef}>
        <MobileDrawer
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          pathname={location.pathname}
          isAuthenticated={isAuthenticated}
          user={user}
          onLogout={handleLogout}
        />
      </div>
    </>
  );
}

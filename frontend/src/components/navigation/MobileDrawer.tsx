import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  NAV_ITEMS,
  NAV_ICONS,
  PRIMARY_CTA,
  isNavItemActive,
  getVisibleNavItems,
} from "./navConfig";
import { ThemeToggle } from "./ThemeToggle";
import type { NavUser } from "./types";
import { getInitials } from "./utils";
import { useFocusTrap } from "../../hooks";

interface MobileDrawerProps {
  /** Whether drawer is open */
  isOpen: boolean;
  /** Close drawer handler */
  onClose: () => void;
  /** Current pathname for active state */
  pathname: string;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Current user object */
  user: NavUser | null;
  /** Logout handler */
  onLogout: () => void;
}

/**
 * Render an SVG icon from path data
 */
function NavIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  );
}

/**
 * Mobile navigation drawer
 *
 * Slides in from left. Contains:
 * 1. Primary CTA (Seek Guidance) at top
 * 2. Navigation links with icons
 * 3. Auth section at bottom
 */
export function MobileDrawer({
  isOpen,
  onClose,
  pathname,
  isAuthenticated,
  user,
  onLogout,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const visibleItems = getVisibleNavItems(NAV_ITEMS, isAuthenticated);

  // Trap focus within drawer when open (WCAG 2.1)
  useFocusTrap(drawerRef, isOpen);

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-30 md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      >
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      </div>

      {/* Drawer */}
      <div
        ref={drawerRef}
        id="mobile-nav-drawer"
        role="navigation"
        aria-label="Mobile navigation"
        inert={!isOpen ? true : undefined}
        className={`fixed top-14 left-0 bottom-0 w-72 bg-white dark:bg-gray-900 shadow-xl z-30 transform transition-all duration-300 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Primary CTA */}
          <div className="p-3">
            <Link
              to={PRIMARY_CTA.to}
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            >
              <NavIcon path={NAV_ICONS[PRIMARY_CTA.icon]} className="w-5 h-5" />
              <span>{PRIMARY_CTA.mobileLabel}</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 mx-3" />

          {/* Navigation links */}
          <div className="flex-1 py-3 overflow-y-auto">
            <div className="space-y-1 px-3">
              {visibleItems.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset ${
                      isActive
                        ? "text-orange-700 bg-orange-100 shadow-sm dark:text-orange-400 dark:bg-orange-900/30"
                        : "text-gray-600 hover:text-orange-600 hover:bg-orange-50 dark:text-gray-300 dark:hover:text-orange-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    <NavIcon path={NAV_ICONS[item.icon]} />
                    {item.mobileLabel}
                  </Link>
                );
              })}

              {/* Theme toggle */}
              <ThemeToggle variant="mobile-drawer" />
            </div>
          </div>

          {/* Auth section at bottom */}
          <div className="border-t border-amber-200 dark:border-gray-700 p-4 bg-amber-50/50 dark:bg-gray-800/50">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-medium shadow-sm">
                    {getInitials(user?.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user?.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                >
                  <NavIcon path={NAV_ICONS.logout} className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={onClose}
                className="block w-full px-4 py-2.5 text-center text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

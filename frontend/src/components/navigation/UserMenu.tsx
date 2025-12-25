import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useClickOutside } from "./hooks";
import { NAV_ICONS } from "./navConfig";
import type { NavUser } from "./types";
import { getInitials, getFirstName } from "./utils";
import { HeartIcon } from "../icons";
import { useSyncedFavorites } from "../../hooks/useSyncedFavorites";
import { useSyncedReading } from "../../hooks/useSyncedReading";

interface UserMenuProps {
  /** Current user object */
  user: NavUser | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Logout handler */
  onLogout: () => void;
  /** Variant for different contexts */
  variant?: "desktop" | "mobile-header";
}

/**
 * Render an SVG icon from path data
 */
function NavIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      className={className || "w-4 h-4"}
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
 * User/Guest account dropdown menu
 *
 * Shows:
 * - Guest: gray avatar, local data info, signup CTA
 * - Authenticated: user initials, email, sign out
 *
 * Both states show: My Favorites, Reading position, My Guidance, Settings, About
 */
export function UserMenu({
  user,
  isAuthenticated,
  onLogout,
  variant = "desktop",
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get favorites count and reading position for display
  const { favoritesCount } = useSyncedFavorites();
  const { position } = useSyncedReading();

  useClickOutside(menuRef, () => setIsOpen(false), isOpen);

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const isDesktop = variant === "desktop";
  const avatarSize = isDesktop ? "w-7 h-7" : "w-8 h-8";
  const textSize = isDesktop ? "text-xs" : "text-sm";

  // Guest vs authenticated styling
  const isGuest = !isAuthenticated;
  const avatarBg = isGuest
    ? "bg-gray-400 dark:bg-gray-600"
    : "bg-orange-600";
  const displayName = isGuest
    ? "Guest"
    : getFirstName(user?.name) || user?.email?.split("@")[0] || "User";

  // Reading link - dynamic based on position
  const hasReadingPosition = position?.chapter && position?.verse;
  const readingLabel = hasReadingPosition
    ? `Continue Ch.${position.chapter} v.${position.verse}`
    : "Start Reading";
  const readingPath = hasReadingPosition
    ? `/read?c=${position.chapter}&v=${position.verse}`
    : "/read";

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          isDesktop
            ? "flex items-center gap-2 px-2 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            : "p-1 rounded-full focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        }
        aria-label="Open account menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div
          className={`${avatarSize} rounded-full ${avatarBg} text-white flex items-center justify-center ${textSize} font-medium`}
        >
          {isGuest ? (
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            getInitials(user?.name)
          )}
        </div>
        {isDesktop && (
          <>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {displayName}
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
        >
          {/* Header - User/Guest info */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            {isGuest ? (
              <>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Guest
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Saved on this device
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user?.name || user?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </>
            )}
          </div>

          {/* Navigation items */}
          <div className="py-1">
            {/* My Favorites */}
            <Link
              role="menuitem"
              to="/verses?favorites=true"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
            >
              <HeartIcon className="w-4 h-4 text-red-400" filled />
              <span>My Favorites</span>
              {favoritesCount > 0 && (
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                  {favoritesCount}
                </span>
              )}
            </Link>

            {/* Reading position */}
            <Link
              role="menuitem"
              to={readingPath}
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
            >
              <NavIcon path={NAV_ICONS.read} />
              <span>{readingLabel}</span>
            </Link>

            {/* My Guidance */}
            <Link
              role="menuitem"
              to="/consultations"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
            >
              <NavIcon path={NAV_ICONS.cases} />
              <span>My Guidance</span>
            </Link>
          </div>

          {/* Settings & About */}
          <div className="py-1 border-t border-gray-100 dark:border-gray-700">
            <Link
              role="menuitem"
              to="/settings"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
            >
              <NavIcon path={NAV_ICONS.settings} />
              <span>Settings</span>
            </Link>

            <Link
              role="menuitem"
              to="/about"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
            >
              <NavIcon path={NAV_ICONS.about} />
              <span>About</span>
            </Link>
          </div>

          {/* Actions - Guest: signup CTA, Authenticated: sign out */}
          <div className="py-2 border-t border-gray-100 dark:border-gray-700">
            {isGuest ? (
              <div className="px-3 space-y-2">
                {/* Primary CTA - Create account */}
                <Link
                  role="menuitem"
                  to="/signup"
                  onClick={handleLinkClick}
                  className="flex flex-col items-center gap-0.5 w-full px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    ✨ Create account
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Sync across devices
                  </span>
                </Link>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    or
                  </span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>

                {/* Secondary - Sign in button */}
                <Link
                  role="menuitem"
                  to="/login"
                  onClick={handleLinkClick}
                  className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
              >
                <NavIcon path={NAV_ICONS.logout} />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

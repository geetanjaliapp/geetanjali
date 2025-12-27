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
    ? "bg-[var(--text-muted)]"
    : "bg-[var(--interactive-primary)]";
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
            ? "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-avatar)] bg-[var(--surface-muted)] hover:bg-[var(--interactive-secondary-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
            : "p-1 rounded-[var(--radius-avatar)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
        }
        aria-label="Open account menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div
          className={`${avatarSize} rounded-[var(--radius-avatar)] ${avatarBg} ${isGuest ? "text-[var(--text-inverted)]" : "text-[var(--interactive-primary-text)]"} flex items-center justify-center ${textSize} font-medium`}
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
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {displayName}
            </span>
            <svg
              className={`w-4 h-4 text-[var(--text-tertiary)] transition-[var(--transition-transform)] ${isOpen ? "rotate-180" : ""}`}
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
          className="absolute right-0 mt-2 w-56 bg-[var(--surface-elevated)] rounded-[var(--radius-dropdown)] shadow-[var(--shadow-dropdown)] border border-[var(--border-default)] py-1 z-50"
        >
          {/* Header - User/Guest info */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            {isGuest ? (
              <>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Guest
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Saved on this device
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {user?.name || user?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
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
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
            >
              <HeartIcon
                className="w-4 h-4 text-[var(--icon-favorite)]"
                filled
              />
              <span>My Favorites</span>
              {favoritesCount > 0 && (
                <span className="ml-auto text-xs text-[var(--text-muted)]">
                  {favoritesCount}
                </span>
              )}
            </Link>

            {/* Reading position */}
            <Link
              role="menuitem"
              to={readingPath}
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
            >
              <NavIcon path={NAV_ICONS.read} />
              <span>{readingLabel}</span>
            </Link>

            {/* My Guidance */}
            <Link
              role="menuitem"
              to="/consultations"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
            >
              <NavIcon path={NAV_ICONS.cases} />
              <span>My Guidance</span>
            </Link>
          </div>

          {/* Settings & About */}
          <div className="py-1 border-t border-[var(--border-subtle)]">
            <Link
              role="menuitem"
              to="/settings"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
            >
              <NavIcon path={NAV_ICONS.settings} />
              <span>Settings</span>
            </Link>

            <Link
              role="menuitem"
              to="/about"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
            >
              <NavIcon path={NAV_ICONS.about} />
              <span>About</span>
            </Link>
          </div>

          {/* Actions - Guest: signup CTA, Authenticated: sign out */}
          <div className="py-2 border-t border-[var(--border-subtle)]">
            {isGuest ? (
              <div className="px-3 space-y-2">
                {/* Primary CTA - Create account */}
                <Link
                  role="menuitem"
                  to="/signup"
                  onClick={handleLinkClick}
                  className="flex flex-col items-center gap-0.5 w-full px-4 py-2.5 bg-[var(--surface-warm)] hover:bg-[var(--surface-warm-hover)] border border-[var(--border-warm)] rounded-[var(--radius-button)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <span className="text-sm font-medium text-[var(--badge-warm-text)]">
                    ✨ Create account
                  </span>
                  <span className="text-xs text-[var(--text-accent)]">
                    Sync across devices
                  </span>
                </Link>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 border-t border-[var(--border-default)]" />
                  <span className="text-xs text-[var(--text-muted)]">or</span>
                  <div className="flex-1 border-t border-[var(--border-default)]" />
                </div>

                {/* Secondary - Sign in button */}
                <Link
                  role="menuitem"
                  to="/login"
                  onClick={handleLinkClick}
                  className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-[var(--interactive-secondary-text)] bg-[var(--interactive-secondary-bg)] hover:bg-[var(--interactive-secondary-hover-bg)] border border-[var(--interactive-secondary-border)] rounded-[var(--radius-button)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
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

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
import { useFocusTrap, usePreferences } from "../../hooks";
import { HeartIcon } from "../icons";

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
 * 2. Global navigation links (Home, Verses, Read)
 * 3. Account section at bottom with personal items + auth actions
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

  // Get favorites count and reading position for account section
  const { favoritesCount, reading: { position } } = usePreferences();

  // Trap focus within drawer when open (WCAG 2.1)
  useFocusTrap(drawerRef, isOpen);

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  // Guest vs authenticated
  const isGuest = !isAuthenticated;

  // Reading link - dynamic based on position
  const hasReadingPosition = position?.chapter && position?.verse;
  const readingLabel = hasReadingPosition
    ? `Continue Ch.${position.chapter}`
    : "Start Reading";
  const readingPath = hasReadingPosition
    ? `/read?c=${position.chapter}&v=${position.verse}`
    : "/read";

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
          className="fixed inset-0 bg-[var(--overlay-bg-light)] backdrop-blur-xs"
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
        className={`fixed top-14 left-0 bottom-0 w-72 bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] z-30 transform transition-[var(--transition-modal)] md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Primary CTA */}
          <div className="p-3">
            <Link
              to={PRIMARY_CTA.to}
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-linear-to-r from-[var(--interactive-primary)] to-[var(--interactive-primary-hover)] hover:from-[var(--interactive-primary-hover)] hover:to-[var(--interactive-primary-active)] text-[var(--interactive-primary-text)] font-semibold rounded-[var(--radius-button)] shadow-[var(--shadow-card-hover)] transition-[var(--transition-card)] hover:shadow-[var(--shadow-card-elevated)] hover:scale-[1.02] active:scale-[0.98] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
            >
              <NavIcon path={NAV_ICONS[PRIMARY_CTA.icon]} className="w-5 h-5" />
              <span>{PRIMARY_CTA.mobileLabel}</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border-default)] mx-3" />

          {/* Global navigation links */}
          <div className="flex-1 py-3 overflow-y-auto">
            <div className="space-y-1 px-3">
              {visibleItems.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-[var(--radius-nav)] text-base font-medium transition-[var(--transition-nav)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset ${
                      isActive
                        ? "text-[var(--menu-item-selected-text)] bg-[var(--menu-item-selected-bg)] shadow-[var(--shadow-button)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--menu-item-selected-text)] hover:bg-[var(--menu-item-hover-bg)]"
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

          {/* Account section at bottom */}
          <div className="border-t border-[var(--border-warm)] bg-[var(--surface-warm-translucent-subtle)]">
            {/* Account header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
              <div
                className={`w-10 h-10 rounded-[var(--radius-avatar)] ${
                  isGuest
                    ? "bg-[var(--text-muted)]"
                    : "bg-[var(--interactive-primary)]"
                } ${isGuest ? "text-[var(--text-inverted)]" : "text-[var(--interactive-primary-text)]"} flex items-center justify-center text-sm font-medium shadow-[var(--shadow-button)]`}
              >
                {isGuest ? (
                  <svg
                    className="w-5 h-5"
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
              <div className="flex-1 min-w-0">
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
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {user?.name || user?.email?.split("@")[0]}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {user?.email}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Personal navigation items */}
            <div className="py-2 px-3 space-y-0.5">
              {/* My Favorites */}
              <Link
                to="/verses?favorites=true"
                onClick={onClose}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[var(--radius-nav)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-warm-hover)] transition-[var(--transition-color)]"
              >
                <div className="flex items-center gap-3">
                  <HeartIcon
                    className="w-4 h-4 text-[var(--icon-favorite)]"
                    filled
                  />
                  <span>My Favorites</span>
                </div>
                {favoritesCount > 0 && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {favoritesCount}
                  </span>
                )}
              </Link>

              {/* Reading position */}
              <Link
                to={readingPath}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-nav)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-warm-hover)] transition-[var(--transition-color)]"
              >
                <NavIcon path={NAV_ICONS.read} className="w-4 h-4" />
                <span>{readingLabel}</span>
              </Link>

              {/* My Guidance */}
              <Link
                to="/consultations"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-nav)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-warm-hover)] transition-[var(--transition-color)]"
              >
                <NavIcon path={NAV_ICONS.cases} className="w-4 h-4" />
                <span>My Guidance</span>
              </Link>

              {/* Settings */}
              <Link
                to="/settings"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-nav)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-warm-hover)] transition-[var(--transition-color)]"
              >
                <NavIcon path={NAV_ICONS.settings} className="w-4 h-4" />
                <span>Settings</span>
              </Link>

              {/* About */}
              <Link
                to="/about"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-nav)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-warm-hover)] transition-[var(--transition-color)]"
              >
                <NavIcon path={NAV_ICONS.about} className="w-4 h-4" />
                <span>About</span>
              </Link>
            </div>

            {/* Auth action */}
            <div className="p-3 pt-1">
              {isGuest ? (
                <div className="space-y-2">
                  {/* Create account CTA */}
                  <Link
                    to="/signup"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--surface-warm)] hover:bg-[var(--surface-warm-hover)] border border-[var(--border-warm)] text-[var(--badge-warm-text)] font-medium rounded-[var(--radius-button)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <span>✨</span>
                    <span>Create account — Sync across devices</span>
                  </Link>

                  {/* Divider */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-[var(--border-warm)]" />
                    <span className="text-xs text-[var(--text-muted)]">or</span>
                    <div className="flex-1 border-t border-[var(--border-warm)]" />
                  </div>

                  {/* Sign in button */}
                  <Link
                    to="/login"
                    onClick={onClose}
                    className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-[var(--interactive-secondary-text)] bg-[var(--interactive-secondary-bg)] hover:bg-[var(--interactive-secondary-hover-bg)] border border-[var(--interactive-secondary-border)] rounded-[var(--radius-button)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    Sign in
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--interactive-secondary-text)] bg-[var(--interactive-secondary-bg)] hover:bg-[var(--interactive-secondary-hover-bg)] border border-[var(--interactive-secondary-border)] rounded-[var(--radius-button)] transition-[var(--transition-nav)] hover:shadow-[var(--shadow-button)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
                >
                  <NavIcon path={NAV_ICONS.logout} className="w-4 h-4" />
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

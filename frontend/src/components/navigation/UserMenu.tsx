import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useClickOutside } from "./hooks";
import { NAV_ICONS } from "./navConfig";
import type { NavUser } from "./types";
import { getInitials, getFirstName } from "./utils";
import { HeartIcon } from "../icons";
import { usePreferences } from "../../hooks";

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
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Get favorites count and reading position for display
  const { favoritesCount, reading: { position } } = usePreferences();

  useClickOutside(menuRef, () => setIsOpen(false), isOpen);

  // Close menu and restore focus to trigger
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    // Restore focus to trigger button (WCAG 2.1)
    triggerRef.current?.focus();
  }, []);

  // Handle keyboard navigation (WCAG 2.1)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const menuItems = menuRef.current?.querySelectorAll('[role="menuitem"]');
      if (!menuItems?.length) return;

      const itemsArray = Array.from(menuItems) as HTMLElement[];
      const currentIndex = itemsArray.findIndex((item) => item === document.activeElement);

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeMenu();
          break;
        case "ArrowDown":
          e.preventDefault();
          {
            const nextIndex = currentIndex < itemsArray.length - 1 ? currentIndex + 1 : 0;
            itemsArray[nextIndex]?.focus();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          {
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemsArray.length - 1;
            itemsArray[prevIndex]?.focus();
          }
          break;
        case "Home":
          e.preventDefault();
          itemsArray[0]?.focus();
          break;
        case "End":
          e.preventDefault();
          itemsArray[itemsArray.length - 1]?.focus();
          break;
        case "Tab":
          // Close menu on Tab (standard menu behavior)
          closeMenu();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeMenu]);

  // Focus first menu item when menu opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure menu is rendered
      requestAnimationFrame(() => {
        const firstItem = menuRef.current?.querySelector('[role="menuitem"]');
        (firstItem as HTMLElement)?.focus();
      });
    }
  }, [isOpen]);

  const handleLogout = () => {
    closeMenu();
    onLogout();
  };

  const handleLinkClick = () => {
    closeMenu();
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
    ? `Resume BG ${position.chapter}.${position.verse}`
    : "Start reading";
  const readingPath = hasReadingPosition
    ? `/read?c=${position.chapter}&v=${position.verse}`
    : "/read";

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
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

          {/* Navigation items - ordered by frequency */}
          <div className="py-1">
            {/* My Guidance - most frequent */}
            <Link
              role="menuitem"
              to="/consultations"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
            >
              <NavIcon path={NAV_ICONS.cases} />
              <span>My Guidance</span>
            </Link>

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

            {/* Reading position - personalized */}
            <Link
              role="menuitem"
              to={readingPath}
              onClick={handleLinkClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:bg-[var(--menu-item-hover-bg)]"
            >
              <NavIcon path={NAV_ICONS.read} />
              <span>{readingLabel}</span>
            </Link>
          </div>

          {/* Settings */}
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

                {/* Secondary - Sign in link */}
                <div className="flex items-center justify-center gap-1.5 py-1">
                  <span className="text-xs text-[var(--text-muted)]">or</span>
                  <Link
                    role="menuitem"
                    to="/login"
                    onClick={handleLinkClick}
                    className="text-sm font-medium text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:underline transition-[var(--transition-color)] focus:outline-hidden focus-visible:underline"
                  >
                    Sign in →
                  </Link>
                </div>
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

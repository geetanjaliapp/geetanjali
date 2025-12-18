import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useClickOutside } from "./hooks";
import type { NavUser } from "./types";
import { getInitials, getFirstName } from "./utils";
import { HeartIcon } from "../icons";

interface UserMenuProps {
  /** Current user object */
  user: NavUser | null;
  /** Logout handler */
  onLogout: () => void;
  /** Variant for different contexts */
  variant?: "desktop" | "mobile-header";
}

/**
 * User avatar button with dropdown menu
 *
 * Shows user initials in a circular avatar.
 * On click, shows dropdown with user info and sign out button.
 */
export function UserMenu({
  user,
  onLogout,
  variant = "desktop",
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setIsOpen(false), isOpen);

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  const isDesktop = variant === "desktop";
  const avatarSize = isDesktop ? "w-7 h-7" : "w-8 h-8";
  const textSize = isDesktop ? "text-xs" : "text-sm";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          isDesktop
            ? "flex items-center gap-2 px-2 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            : "p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        }
        aria-label="Open user menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div
          className={`${avatarSize} rounded-full bg-orange-600 text-white flex items-center justify-center ${textSize} font-medium`}
        >
          {getInitials(user?.name)}
        </div>
        {isDesktop && (
          <>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getFirstName(user?.name)}
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

      {isOpen && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
        >
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
          <Link
            role="menuitem"
            to="/verses?favorites=true"
            onClick={() => setIsOpen(false)}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
          >
            <HeartIcon className="w-4 h-4 text-red-400" filled />
            My Favorites
          </Link>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

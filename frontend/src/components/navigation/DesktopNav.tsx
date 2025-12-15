import { Link } from "react-router-dom";
import {
  NAV_ITEMS,
  NAV_ICONS,
  PRIMARY_CTA,
  isNavItemActive,
  getVisibleNavItems,
} from "./navConfig";
import { UserMenu } from "./UserMenu";
import type { NavUser } from "./types";

interface DesktopNavProps {
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
 * Desktop navigation links and auth section
 *
 * Hidden on mobile (md:hidden), shows nav links and auth controls.
 */
export function DesktopNav({
  pathname,
  isAuthenticated,
  user,
  onLogout,
}: DesktopNavProps) {
  const visibleItems = getVisibleNavItems(NAV_ITEMS, isAuthenticated);
  const isAskActive = pathname === PRIMARY_CTA.to;

  // Find Home item to render it first, then Ask CTA, then rest
  const homeItem = visibleItems.find((item) => item.to === "/");
  const otherItems = visibleItems.filter((item) => item.to !== "/");

  return (
    <div className="hidden md:flex items-center space-x-1" role="navigation" aria-label="Main navigation">
      {/* Home link */}
      {homeItem && (
        <Link
          to={homeItem.to}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
            isNavItemActive(homeItem, pathname)
              ? "text-orange-700 bg-orange-100 shadow-sm"
              : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
          }`}
        >
          {homeItem.label}
        </Link>
      )}

      {/* Ask CTA with icon */}
      <Link
        to={PRIMARY_CTA.to}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
          isAskActive
            ? "text-orange-700 bg-orange-100 shadow-sm"
            : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={NAV_ICONS.sparkle} />
        </svg>
        Ask
      </Link>

      {/* Other navigation links */}
      {otherItems.map((item) => {
        const isActive = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
              isActive
                ? "text-orange-700 bg-orange-100 shadow-sm"
                : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      {/* Auth section */}
      {isAuthenticated ? (
        <div className="relative ml-2 pl-3 border-l border-gray-200">
          <UserMenu user={user} onLogout={onLogout} variant="desktop" />
        </div>
      ) : (
        <div className="ml-2 pl-3 border-l border-gray-200">
          <Link
            to="/login"
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
              pathname === "/login" || pathname === "/signup"
                ? "text-orange-700 bg-orange-100 shadow-sm"
                : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
            }`}
          >
            Login
          </Link>
        </div>
      )}
    </div>
  );
}

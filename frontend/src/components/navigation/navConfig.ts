/**
 * Navigation Configuration
 *
 * Centralized configuration for all navigation items.
 * Single source of truth for routes, labels, icons, and visibility rules.
 */

/** SVG path data for navigation icons */
export const NAV_ICONS = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  read: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  verses:
    "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  cases:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  about:
    "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  sparkle:
    "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  logout:
    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
} as const;

/** Navigation item configuration */
export interface NavItem {
  /** Route path */
  to: string;
  /** Desktop label (short) */
  label: string;
  /** Mobile drawer label (can be longer) */
  mobileLabel: string;
  /** Icon key from NAV_ICONS */
  icon: keyof typeof NAV_ICONS;
  /** Only show when authenticated */
  authOnly?: boolean;
  /** Route prefixes that should mark this item as active */
  activePrefixes?: string[];
}

/** Primary CTA configuration */
export interface PrimaryCTA {
  to: string;
  label: string;
  mobileLabel: string;
  icon: keyof typeof NAV_ICONS;
}

/**
 * Primary call-to-action (Seek Guidance)
 * Shown at top of mobile drawer with prominent styling
 */
export const PRIMARY_CTA: PrimaryCTA = {
  to: "/cases/new",
  label: "Seek Guidance",
  mobileLabel: "Seek Guidance",
  icon: "sparkle",
};

/**
 * Main navigation items
 * Order determines display order in both desktop and mobile nav
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Home",
    mobileLabel: "Home",
    icon: "home",
    activePrefixes: [], // Exact match only
  },
  {
    to: "/read",
    label: "Read",
    mobileLabel: "Read Scripture",
    icon: "read",
    activePrefixes: ["/read"],
  },
  {
    to: "/verses",
    label: "Verses",
    mobileLabel: "Browse Verses",
    icon: "verses",
    activePrefixes: ["/verses"],
  },
  {
    to: "/search",
    label: "Search",
    mobileLabel: "Search Verses",
    icon: "search",
    activePrefixes: ["/search"],
  },
  {
    to: "/consultations",
    label: "Cases",
    mobileLabel: "Cases",
    icon: "cases",
    // Available to all users - anonymous users see session-based cases via localStorage
    activePrefixes: ["/consultations", "/cases/"],
  },
  {
    to: "/about",
    label: "About",
    mobileLabel: "About",
    icon: "about",
    activePrefixes: [], // Exact match only
  },
];

/**
 * Check if a nav item is active based on current path
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  // Exact match for home
  if (item.to === "/" && pathname === "/") {
    return true;
  }

  // Exact match for the route
  if (pathname === item.to) {
    return true;
  }

  // Check prefix matches (for nested routes)
  // Exclude /cases/new as it has its own "Ask" CTA
  if (item.activePrefixes) {
    if (pathname === "/cases/new") {
      return false;
    }
    return item.activePrefixes.some((prefix) => pathname.startsWith(prefix));
  }

  return false;
}

/**
 * Filter nav items based on authentication state
 */
export function getVisibleNavItems(
  items: NavItem[],
  isAuthenticated: boolean
): NavItem[] {
  return items.filter((item) => !item.authOnly || isAuthenticated);
}

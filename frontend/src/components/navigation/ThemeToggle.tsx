/**
 * Theme Toggle Component (v1.12.0)
 *
 * Cycles through themes: light → dark → system
 * Shows appropriate icon for each state.
 */

import { useTheme, type Theme } from "../../contexts/ThemeContext";

interface ThemeToggleProps {
  /** Visual variant */
  variant?: "navbar" | "mobile-drawer";
}

// Icons for each theme state
const THEME_ICONS: Record<Theme, { path: string; label: string }> = {
  light: {
    // Sun icon
    path: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    label: "Light mode",
  },
  dark: {
    // Moon icon
    path: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
    label: "Dark mode",
  },
  system: {
    // Computer/monitor icon
    path: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    label: "System theme",
  },
};

export function ThemeToggle({ variant = "navbar" }: ThemeToggleProps) {
  const { theme, cycleTheme } = useTheme();
  const { path, label } = THEME_ICONS[theme];

  if (variant === "mobile-drawer") {
    return (
      <button
        onClick={cycleTheme}
        className="flex items-center gap-3 w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        aria-label={`Current: ${label}. Click to change theme.`}
      >
        <svg
          className="w-5 h-5 text-gray-500 dark:text-gray-400"
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
        <span className="font-medium">{label}</span>
      </button>
    );
  }

  // Navbar variant (icon only)
  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      aria-label={`Current: ${label}. Click to change theme.`}
      title={label}
    >
      <svg
        className="w-5 h-5"
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
    </button>
  );
}

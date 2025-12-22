import { Link } from "react-router-dom";

interface NavLogoProps {
  /** Show back button instead of logo */
  showBack?: boolean;
  /** Back button destination */
  backTo?: string;
  /** Back button label */
  backLabel?: string;
}

/**
 * Navigation logo or back button component
 *
 * Renders either:
 * - Logo with "Geetanjali" text (default)
 * - Back arrow with label (when showBack=true)
 */
export function NavLogo({
  showBack,
  backTo = "/",
  backLabel = "Back",
}: NavLogoProps) {
  if (showBack) {
    return (
      <Link
        to={backTo}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 rounded-md"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span className="font-medium">{backLabel}</span>
      </Link>
    );
  }

  return (
    <Link
      to="/"
      className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 rounded-md"
    >
      <img
        src="/logo.svg"
        alt="Geetanjali"
        className="h-8 w-8 sm:h-10 sm:w-10"
      />
      <span className="text-xl sm:text-2xl font-heading font-bold text-orange-600 dark:text-orange-400">
        Geetanjali
      </span>
    </Link>
  );
}

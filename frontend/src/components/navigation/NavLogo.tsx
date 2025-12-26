import { Link } from "react-router-dom";
import { LogoIcon } from "../icons";

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
        className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded-[var(--radius-nav)]"
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
      className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-[var(--transition-opacity)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded-[var(--radius-nav)]"
    >
      <LogoIcon size={32} className="sm:w-10 sm:h-10" />
      <span className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-accent)]">
        Geetanjali
      </span>
    </Link>
  );
}

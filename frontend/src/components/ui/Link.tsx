/**
 * Link Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * @example
 * // Internal link (default)
 * <Link href="/about">About us</Link>
 *
 * // External link (opens in new tab, shows icon)
 * <Link href="https://example.com" external>External site</Link>
 *
 * // Subtle link (less emphasis)
 * <Link href="/terms" variant="subtle">Terms of service</Link>
 *
 * // Nav link
 * <Link href="/dashboard" variant="nav">Dashboard</Link>
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type AnchorHTMLAttributes } from "react";

/**
 * Link style variants using CVA
 * All colors reference design tokens from src/styles/tokens/
 */
const linkVariants = cva(
  // Base styles (shared across all variants)
  [
    "inline-flex items-center gap-1",
    "transition-colors duration-150",
    "focus:outline-none focus-visible:ring-2",
    "focus-visible:ring-[var(--focus-ring)]",
    "focus-visible:ring-offset-1",
    "focus-visible:ring-offset-[var(--focus-ring-offset)]",
    "focus-visible:rounded",
  ],
  {
    variants: {
      variant: {
        default: [
          "text-[var(--text-link)]",
          "hover:text-[var(--text-link-hover)]",
          "active:text-[var(--text-link-active)]",
          "underline underline-offset-2",
        ],
        subtle: [
          "text-[var(--text-secondary)]",
          "hover:text-[var(--text-primary)]",
          "hover:underline underline-offset-2",
        ],
        nav: [
          "text-[var(--text-primary)]",
          "hover:text-[var(--text-link)]",
          "font-medium",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * External link icon component
 */
const ExternalIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

/**
 * Link component props
 */
export interface LinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof linkVariants> {
  /** If true, opens in new tab and shows external icon */
  external?: boolean;
}

/**
 * Link component
 *
 * Foundation UI component using design token system.
 * Supports default, subtle, and nav variants.
 * External links automatically open in new tab with security attributes.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, variant, external, children, ...props }, ref) => {
    const externalProps = external
      ? {
          target: "_blank",
          rel: "noopener noreferrer",
        }
      : {};

    return (
      <a
        ref={ref}
        className={linkVariants({ variant, className })}
        {...externalProps}
        {...props}
      >
        {children}
        {external && (
          <>
            <span className="sr-only"> (opens in new tab)</span>
            <ExternalIcon />
          </>
        )}
      </a>
    );
  }
);

Link.displayName = "Link";

// Export variants for external composition
export { linkVariants };

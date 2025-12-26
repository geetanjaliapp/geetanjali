/**
 * Badge Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * @example
 * // Default badge
 * <Badge>Default</Badge>
 *
 * // Domain-specific variants
 * <Badge variant="principle">Strategy</Badge>
 * <Badge variant="match">85% Match</Badge>
 * <Badge variant="featured">Featured</Badge>
 *
 * // Status badges
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning">Pending</Badge>
 * <Badge variant="error">Failed</Badge>
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

/**
 * Badge style variants using CVA
 * All colors reference design tokens from src/styles/tokens/
 */
const badgeVariants = cva(
  // Base styles (shared across all variants)
  [
    "inline-flex items-center justify-center",
    "rounded-[var(--radius-badge)] font-medium",
    "transition-[var(--transition-color)]",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--badge-default-bg)]",
          "text-[var(--badge-default-text)]",
        ],
        warm: [
          "bg-[var(--badge-warm-bg)]",
          "text-[var(--badge-warm-text)]",
        ],
        principle: [
          "bg-[var(--badge-principle-bg)]",
          "text-[var(--badge-principle-text)]",
        ],
        match: [
          "bg-[var(--badge-match-bg)]",
          "text-[var(--badge-match-text)]",
        ],
        featured: [
          "bg-[var(--badge-featured-bg)]",
          "text-[var(--badge-featured-text)]",
        ],
        success: [
          "bg-[var(--status-success-bg)]",
          "text-[var(--status-success-text)]",
        ],
        warning: [
          "bg-[var(--status-warning-bg)]",
          "text-[var(--status-warning-text)]",
        ],
        error: [
          "bg-[var(--status-error-bg)]",
          "text-[var(--status-error-text)]",
        ],
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-sm",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

/**
 * Badge component props
 */
export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge component
 *
 * Foundation UI component using design token system.
 * Supports domain-specific variants (principle, match, featured)
 * and status variants (success, warning, error).
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={badgeVariants({ variant, size, className })}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

// Export variants for external composition
export { badgeVariants };

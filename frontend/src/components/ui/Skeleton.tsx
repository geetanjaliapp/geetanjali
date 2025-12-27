/**
 * Skeleton Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * @example
 * // Text skeleton (default)
 * <Skeleton className="h-4 w-32" />
 *
 * // Avatar/circular skeleton
 * <Skeleton variant="circular" className="h-12 w-12" />
 *
 * // Card skeleton
 * <Skeleton variant="rectangular" className="h-40 w-full" />
 *
 * // Multiple text lines
 * <div className="space-y-2">
 *   <Skeleton className="h-4 w-full" />
 *   <Skeleton className="h-4 w-3/4" />
 *   <Skeleton className="h-4 w-1/2" />
 * </div>
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

/**
 * Skeleton style variants using CVA
 * All colors reference design tokens from src/styles/tokens/
 */
const skeletonVariants = cva(
  // Base styles (shared across all variants)
  ["animate-pulse", "bg-[var(--skeleton-bg)]"],
  {
    variants: {
      variant: {
        text: "rounded-[var(--radius-skeleton)]",
        circular: "rounded-[var(--radius-avatar)]",
        rectangular: "rounded-[var(--radius-card)]",
      },
    },
    defaultVariants: {
      variant: "text",
    },
  },
);

/**
 * Skeleton component props
 */
export interface SkeletonProps
  extends
    HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

/**
 * Skeleton component
 *
 * Foundation UI component using design token system.
 * Provides loading placeholder with pulse animation.
 * Use className to control dimensions.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={skeletonVariants({ variant, className })}
        aria-hidden="true"
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";

// Export variants for external composition
// eslint-disable-next-line react-refresh/only-export-components
export { skeletonVariants };

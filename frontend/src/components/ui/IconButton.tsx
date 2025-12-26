/**
 * IconButton Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * Icon-only button variant that requires aria-label for accessibility.
 *
 * @example
 * // Primary icon button
 * <IconButton aria-label="Add item" variant="primary">
 *   <PlusIcon className="h-5 w-5" />
 * </IconButton>
 *
 * // Ghost icon button (common for toolbar actions)
 * <IconButton aria-label="Close" variant="ghost" size="sm">
 *   <XIcon className="h-4 w-4" />
 * </IconButton>
 *
 * // Large icon button (icon should be ~50% of button size)
 * <IconButton aria-label="Menu" variant="secondary" size="lg">
 *   <MenuIcon className="h-6 w-6" />
 * </IconButton>
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * IconButton style variants using CVA
 * Shares variant colors with Button but uses square dimensions
 */
const iconButtonVariants = cva(
  // Base styles (shared across all variants)
  [
    "inline-flex items-center justify-center",
    "rounded-[var(--radius-button)]",
    "transition-[var(--transition-button)]",
    "focus:outline-none focus-visible:ring-2",
    "focus-visible:ring-[var(--focus-ring)]",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-[var(--focus-ring-offset)]",
    "disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--interactive-primary)]",
          "text-[var(--interactive-primary-text)]",
          "hover:bg-[var(--interactive-primary-hover)]",
          "active:bg-[var(--interactive-primary-active)]",
          "disabled:bg-[var(--interactive-primary-disabled-bg)]",
          "disabled:text-[var(--interactive-primary-disabled-text)]",
        ],
        secondary: [
          "bg-[var(--interactive-secondary-bg)]",
          "text-[var(--interactive-secondary-text)]",
          "border",
          "border-[var(--interactive-secondary-border)]",
          "hover:bg-[var(--interactive-secondary-hover-bg)]",
          "hover:border-[var(--interactive-secondary-hover-border)]",
          "active:bg-[var(--interactive-secondary-active-bg)]",
          "disabled:bg-[var(--interactive-secondary-disabled-bg)]",
          "disabled:text-[var(--interactive-secondary-disabled-text)]",
          "disabled:border-[var(--interactive-secondary-disabled-border)]",
        ],
        ghost: [
          "bg-transparent",
          "text-[var(--interactive-ghost-text)]",
          "hover:text-[var(--interactive-ghost-hover-text)]",
          "hover:bg-[var(--interactive-ghost-hover-bg)]",
          "active:bg-[var(--interactive-ghost-active-bg)]",
          "disabled:text-[var(--interactive-ghost-disabled-text)]",
          "disabled:bg-transparent",
        ],
      },
      size: {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  }
);

/**
 * IconButton component props
 * Note: aria-label is required for accessibility
 */
export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Required for accessibility - describes the button action */
  "aria-label": string;
  /** Icon element to render */
  children: ReactNode;
}

/**
 * IconButton component
 *
 * Foundation UI component using design token system.
 * Square button for icon-only actions.
 * Requires aria-label for screen reader accessibility.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={iconButtonVariants({ variant, size, className })}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

// Export variants for external composition
export { iconButtonVariants };

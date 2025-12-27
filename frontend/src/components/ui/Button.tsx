/**
 * Button Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * @example
 * <Button variant="primary" size="md">Click me</Button>
 * <Button variant="secondary" size="sm" disabled>Disabled</Button>
 * <Button variant="ghost" onClick={handleClick}>Ghost action</Button>
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

/**
 * Button style variants using CVA
 * All colors reference design tokens from src/styles/tokens/
 */
const buttonVariants = cva(
  // Base styles (shared across all variants)
  [
    "inline-flex items-center justify-center gap-2",
    "font-semibold rounded-[var(--radius-button)]",
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
        contextual: [
          "bg-[var(--interactive-contextual)]",
          "text-[var(--interactive-contextual-text)]",
          "hover:bg-[var(--interactive-contextual-hover)]",
          "active:bg-[var(--interactive-contextual-active)]",
          "disabled:bg-[var(--interactive-contextual-disabled-bg)]",
          "disabled:text-[var(--interactive-contextual-disabled-text)]",
        ],
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

/**
 * Button component props
 */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
}

/**
 * Button component
 *
 * Foundation UI component using design token system.
 * Supports primary, secondary, ghost, and contextual variants.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, fullWidth, className })}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

// Export variants for external composition
// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };

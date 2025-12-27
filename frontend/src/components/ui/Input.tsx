/**
 * Input Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * @example
 * // Basic input
 * <Input placeholder="Enter text" />
 *
 * // With label and error
 * <Input
 *   label="Email"
 *   type="email"
 *   error="Please enter a valid email"
 *   placeholder="you@example.com"
 * />
 *
 * // Disabled state
 * <Input label="Disabled" disabled value="Cannot edit" />
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type InputHTMLAttributes, useId } from "react";

/**
 * Input style variants using CVA
 * All colors reference design tokens from src/styles/tokens/
 */
const inputVariants = cva(
  // Base styles (shared across all variants)
  [
    "w-full rounded-[var(--radius-input)] border px-3 py-2",
    "text-[var(--input-text)]",
    "bg-[var(--input-bg)]",
    "placeholder:text-[var(--input-text-placeholder)]",
    "transition-[var(--transition-color)]",
    "focus:outline-none focus:ring-2",
    "focus:ring-[var(--focus-ring)]",
    "focus:ring-offset-1", // Tighter offset for form controls
    "focus:ring-offset-[var(--focus-ring-offset)]",
    "disabled:cursor-not-allowed",
    "disabled:bg-[var(--input-bg-disabled)]",
    "disabled:text-[var(--input-text-disabled)]",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-[var(--input-border)]",
          "hover:border-[var(--input-border-hover)]",
          "focus:border-[var(--input-border-focus)]",
        ],
        error: [
          "border-[var(--input-border-error)]",
          "focus:border-[var(--input-border-error)]",
          "focus:ring-[var(--status-error-border)]",
        ],
      },
      size: {
        sm: "text-sm py-1.5 px-2.5",
        md: "text-base py-2 px-3",
        lg: "text-lg py-2.5 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

/**
 * Label style variants
 */
const labelVariants = cva(
  ["block text-sm font-medium mb-1.5 text-[var(--text-primary)]"],
  {
    variants: {
      required: {
        true: "after:content-['*'] after:ml-0.5 after:text-[var(--status-error-text)]",
        false: "",
      },
    },
    defaultVariants: {
      required: false,
    },
  },
);

/**
 * Input component props
 */
export interface InputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Label text displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input (when no error) */
  helperText?: string;
}

/**
 * Input component
 *
 * Foundation UI component using design token system.
 * Supports label, error state, and helper text.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      label,
      error,
      helperText,
      disabled,
      required,
      id: providedId,
      ...props
    },
    ref,
  ) => {
    // Generate unique ID for accessibility
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    // Use error variant when error is present
    const effectiveVariant = error ? "error" : variant;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={labelVariants({ required: required || false })}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={inputVariants({
            variant: effectiveVariant,
            size,
            className,
          })}
          disabled={disabled}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-[var(--status-error-text)]"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={helperId}
            className="mt-1.5 text-sm text-[var(--text-tertiary)]"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

// Export variants for external composition
// eslint-disable-next-line react-refresh/only-export-components
export { inputVariants };

/**
 * Card Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * @example
 * // Basic card with content
 * <Card variant="warm" padding="md">Content here</Card>
 *
 * // Structured card with title and description
 * <Card variant="elevated">
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Brief description of the card content.</CardDescription>
 *   </CardHeader>
 *   <CardContent>Main content goes here</CardContent>
 *   <CardFooter>Footer actions</CardFooter>
 * </Card>
 *
 * // Interactive card
 * <Card variant="interactive" role="button" tabIndex={0} onClick={handleClick}>
 *   Clickable card
 * </Card>
 */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

/**
 * Card style variants using CVA
 * All colors reference design tokens from src/styles/tokens/
 */
const cardVariants = cva(
  // Base styles (shared across all variants)
  ["rounded-[var(--radius-card)]", "border", "transition-[var(--transition-card)]"],
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--surface-base)]",
          "border-[var(--border-default)]",
        ],
        card: [
          "bg-[var(--surface-card)]",
          "border-[var(--border-warm)]",
        ],
        warm: [
          "bg-[var(--surface-warm)]",
          "border-[var(--border-warm)]",
        ],
        elevated: [
          "bg-[var(--surface-elevated)]",
          "border-[var(--border-subtle)]",
          "shadow-[var(--shadow-card-elevated)]",
        ],
        interactive: [
          "bg-[var(--surface-card)]",
          "border-[var(--border-warm)]",
          "cursor-pointer",
          "hover:bg-[var(--surface-warm-hover)]",
          "hover:border-[var(--border-warm-hover)]",
          "hover:shadow-[var(--shadow-card-hover)]",
          "focus-visible:outline-none",
          "focus-visible:ring-2",
          "focus-visible:ring-[var(--focus-ring)]",
          "focus-visible:ring-offset-2",
          "focus-visible:ring-offset-[var(--focus-ring-offset)]",
        ],
        verse: [
          "bg-[var(--section-verse-bg)]",
          "border-[var(--section-verse-border)]",
        ],
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        md: "p-4 sm:p-6",
        lg: "p-6 sm:p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

/**
 * Card component props
 */
export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/**
 * Card component
 *
 * Foundation UI component using design token system.
 * Supports default, card, warm, elevated, interactive, and verse variants.
 *
 * Variant guide:
 * - default: Page-level background (surface-base)
 * - card: Standard card surface (surface-card) - use for content cards
 * - warm: Intentionally warm-tinted surface (surface-warm) - decorative accent
 * - elevated: Modal/dropdown surfaces (surface-elevated)
 * - interactive: Clickable card with hover effects (uses surface-card)
 * - verse: Verse/scripture sections
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant, padding, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardVariants({ variant, padding, className })}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// Export variants for external composition
// eslint-disable-next-line react-refresh/only-export-components
export { cardVariants };

/**
 * CardHeader - Optional header section for cards
 */
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={`pb-3 border-b border-[var(--border-subtle)] ${className || ""}`}
    {...props}
  >
    {children}
  </div>
));

CardHeader.displayName = "CardHeader";

/**
 * CardContent - Main content section for cards
 */
export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={`py-3 ${className || ""}`} {...props}>
    {children}
  </div>
));

CardContent.displayName = "CardContent";

/**
 * CardFooter - Optional footer section for cards
 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={`pt-3 border-t border-[var(--border-subtle)] ${className || ""}`}
    {...props}
  >
    {children}
  </div>
));

CardFooter.displayName = "CardFooter";

/**
 * CardTitle - Title element for cards (renders as h3)
 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-lg font-semibold leading-tight text-[var(--text-primary)] ${className || ""}`}
    {...props}
  >
    {children}
  </h3>
));

CardTitle.displayName = "CardTitle";

/**
 * CardDescription - Descriptive text for cards
 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-[var(--text-secondary)] ${className || ""}`}
    {...props}
  >
    {children}
  </p>
));

CardDescription.displayName = "CardDescription";

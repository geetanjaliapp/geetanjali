/**
 * Modal Component - Foundation UI Component (v1.16.0)
 *
 * Uses design tokens via CSS custom properties for theming support.
 * No `dark:` prefixes - dark mode handled automatically via token system.
 *
 * @example
 * // Basic modal
 * <Modal open={isOpen} onClose={() => setIsOpen(false)}>
 *   <ModalHeader>
 *     <ModalTitle>Modal Title</ModalTitle>
 *   </ModalHeader>
 *   <ModalContent>
 *     <p>Modal content goes here.</p>
 *   </ModalContent>
 *   <ModalFooter>
 *     <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
 *   </ModalFooter>
 * </Modal>
 *
 * // Full-screen modal
 * <Modal open={isOpen} onClose={handleClose} size="full">
 *   ...
 * </Modal>
 */

import { cva, type VariantProps } from "class-variance-authority";
import {
  forwardRef,
  useEffect,
  useRef,
  useId,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";

/**
 * Modal content style variants using CVA
 */
const modalContentVariants = cva(
  // Base styles
  [
    "relative",
    "bg-[var(--surface-elevated)]",
    "border border-[var(--border-default)]",
    "shadow-[var(--shadow-modal)]",
    "w-full",
    "max-h-[90vh]",
    "overflow-hidden",
    "flex flex-col",
  ],
  {
    variants: {
      size: {
        sm: "max-w-sm rounded-[var(--radius-modal)]",
        md: "max-w-md rounded-[var(--radius-modal)]",
        lg: "max-w-lg rounded-[var(--radius-modal)]",
        xl: "max-w-xl rounded-[var(--radius-modal)]",
        full: "max-w-none h-full rounded-none sm:max-w-4xl sm:h-auto sm:max-h-[90vh] sm:rounded-[var(--radius-modal)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/**
 * Modal component props
 */
export interface ModalProps extends VariantProps<typeof modalContentVariants> {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Modal content */
  children: ReactNode;
  /** Close when clicking the overlay */
  closeOnOverlayClick?: boolean;
  /** Close when pressing Escape key */
  closeOnEscape?: boolean;
  /** Accessible label for the modal */
  "aria-label"?: string;
  /** ID of element that labels the modal */
  "aria-labelledby"?: string;
  /** ID of element that describes the modal */
  "aria-describedby"?: string;
}

/**
 * Modal component
 *
 * Foundation UI component using design token system.
 * Renders in a portal, traps focus, handles escape key, and prevents body scroll.
 */
export function Modal({
  open,
  onClose,
  size,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();

  // Focus trap
  useFocusTrap(modalRef, open);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close if clicking the overlay itself, not the modal content
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg)] transition-opacity"
        aria-hidden="true"
      />

      {/* Modal positioning */}
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={handleOverlayClick}
      >
        {/* Modal content */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby || `${generatedId}-title`}
          aria-describedby={ariaDescribedby}
          className={modalContentVariants({ size })}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // Render in portal
  return createPortal(modalContent, document.body);
}

Modal.displayName = "Modal";

// Export variants for external composition
export { modalContentVariants };

/**
 * ModalHeader - Header section with optional close button
 */
export const ModalHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean; onClose?: () => void }
>(({ className, children, showCloseButton, onClose, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex items-start justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] ${className || ""}`}
    {...props}
  >
    <div className="flex-1">{children}</div>
    {showCloseButton && onClose && (
      <button
        type="button"
        onClick={onClose}
        className="ml-4 p-1 rounded-[var(--radius-button)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-ghost-hover-bg)] transition-[var(--transition-color)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-label="Close modal"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    )}
  </div>
));

ModalHeader.displayName = "ModalHeader";

/**
 * ModalTitle - Title element for modals (renders as h2)
 */
export const ModalTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, children, id, ...props }, ref) => (
  <h2
    ref={ref}
    id={id}
    className={`text-lg font-semibold text-[var(--text-primary)] ${className || ""}`}
    {...props}
  >
    {children}
  </h2>
));

ModalTitle.displayName = "ModalTitle";

/**
 * ModalDescription - Descriptive text for modals
 */
export const ModalDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={`mt-1 text-sm text-[var(--text-secondary)] ${className || ""}`}
    {...props}
  >
    {children}
  </p>
));

ModalDescription.displayName = "ModalDescription";

/**
 * ModalContent - Main content section
 */
export const ModalContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex-1 overflow-y-auto p-4 sm:p-6 ${className || ""}`}
    {...props}
  >
    {children}
  </div>
));

ModalContent.displayName = "ModalContent";

/**
 * ModalFooter - Footer section for actions
 */
export const ModalFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-[var(--border-subtle)] ${className || ""}`}
    {...props}
  >
    {children}
  </div>
));

ModalFooter.displayName = "ModalFooter";

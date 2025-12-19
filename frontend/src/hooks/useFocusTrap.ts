import { useEffect, type RefObject } from "react";

/**
 * Trap focus within a container when active.
 *
 * WCAG 2.1 requirement: Modal dialogs must trap focus to prevent
 * keyboard users from tabbing into background content.
 *
 * @param ref - Ref to the container element
 * @param isActive - Whether the focus trap is active
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const container = ref.current;

    // Find all focusable elements
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements =
      container.querySelectorAll<HTMLElement>(focusableSelector);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when trap activates
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      // Shift+Tab on first element -> go to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
      // Tab on last element -> go to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, ref]);
}

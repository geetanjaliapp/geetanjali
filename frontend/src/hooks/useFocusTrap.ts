import { useEffect, useRef, type RefObject } from "react";

/**
 * Trap focus within a container when active.
 *
 * WCAG 2.1 requirement: Modal dialogs must trap focus to prevent
 * keyboard users from tabbing into background content.
 *
 * Features:
 * - Traps Tab/Shift+Tab within container
 * - Focuses first focusable element on activation
 * - Restores focus to previously focused element on deactivation
 *
 * @param ref - Ref to the container element
 * @param isActive - Whether the focus trap is active
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  // Store the element that was focused before the trap activated
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !ref.current) return;

    const container = ref.current;

    // Save currently focused element to restore later (WCAG 2.1)
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

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

    // Cleanup: restore focus when trap deactivates
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to previously focused element (WCAG 2.1)
      // Guard: only restore if element is still in DOM and visible
      const prev = previouslyFocusedRef.current;
      if (prev?.isConnected && !prev.closest("[inert]")) {
        prev.focus();
      }
    };
  }, [isActive, ref]);
}

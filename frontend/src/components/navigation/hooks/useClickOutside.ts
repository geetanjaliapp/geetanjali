import { useEffect, type RefObject } from "react";

/**
 * Hook that detects clicks outside of specified element(s)
 *
 * @param refs - Single ref or array of refs to monitor
 * @param handler - Callback function when click outside is detected
 * @param enabled - Optional flag to enable/disable the listener (default: true)
 *
 * @example
 * // Single ref
 * const menuRef = useRef<HTMLDivElement>(null);
 * useClickOutside(menuRef, () => setIsOpen(false));
 *
 * @example
 * // Multiple refs (click outside ALL of them triggers handler)
 * const dropdownRef = useRef<HTMLDivElement>(null);
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * useClickOutside([dropdownRef, buttonRef], () => setIsOpen(false));
 *
 * @example
 * // Conditionally enabled
 * useClickOutside(menuRef, handleClose, isMenuOpen);
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  refs: RefObject<T | null> | RefObject<T | null>[],
  handler: () => void,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const refsArray = Array.isArray(refs) ? refs : [refs];

      // Check if click is outside ALL provided refs
      const isOutside = refsArray.every((ref) => {
        return ref.current && !ref.current.contains(event.target as Node);
      });

      if (isOutside) {
        handler();
      }
    };

    // Use mousedown for immediate response (before click completes)
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [refs, handler, enabled]);
}

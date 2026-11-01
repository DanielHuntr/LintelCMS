import { type KeyboardEvent, type RefObject, useEffect } from "react";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab and Shift+Tab inside a dialog: from the last control Tab goes to the first, and
 * back. Call it from the dialog's `onKeyDown`.
 */
export function keepFocusInside(container: HTMLElement | null, event: KeyboardEvent): void {
  if (event.key !== "Tab" || !container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(focusableSelector)];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  const isOutside = !container.contains(active);
  if (event.shiftKey && (active === first || isOutside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || isOutside)) {
    event.preventDefault();
    first.focus();
  }
}

/** Puts focus back where it was before a dialog opened, once the dialog closes. */
export function useReturnFocus(isOpen: boolean, fallback?: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!isOpen) return;
    const before = document.activeElement as HTMLElement | null;
    const fallbackElement = fallback?.current;
    return () => {
      const target = before && before.isConnected ? before : fallbackElement;
      target?.focus();
    };
  }, [isOpen, fallback]);
}

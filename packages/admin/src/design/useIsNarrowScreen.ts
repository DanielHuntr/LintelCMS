import { useSyncExternalStore } from "react";

/** Phone widths: the admin's own breakpoint, below Tailwind's `md`. */
const NARROW_SCREEN = "(max-width: 767.98px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia?.(NARROW_SCREEN);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/** Whether the window is phone-sized now; follows rotating and resizing. */
export function useIsNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(NARROW_SCREEN).matches ?? false,
    () => false,
  );
}

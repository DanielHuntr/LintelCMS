/**
 * What the browser can do. Every check is safe to call during server rendering, where
 * there is no window: nothing here touches the DOM when the module loads.
 */

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function supportsWebAnimations(): boolean {
  return isBrowser() && typeof Element !== "undefined" && "animate" in Element.prototype;
}

export function supportsIntersectionObserver(): boolean {
  return isBrowser() && typeof IntersectionObserver === "function";
}

/** Scroll-driven animations: the browser runs scroll scenes itself, off the main thread. */
export function supportsScrollTimelines(): boolean {
  return isBrowser() && typeof ScrollTimeline === "function" && typeof ViewTimeline === "function";
}

export function supportsLinearEasing(): boolean {
  return (
    isBrowser() &&
    typeof CSS !== "undefined" &&
    CSS.supports("animation-timing-function", "linear(0, 1)")
  );
}

export type ReducedMotionPreference = "auto" | "reduce" | "no-preference";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

/** Whether to play the reduced version. "auto" asks the device. */
export function prefersReducedMotion(preference: ReducedMotionPreference): boolean {
  if (preference !== "auto") return preference === "reduce";
  return (
    isBrowser() &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(reducedMotionQuery).matches
  );
}

/** Calls `onChange` when the device's reduced-motion setting changes. Returns a stop function. */
export function watchReducedMotion(onChange: () => void): () => void {
  if (!isBrowser() || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

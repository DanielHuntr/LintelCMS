/** The builder is large, so it loads on its own. Both of these share the one download. */
export const loadPageDesignPage = () => import("./PageDesignPage.js");

/** Starts the download now: someone is pointing at the Design view. */
export function preloadDesigner(): void {
  void loadPageDesignPage().catch(() => undefined);
}

/**
 * Starts the download once the browser has nothing better to do, so switching to Design
 * doesn't wait for it. Returns a way to call it off.
 */
export function preloadDesignerWhenIdle(): () => void {
  if (typeof window.requestIdleCallback !== "function") return () => undefined;
  const handle = window.requestIdleCallback(preloadDesigner, { timeout: 5000 });
  return () => window.cancelIdleCallback(handle);
}

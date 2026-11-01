import type { ScrollMarker, ScrollTrigger } from "../spec/trigger.schema.js";

/**
 * The maths of a scroll scene. A marker says "when this part of the element reaches this
 * part of the screen", e.g. { element: 0, viewport: 1 } is "the element's top reaches the
 * bottom of the screen". The scene runs from the start marker to the end marker.
 */

export interface SceneMeasurements {
  /** The element's top edge, in pixels from the top of the screen. */
  elementTop: number;
  elementHeight: number;
  viewportHeight: number;
}

/** Where the element's top edge is when a marker is reached. */
function elementTopAt(marker: ScrollMarker, elementHeight: number, viewportHeight: number) {
  return marker.viewport * viewportHeight - marker.element * elementHeight;
}

/** How far through the scene the page is scrolled: 0 before it, 1 after it. */
export function sceneProgress(
  trigger: Pick<ScrollTrigger, "start" | "end">,
  { elementTop, elementHeight, viewportHeight }: SceneMeasurements,
): number {
  const startTop = elementTopAt(trigger.start, elementHeight, viewportHeight);
  const endTop = elementTopAt(trigger.end, elementHeight, viewportHeight);
  const distance = startTop - endTop;
  if (distance <= 0) return elementTop <= endTop ? 1 : 0;
  return Math.min(Math.max((startTop - elementTop) / distance, 0), 1);
}

/** How far the page scrolls during the scene, in pixels: used for the browser's own timeline. */
export function markerScrollOffset(
  marker: ScrollMarker,
  elementHeight: number,
  viewportHeight: number,
): number {
  // A view timeline's "cover" range starts when the element's top meets the bottom of the screen.
  return viewportHeight - elementTopAt(marker, elementHeight, viewportHeight);
}

/** Page progress: 0 at the top of the page, 1 at the bottom. */
export function pageProgress(scrollTop: number, scrollHeight: number, viewportHeight: number) {
  const scrollable = scrollHeight - viewportHeight;
  return scrollable <= 0 ? 1 : Math.min(Math.max(scrollTop / scrollable, 0), 1);
}

/**
 * Pinning: the scene element grows by `length` screen heights and its first child sticks to
 * the top while the page scrolls through it. Returns a function that undoes the styles.
 */
export function pinScene(root: HTMLElement, length: number): () => void {
  const pinned = root.firstElementChild;
  const previousRoot = root.style.cssText;
  root.style.position = "relative";
  root.style.height = `${(1 + length) * 100}vh`;
  if (!(pinned instanceof HTMLElement)) return () => (root.style.cssText = previousRoot);
  const previousPinned = pinned.style.cssText;
  pinned.style.position = "sticky";
  pinned.style.top = "0";
  pinned.style.height = "100vh";
  pinned.style.overflow = "hidden";
  return () => {
    root.style.cssText = previousRoot;
    pinned.style.cssText = previousPinned;
  };
}

/** A pinned scene runs from its top reaching the top of the screen to its bottom reaching the bottom. */
export const pinnedSceneMarkers = {
  start: { element: 0, viewport: 0 },
  end: { element: 1, viewport: 1 },
} as const satisfies Pick<ScrollTrigger, "start" | "end">;

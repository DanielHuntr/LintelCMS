/**
 * Zooming the canvas: how far in or out, and which keys do it. The page itself never
 * changes size (its screen width, and so its layout, stay the same); the frame it is drawn
 * in is scaled, so zooming out shows more of a long page and zooming in shows detail.
 */

export const minZoom = 0.25;
export const maxZoom = 2;

/** The steps the buttons and keys move between. */
export const zoomSteps: readonly number[] = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(maxZoom, Math.max(minZoom, Math.round(zoom * 100) / 100));
}

/** The next step in or out from `zoom`, which may sit between steps after a pinch. */
export function stepZoom(zoom: number, direction: "in" | "out"): number {
  if (direction === "in") return zoomSteps.find((step) => step > zoom + 0.001) ?? maxZoom;
  return [...zoomSteps].reverse().find((step) => step < zoom - 0.001) ?? minZoom;
}

/** Ctrl (or ⌘) with the wheel, or a trackpad pinch (which browsers send the same way). */
export function zoomFromWheel(zoom: number, deltaY: number): number {
  // Pinches send small deltas, wheels large ones; both feel even this way.
  return clampZoom(zoom * Math.exp(-Math.max(-60, Math.min(60, deltaY)) / 400));
}

export type ZoomKey = "in" | "out" | "actual" | "fit";

/** What a key press does to the zoom, if anything: Ctrl/⌘ with + − 0, and Shift+1 to fit. */
export function zoomKey(key: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): ZoomKey | null {
  const command = key.metaKey || key.ctrlKey;
  if (command && !key.altKey) {
    if (key.key === "=" || key.key === "+") return "in";
    if (key.key === "-" || key.key === "_") return "out";
    if (key.key === "0") return "actual";
  }
  if (!command && !key.altKey && key.shiftKey && (key.key === "!" || key.key === "1")) {
    return "fit";
  }
  return null;
}

/** The zoom that fits a frame `width` wide (and no more than actual size) into `room`. */
export function fitZoom(width: number, room: number): number {
  if (width <= 0 || room <= 0) return 1;
  return clampZoom(Math.min(1, room / width));
}

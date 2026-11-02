import { createContext, useContext } from "react";

/**
 * How the selected element really looks on the canvas, measured there: its alignment, text
 * size in pixels, weight and colour. The style panel shows these when nothing is set on the
 * element itself, so a heading the theme makes giant and centred doesn't read "Normal, Left".
 */
export interface CanvasLook {
  nodeId: string;
  textAlign: string;
  fontSize: number;
  fontWeight: string;
  color: string;
}

export const CanvasLookContext = createContext<CanvasLook | null>(null);

/** The selected element's measured look, when the canvas has reported it for this element. */
export function useCanvasLook(nodeId: string | undefined): CanvasLook | null {
  const look = useContext(CanvasLookContext);
  return look && look.nodeId === nodeId ? look : null;
}

/** The look of the element the style panel is showing (StylePanel passes on only its own). */
export function useSelectedLook(): CanvasLook | null {
  return useContext(CanvasLookContext);
}

/** "start" and "end" as the panel's choices name them. */
export function lookAlign(look: CanvasLook | null): string | undefined {
  if (!look) return undefined;
  if (look.textAlign === "start" || look.textAlign === "-webkit-auto") return "left";
  if (look.textAlign === "end") return "right";
  return look.textAlign;
}

/**
 * The size chip nearest the measured size, when one is within a fifth of it: the chip that
 * looks like what's on the page. `rem` chips are counted at 16px.
 */
export function nearestSizeChip(
  look: CanvasLook | null,
  chips: readonly (string | undefined)[],
  normalPixels = 16,
): string | undefined | null {
  if (!look) return null;
  let best: { value: string | undefined; distance: number } | null = null;
  for (const value of chips) {
    const pixels = value === undefined ? normalPixels : Number.parseFloat(value) * 16;
    const distance = Math.abs(pixels - look.fontSize) / look.fontSize;
    if (!best || distance < best.distance) best = { value, distance };
  }
  return best && best.distance <= 0.2 ? best.value : null;
}

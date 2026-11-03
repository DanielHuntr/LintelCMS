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
  /** How many columns it has as a grid; 0 when it isn't one. */
  gridColumns?: number;
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

/** A weight as a number: "bold" is 700, "normal" 400; null for one that can't be read here. */
function weightNumber(weight: string): number | null {
  if (weight === "bold") return 700;
  if (weight === "normal") return 400;
  const number = Number(weight);
  return Number.isFinite(number) && weight.trim() !== "" ? number : null;
}

/**
 * The weight chip that looks like this weight: the nearest within 100, the heavier one on a
 * tie, so a 600 button reads Bold rather than Custom. Null when none is near.
 */
export function nearestWeightChip(weight: string | undefined, chips: readonly string[]) {
  const wanted = weight === undefined ? null : weightNumber(weight);
  if (wanted === null) return null;
  let best: { chip: string; distance: number } | null = null;
  for (const chip of chips) {
    const distance = Math.abs(Number(chip) - wanted);
    if (distance <= 100 && (!best || distance <= best.distance)) best = { chip, distance };
  }
  return best?.chip ?? null;
}

/**
 * How many columns a grid's template has: "repeat(3, 1fr)" is 3 and "1fr 2fr" is 2. Zero for
 * one that can't be counted here ("repeat(auto-fill, ...)").
 */
export function countGridColumns(template: string | undefined): number {
  if (!template) return 0;
  const repeat = /^repeat\(\s*(\d+)\s*,/.exec(template.trim());
  if (repeat) return Number(repeat[1]);
  if (template.includes("repeat(")) return 0;
  let depth = 0;
  let tracks = 0;
  let inTrack = false;
  for (const character of template.replace(/\[[^\]]*\]/g, " ")) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    const isSpace = /\s/.test(character) && depth === 0;
    if (!isSpace && !inTrack) tracks += 1;
    inTrack = !isSpace;
  }
  return tracks;
}

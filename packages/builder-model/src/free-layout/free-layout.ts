import { z } from "zod";
import type { NodeStyles, PageNode, StyleDeclarations } from "../document/page-document.schema.js";

/**
 * Free layout: a section whose elements are placed anywhere in it, overlapping if wanted,
 * rather than one after another. Each element keeps its place as plain position styles
 * (`left: 12%; top: 8%; width: 40%`), per screen size like any other style, so a free
 * layout is ordinary CSS: the section is `position: relative` and its children
 * `position: absolute`.
 *
 * The order in Layers is still the order the page is read in, by screen readers and on
 * phones; where things sit on screen doesn't change it. Bring forward and send back change
 * `z-index` only.
 *
 * `stackOnPhone` puts the elements back one under another on phones, which is what most
 * free layouts want; switch it off to place things by hand at phone size too.
 */
export interface FreeLayout {
  stackOnPhone: boolean;
}

export const freeLayoutSchema = z.object({
  stackOnPhone: z.boolean({ error: "stackOnPhone should be true or false" }).default(true),
});

/** The containers that can have a free layout: the ones that draw their children directly. */
export const freeLayoutTypes: readonly string[] = ["section", "box", "container"];

export function canUseFreeLayout(node: PageNode): boolean {
  return freeLayoutTypes.includes(node.type);
}

/** The height a section starts with when it becomes free, so there is room to place things. */
export const freeLayoutStartHeight = "clamp(28rem, 60vw, 48rem)";

/**
 * The styles a free layout adds to its section and children, under their own: the section
 * is the frame things are placed in, the children are placed in it. Returned per target,
 * merged under the node's own styles by the stylesheet, so anything set by hand wins.
 */
export function impliedFreeLayoutStyles(
  node: PageNode,
  parent: PageNode | null,
): Partial<NodeStyles> {
  const implied: Partial<NodeStyles> = {};
  if (node.freeLayout) {
    implied.base = { position: "relative" };
    if (node.freeLayout.stackOnPhone) {
      implied.phone = {
        display: "flex",
        flexDirection: "column",
        gap: "var(--lintel-space-4)",
        minHeight: "auto",
      };
    }
  }
  if (parent?.freeLayout) {
    implied.base = { ...implied.base, position: "absolute" };
    if (parent.freeLayout.stackOnPhone) {
      implied.phone = {
        ...implied.phone,
        position: "relative",
        left: "auto",
        top: "auto",
        width: "auto",
      };
    }
  }
  return implied;
}

/** A child's place as percentages of its free section. */
export interface FreePlace {
  left: number;
  top: number;
  /** Left out to keep the width it has. */
  width?: number;
}

/** Styles for a place, rounded to a tenth of a percent so stored pages stay readable. */
export function freePlaceStyles(place: FreePlace): StyleDeclarations {
  const percent = (value: number) => `${Math.round(value * 10) / 10}%`;
  return {
    left: percent(place.left),
    top: percent(place.top),
    ...(place.width !== undefined ? { width: percent(place.width) } : {}),
  };
}

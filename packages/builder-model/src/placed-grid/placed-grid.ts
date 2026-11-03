import { z } from "zod";
import type { NodeStyles, PageNode, StyleDeclarations } from "../document/page-document.schema.js";

/**
 * A placed grid: a section (or box, or container) laid out on columns, the way magazines
 * are, with each element placed on them by hand. A photo can take columns 2 to 6 while its
 * caption sits in 8 to 11, a heading can run over the corner of a picture, and on phones
 * everything can go back to one under another.
 *
 * Places are ordinary styles on the elements (`grid-column: 2 / span 5; grid-row: 1 / span 2`),
 * per screen size like any other style, so a placed grid is plain CSS grid. What the setting
 * adds is the grid itself (equal columns and rows with a sensible minimum height), a full
 * width for elements that haven't been placed yet, and, with `stackOnPhone`, the stacking on
 * phones for elements that have no place of their own at phone size.
 *
 * As with free layouts, the order in Layers stays the reading order; overlapping elements
 * are stacked with z-index (see free-layout/z-order.ts).
 */
export interface PlacedGrid {
  /** How many equal columns: 12 is the usual magazine grid. */
  columns: number;
  stackOnPhone: boolean;
}

export const minPlacedGridColumns = 2;
export const maxPlacedGridColumns = 24;
export const placedGridColumnChoices = [4, 6, 8, 12] as const;

export const placedGridSchema = z.object({
  columns: z
    .number({ error: "A grid’s columns should be a number" })
    .int({ error: "A grid’s columns should be a whole number" })
    .min(minPlacedGridColumns, { error: `A grid needs at least ${minPlacedGridColumns} columns` })
    .max(maxPlacedGridColumns, { error: `A grid can have at most ${maxPlacedGridColumns} columns` })
    .default(12),
  stackOnPhone: z.boolean({ error: "stackOnPhone should be true or false" }).default(true),
});

/** The containers that can be a placed grid: the same ones that can have a free layout. */
export const placedGridTypes: readonly string[] = ["section", "box", "container"];

export function canUsePlacedGrid(node: PageNode): boolean {
  return placedGridTypes.includes(node.type);
}

/** The shortest a grid row is, so an empty row still has room to drop something into. */
export const placedGridRowHeight = "3rem";

/**
 * The styles a placed grid adds to its container and children, under their own (so a gap or
 * a column template set by hand wins).
 */
export function impliedPlacedGridStyles(
  node: PageNode,
  parent: PageNode | null,
): Partial<NodeStyles> {
  const implied: Partial<NodeStyles> = {};
  if (node.placedGrid) {
    implied.base = {
      display: "grid",
      gridTemplateColumns: `repeat(${node.placedGrid.columns}, minmax(0, 1fr))`,
      gridAutoRows: `minmax(${placedGridRowHeight}, auto)`,
      gap: "var(--lintel-space-5)",
    };
    if (node.placedGrid.stackOnPhone) implied.phone = { gridAutoRows: "auto" };
  }
  if (parent?.placedGrid) {
    // Not placed yet: the whole width, in reading order.
    implied.base = { ...implied.base, gridColumn: "1 / -1" };
    if (parent.placedGrid.stackOnPhone) {
      implied.phone = { ...implied.phone, gridColumn: "1 / -1", gridRow: "auto" };
    }
  }
  return implied;
}

/** Where an element sits on its grid: lines are counted from 1, spans are at least 1. */
export interface GridPlace {
  column: number;
  columnSpan: number;
  row: number;
  rowSpan: number;
}

/** The styles for a place: `grid-column: 2 / span 5; grid-row: 1 / span 2`. */
export function gridPlaceStyles(place: GridPlace): StyleDeclarations {
  const line = (start: number, span: number) =>
    span > 1 ? `${start} / span ${span}` : String(start);
  return {
    gridColumn: line(place.column, place.columnSpan),
    gridRow: line(place.row, place.rowSpan),
  };
}

/** One axis of a place, read back from a style: a start and a span, when it has a start. */
export interface GridLine {
  start: number;
  span: number;
}

/**
 * Reads `2`, `2 / span 5`, `2 / 7` or `span 3 / 6` back as a start and a span. Anything
 * else (named areas, negative lines, `auto`) gives undefined, and the style panel shows the
 * exact value instead.
 */
export function readGridLine(value: string | undefined): GridLine | undefined {
  if (!value) return undefined;
  const parts = value.split("/").map((part) => part.trim());
  if (parts.length > 2) return undefined;
  const [first = "", second] = parts;
  const number = (text: string) => (/^\d+$/.test(text) ? Number(text) : undefined);
  const span = (text: string) => {
    const match = /^span\s+(\d+)$/.exec(text);
    return match ? Number(match[1]) : undefined;
  };
  const start = number(first);
  if (start !== undefined && start > 0) {
    if (second === undefined) return { start, span: 1 };
    const spanned = span(second);
    if (spanned !== undefined && spanned > 0) return { start, span: spanned };
    const end = number(second);
    if (end !== undefined && end > start) return { start, span: end - start };
    return undefined;
  }
  const leading = span(first);
  const end = second === undefined ? undefined : number(second);
  if (leading !== undefined && end !== undefined && end - leading >= 1) {
    return { start: end - leading, span: leading };
  }
  return undefined;
}

/** A place clamped onto a grid of `columns`, so it never spills off the right-hand side. */
export function clampGridPlace(place: GridPlace, columns: number): GridPlace {
  const columnSpan = Math.max(1, Math.min(columns, Math.round(place.columnSpan)));
  const column = Math.max(1, Math.min(columns - columnSpan + 1, Math.round(place.column)));
  return {
    column,
    columnSpan,
    row: Math.max(1, Math.round(place.row)),
    rowSpan: Math.max(1, Math.round(place.rowSpan)),
  };
}

/** The last column or row a line reaches: columns 2 to 6 for `2 / span 5`. */
export function lastOf(line: GridLine): number {
  return line.start + line.span - 1;
}

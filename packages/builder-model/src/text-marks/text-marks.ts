import { z } from "zod";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { isSafeValueFor } from "../styles/style-values.js";

/**
 * Styles on part of a heading's or paragraph's text: an italic word in an upright headline,
 * one outlined letter, a highlighted phrase. Stored next to the text as ranges of character
 * positions (`from` included, `to` not), never overlapping, in order:
 *
 *   text:  "FREEDOM FOR YOUR SOUL"
 *   marks: [{ "from": 2, "to": 4, "styles": { "fontStyle": "italic", "fontWeight": "300" } }]
 *
 * and drawn as `FR<em class="hero-title-mark-1">EE</em>DOM...`: italic parts are `<em>`,
 * the rest `<span>`, and anything more than italic goes in a class in the page's stylesheet.
 * When the text is edited, the marks move with the words around them (`rebaseMarks`).
 */

/** What a mark can change: the look of letters, never their layout. */
export const markStyleProperties = [
  "fontStyle",
  "fontWeight",
  "fontFamily",
  "fontSize",
  "color",
  "textStroke",
  "backgroundColor",
  "textDecoration",
  "letterSpacing",
  "textTransform",
] as const;

export type MarkStyleProperty = (typeof markStyleProperties)[number];
export type MarkStyles = Partial<Record<MarkStyleProperty, string>>;

export interface TextMark {
  from: number;
  to: number;
  styles: MarkStyles;
}

const markStylesSchema = z
  .record(z.string(), z.string())
  .superRefine((styles, context) => {
    for (const [name, value] of Object.entries(styles)) {
      const known = (markStyleProperties as readonly string[]).includes(name);
      if (!known || !isSafeValueFor(name as MarkStyleProperty, value)) {
        context.addIssue({
          code: "custom",
          message: `“${name}: ${value}” can’t style part of text`,
        });
      }
    }
  })
  .transform((styles) => styles as MarkStyles);

export const textMarkSchema = z
  .object({
    from: z.number().int().min(0),
    to: z.number().int().min(1),
    styles: markStylesSchema,
  })
  .refine((mark) => mark.to > mark.from, { error: "A styled part of text can’t be empty" });

export const textMarksSchema = z
  .array(textMarkSchema, { error: "Styled parts of text should be a list" })
  .max(200, { error: "Text can have at most 200 styled parts" })
  .optional();

/** For a text component's schema: the marks must sit inside the text and not overlap. */
export function marksFitText(props: { text: string; marks?: readonly TextMark[] }): boolean {
  let end = 0;
  for (const mark of props.marks ?? []) {
    if (mark.from < end || mark.to > props.text.length) return false;
    end = mark.to;
  }
  return true;
}

/** Sorted, inside the text, without empty or style-less marks, neighbours with equal styles joined. */
export function normaliseMarks(marks: readonly TextMark[], textLength: number): TextMark[] {
  const tidy = marks
    .map((mark) => ({
      from: Math.max(0, Math.min(mark.from, textLength)),
      to: Math.max(0, Math.min(mark.to, textLength)),
      styles: withoutEmpty(mark.styles),
    }))
    .filter((mark) => mark.to > mark.from && Object.keys(mark.styles).length > 0)
    .sort((first, second) => first.from - second.from);
  const joined: TextMark[] = [];
  for (const mark of tidy) {
    const previous = joined.at(-1);
    if (previous && previous.to === mark.from && sameStyles(previous.styles, mark.styles)) {
      previous.to = mark.to;
    } else if (!previous || mark.from >= previous.to) {
      joined.push({ ...mark });
    }
  }
  return joined;
}

/**
 * Applies styles to `from`–`to`, on top of whatever marks are already there. A style set to
 * undefined is taken off that range, so applying `{ fontStyle: undefined }` un-italicises.
 */
export function applyMark(
  marks: readonly TextMark[],
  from: number,
  to: number,
  styles: Partial<Record<MarkStyleProperty, string | undefined>>,
  textLength: number,
): TextMark[] {
  if (to <= from) return normaliseMarks(marks, textLength);
  const cuts = new Set([0, from, to, textLength]);
  for (const mark of marks) {
    cuts.add(mark.from);
    cuts.add(mark.to);
  }
  const points = [...cuts].filter((point) => point <= textLength).sort((a, b) => a - b);
  const pieces: TextMark[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] as number;
    const end = points[index + 1] as number;
    const existing = marks.find((mark) => mark.from <= start && mark.to >= end)?.styles ?? {};
    const inside = start >= from && end <= to;
    pieces.push({ from: start, to: end, styles: inside ? merge(existing, styles) : existing });
  }
  return normaliseMarks(pieces, textLength);
}

/** Takes every mark off `from`–`to`. */
export function clearMarks(
  marks: readonly TextMark[],
  from: number,
  to: number,
  textLength: number,
): TextMark[] {
  const cleared = Object.fromEntries(markStyleProperties.map((name) => [name, undefined]));
  return applyMark(marks, from, to, cleared, textLength);
}

/** The styles every letter of `from`–`to` shares, for showing which buttons are on. */
export function sharedMarkStyles(marks: readonly TextMark[], from: number, to: number): MarkStyles {
  if (to <= from) return {};
  const covering = marks.filter((mark) => mark.from < to && mark.to > from);
  let covered = from;
  for (const mark of covering) {
    if (mark.from > covered) return {};
    covered = Math.max(covered, mark.to);
  }
  if (covered < to || covering.length === 0) return {};
  const [first, ...rest] = covering;
  const shared: MarkStyles = { ...first?.styles };
  for (const mark of rest) {
    for (const name of Object.keys(shared) as MarkStyleProperty[]) {
      if (mark.styles[name] !== shared[name]) delete shared[name];
    }
  }
  return shared;
}

/**
 * Moves marks after the text changed, so they stay on the same words. Whatever was typed
 * at the very end of a mark joins it, as it does in word processors.
 */
export function rebaseMarks(
  oldText: string,
  newText: string,
  marks: readonly TextMark[],
): TextMark[] {
  if (oldText === newText || marks.length === 0) return normaliseMarks(marks, newText.length);
  let prefix = 0;
  while (
    prefix < oldText.length &&
    prefix < newText.length &&
    oldText[prefix] === newText[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < oldText.length - prefix &&
    suffix < newText.length - prefix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const oldChangeEnd = oldText.length - suffix;
  const delta = newText.length - oldText.length;
  const move = (position: number, isEnd: boolean) => {
    if (position < prefix || (position === prefix && !isEnd)) return position;
    if (position >= oldChangeEnd) return position + delta;
    return isEnd ? newText.length - suffix : prefix;
  };
  return normaliseMarks(
    marks.map((mark) => ({ ...mark, from: move(mark.from, false), to: move(mark.to, true) })),
    newText.length,
  );
}

export interface MarkedSegment {
  text: string;
  /** The mark's position in the list, or null for plain text. */
  markIndex: number | null;
}

/** The text cut into plain and marked runs, in order. Marks that don't fit are left out. */
export function markedSegments(text: string, marks: readonly TextMark[]): MarkedSegment[] {
  const segments: MarkedSegment[] = [];
  let position = 0;
  marks.forEach((mark, index) => {
    if (mark.from < position || mark.to > text.length || mark.to <= mark.from) return;
    if (mark.from > position) {
      segments.push({ text: text.slice(position, mark.from), markIndex: null });
    }
    segments.push({ text: text.slice(mark.from, mark.to), markIndex: index });
    position = mark.to;
  });
  if (position < text.length) segments.push({ text: text.slice(position), markIndex: null });
  return segments;
}

/** How one mark is drawn: `em` when italic, and the class its other styles need, if any. */
export interface MarkDrawing {
  tag: "em" | "span";
  /** A number for the class (`-mark-1`), shared by marks with the same styles; null for none. */
  classNumber: number | null;
  /** The declarations the class carries. */
  declarations: StyleDeclarations;
}

export function planMarkDrawings(marks: readonly TextMark[]): MarkDrawing[] {
  const numbers = new Map<string, number>();
  return marks.map((mark) => {
    const italic = mark.styles.fontStyle === "italic";
    const declarations: StyleDeclarations = { ...mark.styles };
    if (italic) delete declarations.fontStyle;
    const key = JSON.stringify(Object.entries(declarations).sort());
    let classNumber: number | null = null;
    if (Object.keys(declarations).length > 0) {
      classNumber = numbers.get(key) ?? numbers.size + 1;
      numbers.set(key, classNumber);
    }
    return { tag: italic ? "em" : "span", classNumber, declarations };
  });
}

function merge(
  existing: MarkStyles,
  changes: Partial<Record<MarkStyleProperty, string | undefined>>,
): MarkStyles {
  const merged: Partial<Record<MarkStyleProperty, string | undefined>> = {
    ...existing,
    ...changes,
  };
  return withoutEmpty(merged);
}

function withoutEmpty(styles: Partial<Record<MarkStyleProperty, string | undefined>>): MarkStyles {
  return Object.fromEntries(
    Object.entries(styles).filter(([, value]) => value !== undefined && value !== ""),
  ) as MarkStyles;
}

function sameStyles(first: MarkStyles, second: MarkStyles): boolean {
  const firstKeys = Object.keys(first) as MarkStyleProperty[];
  return (
    firstKeys.length === Object.keys(second).length &&
    firstKeys.every((name) => first[name] === second[name])
  );
}

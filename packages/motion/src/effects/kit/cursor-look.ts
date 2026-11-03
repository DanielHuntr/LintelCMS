import { safePictureAddress } from "./addresses.js";
import type { CursorPicture, CursorSettings, CursorWordLook } from "../effect-types.js";

/**
 * How the cursor's word and the cursor's own picture look, worked out without the DOM so
 * the server (for the page's CSS), the cursor module and the builder's preview all agree.
 *
 * The word's look travels as CSS custom properties: the site's choice on `:root`, and an
 * element's own choice on the word itself while it is shown. Anything left as it was
 * writes nothing, so settings saved before the word had a look render exactly as before.
 */

/** The theme's colours, with what the page uses before the theme loads and letters that read on each. */
const themeColours: Record<string, { fallback: string; letters: string }> = {
  "lintel-color-text": { fallback: "#111111", letters: "lintel-color-background" },
  "lintel-color-text-secondary": { fallback: "#6e6e73", letters: "lintel-color-background" },
  "lintel-color-background": { fallback: "#ffffff", letters: "lintel-color-text" },
  "lintel-color-surface": { fallback: "#f5f5f7", letters: "lintel-color-text" },
  "lintel-color-border": { fallback: "#d2d2d7", letters: "lintel-color-text" },
  "lintel-color-brand": { fallback: "#111111", letters: "lintel-color-on-brand" },
  "lintel-color-on-brand": { fallback: "#ffffff", letters: "lintel-color-brand" },
  "lintel-color-accent": { fallback: "#0a6fd6", letters: "lintel-color-background" },
};

/** A colour the word may use besides "auto": a hex colour or a site or theme colour variable. */
export const cursorWordColourPattern = /^(#[0-9a-f]{6}|var\(--[a-z0-9-]{1,60}\))$/i;

export const defaultCursorWordLook: CursorWordLook = {
  background: "auto",
  colour: "auto",
  size: "medium",
  shape: "pill",
};

export const defaultCursorPicture: CursorPicture = {
  assetId: "",
  src: "",
  size: 32,
  point: "centre",
  bytes: 0,
};

/** Whether the site has a custom cursor: a style, and for "Your own picture" a picture. */
export function cursorIsOn(cursor: Pick<CursorSettings, "style" | "picture"> | undefined): boolean {
  if (!cursor || cursor.style === "none") return false;
  return cursor.style !== "picture" || safePictureAddress(cursor.picture?.src ?? "") !== "";
}

/** Above this a cursor picture is worth making smaller: it shows late on a slow connection. */
export const largeCursorPictureBytes = 64 * 1024;

function variableName(choice: string): string | undefined {
  return /^var\(--([a-z0-9-]{1,60})\)$/i.exec(choice)?.[1];
}

/** A word colour as CSS, or undefined for "auto", nothing chosen or anything unreadable. */
export function cursorColourCss(choice: string | undefined): string | undefined {
  if (!choice || !cursorWordColourPattern.test(choice)) return undefined;
  const name = variableName(choice);
  const theme = name ? themeColours[name] : undefined;
  return name && theme ? `var(--${name}, ${theme.fallback})` : choice;
}

/** Black or white, whichever reads on a hex colour. */
export function lettersOnHex(hex: string): string {
  const digits = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!digits) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16));
  return (red ?? 0) * 0.299 + (green ?? 0) * 0.587 + (blue ?? 0) * 0.114 > 160
    ? "#111111"
    : "#ffffff";
}

/**
 * Letters that read on a word colour: the theme's partner colour, or black or white on a hex
 * colour. Undefined for "auto" and for the site's own colour variables, whose letters the
 * cursor works out on the page, where the colour is known.
 */
function lettersOn(choice: string): string | undefined {
  const name = variableName(choice);
  if (name) {
    const partner = themeColours[name]?.letters;
    return partner ? cursorColourCss(`var(--${partner})`) : undefined;
  }
  return /^#[0-9a-f]{6}$/i.test(choice) ? lettersOnHex(choice) : undefined;
}

const wordSizes: Record<CursorWordLook["size"], string> = {
  small: "0.7rem",
  medium: "0.8rem",
  large: "1rem",
};

const wordShapes: Record<CursorWordLook["shape"], { radius: string; ratio: string }> = {
  pill: { radius: "999px", ratio: "auto" },
  square: { radius: "var(--lintel-radius-small, 6px)", ratio: "auto" },
  circle: { radius: "50%", ratio: "1" },
};

/**
 * The custom properties for a look. Parts left out (or "auto") write nothing, so they come
 * from the site's choice, or from the cursor's own colour when nothing is chosen at all.
 */
export function cursorWordVariables(look: Partial<CursorWordLook>): Record<string, string> {
  const variables: Record<string, string> = {};
  const background = cursorColourCss(look.background);
  if (background) variables["--lintel-cursor-word-background"] = background;
  const letters =
    cursorColourCss(look.colour) ?? (background ? lettersOn(look.background ?? "") : undefined);
  if (letters) variables["--lintel-cursor-word-colour"] = letters;
  const size = look.size ? wordSizes[look.size] : undefined;
  if (size) variables["--lintel-cursor-word-size"] = size;
  const shape = look.shape ? wordShapes[look.shape] : undefined;
  if (shape) {
    variables["--lintel-cursor-word-radius"] = shape.radius;
    variables["--lintel-cursor-word-ratio"] = shape.ratio;
  }
  return variables;
}

/** The site's word look as page CSS, or empty when it is the standard one. */
export function cursorWordCss(look: CursorWordLook | undefined): string {
  if (!look) return "";
  const changed: Partial<CursorWordLook> = {};
  for (const key of Object.keys(defaultCursorWordLook) as Array<keyof CursorWordLook>) {
    if (look[key] !== defaultCursorWordLook[key]) Object.assign(changed, { [key]: look[key] });
  }
  const variables = Object.entries(cursorWordVariables(changed));
  if (variables.length === 0) return "";
  return `:root{${variables.map(([name, value]) => `${name}:${value}`).join(";")}}`;
}

/**
 * The address the page loads for a cursor picture: a media library file is asked for at
 * the size it's shown (`scale` times, for sharp screens) as a PNG, so a large upload never
 * reaches the visitor; any other safe address is used as it is.
 */
export function cursorPictureAddress(src: string, size: number, scale = 2): string {
  const safe = safePictureAddress(src);
  if (!safe) return "";
  const [path = "", query = ""] = safe.split("?", 2);
  if (!/\/media\/[^/?#]+\/file$/.test(path)) return safe;
  const parameters = new URLSearchParams(query);
  parameters.set("w", String(Math.round(size * scale)));
  parameters.set("format", "png");
  return `${path}?${parameters}`;
}

export { safePictureAddress };

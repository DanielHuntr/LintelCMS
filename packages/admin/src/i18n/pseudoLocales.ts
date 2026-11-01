/**
 * Pseudo-languages: English, disguised, for checking the admin is ready to be translated
 * before anyone translates it.
 *
 * - **Accented English** (en-XA) swaps letters for accented ones, makes every string about
 *   a third longer and brackets it: "[Šîĝñ îñ ţö Ļîñţéļ ·····]". Text that stays plain was
 *   hard-coded instead of going through t(); a missing bracket means it was cut off or
 *   glued together from pieces.
 * - **Right-to-left English** (ar-XB) shows the words mirrored, in a right-to-left page, as
 *   Arabic or Hebrew would be. Anything still laid out left-to-right needs logical CSS
 *   (`ms-*` rather than `ml-*`, `text-start` rather than `text-left`).
 *
 * Only the message's own words change; names, numbers and other values put into it don't.
 */

const accented: Readonly<Record<string, string>> = {
  a: "à",
  b: "ƀ",
  c: "ç",
  d: "ð",
  e: "é",
  f: "ƒ",
  g: "ĝ",
  h: "ĥ",
  i: "î",
  j: "ĵ",
  k: "ķ",
  l: "ļ",
  m: "ɱ",
  n: "ñ",
  o: "ö",
  p: "þ",
  r: "ŕ",
  s: "š",
  t: "ţ",
  u: "û",
  w: "ŵ",
  y: "ý",
  z: "ž",
  A: "À",
  C: "Ç",
  D: "Ð",
  E: "É",
  G: "Ĝ",
  H: "Ĥ",
  I: "Î",
  L: "Ļ",
  N: "Ñ",
  O: "Ö",
  S: "Š",
  T: "Ţ",
  U: "Û",
  Y: "Ý",
  Z: "Ž",
};

/** Accents every letter and pads the text by about a third, as German or Finnish might. */
export function accentText(text: string): string {
  const swapped = [...text].map((character) => accented[character] ?? character).join("");
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  return letters === 0 ? swapped : `${swapped}${"·".repeat(Math.ceil(letters * 0.3))}`;
}

/** The brackets go round the whole message, not each piece of it. */
export function bracketMessage(message: string): string {
  return `[${message}]`;
}

const RIGHT_TO_LEFT_OVERRIDE = "‮";
const POP_DIRECTIONAL_FORMATTING = "‬";

/** Shows the words mirrored, the way Unicode's right-to-left override draws them. */
export function mirrorText(text: string): string {
  return text.trim() === ""
    ? text
    : `${RIGHT_TO_LEFT_OVERRIDE}${text}${POP_DIRECTIONAL_FORMATTING}`;
}

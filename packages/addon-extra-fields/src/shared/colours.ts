/**
 * Colours as "#rrggbb", and which of black or white text reads on them. Plain functions
 * with no imports, shared by the server half and the admin half.
 */

export const HEX_COLOUR = /^#[0-9a-f]{6}$/;

/** "#ABC" or "abc123" → "#aabbcc" / "#abc123"; null for anything that isn't a colour. */
export function normaliseHex(text: string): string | null {
  let hex = text.trim().toLowerCase();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    hex = `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}`;
  }
  return HEX_COLOUR.test(hex) ? hex : null;
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as Rgb;
}

/** Relative luminance, 0 (black) to 1 (white), as WCAG works it out. */
export function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const [red, green, blue] = toRgb(hex);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** WCAG's contrast ratio between two colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (one, other) => other - one,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Black or white, whichever has more contrast on the colour. */
export function readableTextColour(hex: string): "#000000" | "#ffffff" {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#ffffff") ? "#000000" : "#ffffff";
}

/** "Forest green" → "forest-green", for CSS variable names. Empty names become "colour". */
export function slugForColour(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "colour";
}

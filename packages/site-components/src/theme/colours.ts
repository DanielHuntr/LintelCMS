/**
 * Colour maths for themes, so whatever brand colour someone picks, text on it and links in
 * it stay readable. Contrast follows WCAG 2: 4.5 to 1 for text.
 */

export const MINIMUM_TEXT_CONTRAST = 4.5;

interface Rgb {
  red: number;
  green: number;
  blue: number;
}

const hexColourPattern = /^#([0-9a-f]{6})$/i;

export function isHexColour(value: string): boolean {
  return hexColourPattern.test(value);
}

function parseHex(hex: string): Rgb {
  const match = hexColourPattern.exec(hex);
  if (!match?.[1]) {
    throw new Error(`“${hex}” isn't a colour like #3366ff.`);
  }
  const value = Number.parseInt(match[1], 16);
  return { red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255 };
}

function toHex({ red, green, blue }: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function relativeLuminance(hex: string): number {
  const { red, green, blue } = parseHex(hex);
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** Mixes `amount` (0 to 1) of `other` into `colour`. */
export function mixColours(colour: string, other: string, amount: number): string {
  const from = parseHex(colour);
  const to = parseHex(other);
  const mix = (a: number, b: number) => a + (b - a) * amount;
  return toHex({
    red: mix(from.red, to.red),
    green: mix(from.green, to.green),
    blue: mix(from.blue, to.blue),
  });
}

/** White or near-black, whichever reads better on the colour (for button text). */
export function textColourOn(background: string): string {
  const light = "#ffffff";
  const dark = "#111113";
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
}

/**
 * The colour itself when it already reads well on the background, otherwise the nearest
 * shade (towards black on light backgrounds, white on dark ones) that does.
 */
export function readableOn(colour: string, background: string): string {
  if (contrastRatio(colour, background) >= MINIMUM_TEXT_CONTRAST) {
    return colour;
  }
  const towards = relativeLuminance(background) > 0.5 ? "#000000" : "#ffffff";
  for (let step = 1; step <= 20; step += 1) {
    const shade = mixColours(colour, towards, step / 20);
    if (contrastRatio(shade, background) >= MINIMUM_TEXT_CONTRAST) {
      return shade;
    }
  }
  return towards;
}

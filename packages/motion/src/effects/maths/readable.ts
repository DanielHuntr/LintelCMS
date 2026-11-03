/**
 * Keeping words readable over a moving background. The background's colours are known (the
 * effect's own), and so are the colours of the words on it, so the page can work out how
 * much of a quiet veil (a scrim) to lay over the background for the words to stay at the
 * contrast the accessibility guidelines ask for. Light words get a dark veil; dark words a
 * light one. No words, or enough contrast already, means no veil at all.
 */

export type Rgb = readonly [number, number, number];

/** Contrast the guidelines ask for between body text and what's behind it. */
export const readableContrast = 4.5;

/** The strongest veil the page will lay down: past this the background is lost. */
export const strongestScrim = 0.85;

function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** How bright a colour looks (0 black, 1 white), with each channel from 0 to 1. */
export function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** From 1 (no contrast) to 21 (black on white). */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const one = luminance(first);
  const two = luminance(second);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

export const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

export interface Scrim {
  colour: Rgb;
  /** From 0 (none) to `strongestScrim`. */
  amount: number;
}

/**
 * The lightest veil that keeps every word readable on every colour of the background. Words
 * of the same lightness as the first one are checked together; a stray word of the other
 * kind (white on a dark button inside a light section) is left to its own background.
 */
export function scrimFor(
  background: readonly Rgb[],
  words: readonly Rgb[],
  target = readableContrast,
): Scrim {
  const first = words[0];
  if (!first || background.length === 0) return { colour: [0, 0, 0], amount: 0 };
  const lightWords = luminance(first) > 0.4;
  const checked = words.filter((word) => luminance(word) > 0.4 === lightWords);
  const colour: Rgb = lightWords ? [0, 0, 0] : [1, 1, 1];
  const reads = (amount: number) =>
    background.every((shade) =>
      checked.every((word) => contrastRatio(mixRgb(shade, colour, amount), word) >= target),
    );
  for (let amount = 0; amount < strongestScrim; amount += 0.05) {
    if (reads(amount)) return { colour, amount: Math.round(amount * 100) / 100 };
  }
  return { colour, amount: strongestScrim };
}

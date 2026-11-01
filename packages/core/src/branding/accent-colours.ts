/**
 * Turns one accent colour into the shades the admin needs, so an agency picks a single
 * colour and every button, link and focus ring stays readable in light and dark mode.
 *
 * Shared with the admin (as `@lintel/core/accent-colours`), so the live preview on the
 * Branding screen and the colours the server hands out are always the same.
 */

export const LINTEL_ACCENT_COLOUR = "#7539fd";

/** WCAG AA for normal-sized text. */
export const MINIMUM_TEXT_CONTRAST = 4.5;

/** The page backgrounds accent text sits on; the darkest or lightest of each scheme. */
const LIGHT_BACKGROUND = "#f5f5f7";
const DARK_RAISED_SURFACE = "#2c2c2e";
const WHITE = "#ffffff";
const NEAR_BLACK = "#1d1d1f";

export interface AccentShades {
  /** Behind text on filled buttons and toggles: the colour as chosen. */
  fill: string;
  /** Filled buttons on hover: a step further from the text on them. */
  fillHover: string;
  /** The text on `fill`: white or near-black, whichever is easier to read. */
  onFill: string;
  /** Links and tinted buttons in light mode, deepened until they pass AA. */
  text: string;
  /** Links and tinted buttons in dark mode, lightened until they pass AA. */
  textDark: string;
  /** How readable `onFill` is on `fill`, such as 5.6 for 5.6:1. */
  fillContrast: number;
  /** False when even the better of white and black text is hard to read on the colour. */
  fillIsReadable: boolean;
}

/** Lintel violet's shades are hand-tuned (see the admin's styles.css), so they are kept. */
const lintelShades: AccentShades = {
  fill: LINTEL_ACCENT_COLOUR,
  fillHover: "#6a2cf0",
  onFill: WHITE,
  text: "#6a2cf0",
  textDark: "#a68aff",
  fillContrast: 5.6,
  fillIsReadable: true,
};

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

export function isHexColour(value: string): boolean {
  return HEX_COLOUR.test(value);
}

/** "#7539FD" or "7539fd" or "#73f" becomes "#7539fd"; anything else gives null. */
export function normaliseHexColour(value: string): string | null {
  const trimmed = value.trim().replace(/^#?/, "#").toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const [, red = "", green = "", blue = ""] = trimmed;
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }
  return isHexColour(trimmed) ? trimmed : null;
}

export function accentShades(colour: string): AccentShades {
  const fill = normaliseHexColour(colour) ?? LINTEL_ACCENT_COLOUR;
  if (fill === LINTEL_ACCENT_COLOUR) {
    return lintelShades;
  }

  const whiteContrast = contrastRatio(fill, WHITE);
  const blackContrast = contrastRatio(fill, NEAR_BLACK);
  const onFill = whiteContrast >= blackContrast ? WHITE : NEAR_BLACK;
  const fillContrast = Math.max(whiteContrast, blackContrast);

  return {
    fill,
    // Moving away from the text colour keeps hover at least as readable as the resting state.
    fillHover: mixColours(fill, onFill === WHITE ? "#000000" : WHITE, 0.12),
    onFill,
    text: shadeUntilReadable(fill, "#000000", LIGHT_BACKGROUND),
    textDark: shadeUntilReadable(fill, WHITE, DARK_RAISED_SURFACE),
    fillContrast: Math.round(fillContrast * 10) / 10,
    fillIsReadable: fillContrast >= MINIMUM_TEXT_CONTRAST,
  };
}

/** The WCAG contrast ratio between two colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mixes in `towards` a little at a time until the colour passes AA on `background`. */
function shadeUntilReadable(colour: string, towards: string, background: string): string {
  for (let amount = 0; amount <= 1; amount += 0.04) {
    const candidate = mixColours(colour, towards, amount);
    if (contrastRatio(candidate, background) >= MINIMUM_TEXT_CONTRAST) {
      return candidate;
    }
  }
  return towards;
}

function mixColours(colour: string, other: string, amount: number): string {
  const from = channels(colour);
  const to = channels(other);
  const mixed = from.map((channel, index) =>
    Math.round(channel + ((to[index] ?? channel) - channel) * amount),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function channels(colour: string): [number, number, number] {
  const hex = normaliseHexColour(colour) ?? "#000000";
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function relativeLuminance(colour: string): number {
  const [red, green, blue] = channels(colour).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

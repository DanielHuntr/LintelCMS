import { isHexColour } from "./colours.js";
import { type FontPairingId, fontPairingIds } from "./font-pairings.js";

/**
 * A site's look, as a handful of choices. `themeStylesheet` turns them into CSS custom
 * properties (design tokens); every component's styles use only those properties, so a
 * theme never needs a component to change.
 */
export interface SiteTheme {
  /** The main colour: buttons, links and highlights. A hex colour like #7539fd. */
  brandColour: string;
  /** A second colour for small touches: dates, labels, the hero's tint. */
  accentColour: string;
  fontPairing: FontPairingId;
  /** How rounded corners are: buttons, pictures and cards. */
  cornerStyle: CornerStyle;
  /** How much room there is between and around things. */
  spacing: SpacingScale;
  /** Light, dark, or following each visitor's device. */
  colourScheme: ColourScheme;
}

export const cornerStyles = ["square", "soft", "round"] as const;
export type CornerStyle = (typeof cornerStyles)[number];

export const spacingScales = ["compact", "comfortable", "airy"] as const;
export type SpacingScale = (typeof spacingScales)[number];

export const colourSchemes = ["light", "dark", "auto"] as const;
export type ColourScheme = (typeof colourSchemes)[number];

export const defaultTheme: SiteTheme = {
  brandColour: "#7539fd",
  accentColour: "#0a84ff",
  fontPairing: "system",
  cornerStyle: "soft",
  spacing: "comfortable",
  colourScheme: "auto",
};

/**
 * Fills in anything missing or unusable from `fallback`, so a half-saved or hand-edited
 * theme still gives a working site.
 */
export function completeTheme(
  theme: Partial<Record<keyof SiteTheme, unknown>>,
  fallback: SiteTheme = defaultTheme,
): SiteTheme {
  return {
    brandColour: pickColour(theme.brandColour, fallback.brandColour),
    accentColour: pickColour(theme.accentColour, fallback.accentColour),
    fontPairing: pickOne(theme.fontPairing, fontPairingIds, fallback.fontPairing),
    cornerStyle: pickOne(theme.cornerStyle, cornerStyles, fallback.cornerStyle),
    spacing: pickOne(theme.spacing, spacingScales, fallback.spacing),
    colourScheme: pickOne(theme.colourScheme, colourSchemes, fallback.colourScheme),
  };
}

function pickColour(value: unknown, fallback: string): string {
  return typeof value === "string" && isHexColour(value) ? value.toLowerCase() : fallback;
}

function pickOne<Choice extends string>(
  value: unknown,
  choices: readonly Choice[],
  fallback: Choice,
): Choice {
  return choices.find((choice) => choice === value) ?? fallback;
}

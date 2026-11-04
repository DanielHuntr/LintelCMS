import { readableOn, textColourOn } from "./colours.js";
import { findFontPairing } from "./font-pairings.js";
import type { CornerStyle, SiteTheme, SpacingScale } from "./theme.js";

/**
 * A theme as CSS custom properties on `:root`. These are the site's design tokens: every
 * component's styles read them (`color: var(--lintel-color-text)`) and nothing else, so
 * changing a token changes every component that uses it. The page builder and anyone
 * editing the CSS by hand use the same names.
 */

interface Palette {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

const lightPalette: Palette = {
  background: "#ffffff",
  surface: "#f5f5f7",
  text: "#1d1d1f",
  textSecondary: "#646469",
  border: "#d2d2d7",
};

const darkPalette: Palette = {
  background: "#000000",
  surface: "#1c1c1e",
  text: "#f5f5f7",
  textSecondary: "#a1a1a6",
  border: "#38383a",
};

const spacingFactors: Record<SpacingScale, number> = {
  compact: 0.8,
  comfortable: 1,
  airy: 1.25,
};

/** The steps of the spacing scale, in rem at "comfortable". */
const spacingSteps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4.5, 6];

const cornerRadii: Record<
  CornerStyle,
  { small: string; medium: string; large: string; button: string }
> = {
  square: { small: "0", medium: "0", large: "0", button: "0" },
  soft: { small: "6px", medium: "12px", large: "18px", button: "10px" },
  round: { small: "10px", medium: "18px", large: "28px", button: "999px" },
};

function colourTokens(theme: SiteTheme, palette: Palette): string[] {
  return [
    `--lintel-color-background: ${palette.background};`,
    `--lintel-color-surface: ${palette.surface};`,
    `--lintel-color-text: ${palette.text};`,
    `--lintel-color-text-secondary: ${palette.textSecondary};`,
    `--lintel-color-border: ${palette.border};`,
    `--lintel-color-brand: ${theme.brandColour};`,
    `--lintel-color-on-brand: ${textColourOn(theme.brandColour)};`,
    // Small labels and numbers: the brand, or the nearest tone that reads on page and panel.
    `--lintel-color-brand-text: ${readableOn(theme.brandColour, palette.surface)};`,
    `--lintel-color-link: ${readableOn(theme.brandColour, palette.background)};`,
    `--lintel-color-accent: ${readableOn(theme.accentColour, palette.background)};`,
  ];
}

function sharedTokens(theme: SiteTheme): string[] {
  const fonts = findFontPairing(theme.fontPairing);
  const factor = spacingFactors[theme.spacing];
  const radii = cornerRadii[theme.cornerStyle];
  return [
    `--lintel-font-heading: ${fonts.headingFont};`,
    `--lintel-font-body: ${fonts.bodyFont};`,
    ...spacingSteps.map(
      (step, index) => `--lintel-space-${index + 1}: ${roundRem(step * factor)}rem;`,
    ),
    `--lintel-radius-small: ${radii.small};`,
    `--lintel-radius-medium: ${radii.medium};`,
    `--lintel-radius-large: ${radii.large};`,
    `--lintel-radius-button: ${radii.button};`,
  ];
}

function roundRem(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function rule(selector: string, declarations: readonly string[], indent = ""): string {
  const body = declarations.map((declaration) => `${indent}  ${declaration}`).join("\n");
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/** The theme's tokens as a small stylesheet, to go before the components' styles. */
export function themeStylesheet(theme: SiteTheme): string {
  const light = colourTokens(theme, lightPalette);
  const dark = colourTokens(theme, darkPalette);
  const shared = sharedTokens(theme);

  if (theme.colourScheme === "light") {
    return rule(":root", ["color-scheme: light;", ...shared, ...light]);
  }
  if (theme.colourScheme === "dark") {
    return rule(":root", ["color-scheme: dark;", ...shared, ...dark]);
  }
  return [
    rule(":root", ["color-scheme: light dark;", ...shared, ...light]),
    `@media (prefers-color-scheme: dark) {\n${rule(":root", dark, "  ")}\n}`,
  ].join("\n");
}

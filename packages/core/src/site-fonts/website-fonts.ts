import {
  compileIncludedFontFaces,
  compileSiteFontFaces,
  familyValue,
  type FontCategory,
  fontCatalogue,
  type ResolvedSiteFont,
} from "@lintel/builder-model";
import { findFontPairing } from "@lintel/site-components";

/**
 * The fonts part of the website's stylesheet: every included font and every site font as
 * `@font-face` rules (browsers fetch only what a page uses), then the theme's heading and
 * body choices, which replace the pairing's fonts when they name a font the site has.
 *
 * An Adobe Fonts family falls back to the pairing's own fonts: until a visitor allows Adobe
 * Fonts in the cookie notice its stylesheet isn't linked, and the theme's fonts show instead.
 */
export function websiteFontsStylesheet(
  fonts: readonly ResolvedSiteFont[],
  theme: { headingFont: string | null; bodyFont: string | null; theme?: { fontPairing: string } },
): string {
  const available = availableFamilies(fonts);
  const fromAdobe = new Set(
    fonts.filter((font) => font.source === "adobe").map((font) => font.family.toLowerCase()),
  );
  const pairing = theme.theme ? findFontPairing(theme.theme.fontPairing) : null;
  const choose = (family: string | null) =>
    family
      ? available.find((font) => font.family.toLowerCase() === family.toLowerCase())
      : undefined;
  const value = (font: { family: string; category: FontCategory }, fallback: string | undefined) =>
    fallback && fromAdobe.has(font.family.toLowerCase())
      ? `'${font.family}', ${fallback}`
      : familyValue(font);
  const heading = choose(theme.headingFont);
  const body = choose(theme.bodyFont);
  const overrides = [
    ...(heading ? [`  --lintel-font-heading: ${value(heading, pairing?.headingFont)};`] : []),
    ...(body ? [`  --lintel-font-body: ${value(body, pairing?.bodyFont)};`] : []),
  ];
  return [
    compileIncludedFontFaces(),
    compileSiteFontFaces(fonts),
    overrides.length > 0 ? `:root {\n${overrides.join("\n")}\n}` : "",
  ]
    .filter((part) => part !== "")
    .join("\n\n");
}

/** The site's own fonts, then the included ones, as the theme and the builder offer them. */
export function availableFamilies(
  fonts: readonly ResolvedSiteFont[],
): Array<{ family: string; category: FontCategory }> {
  return [
    ...fonts.map(({ family, category }) => ({ family, category })),
    ...fontCatalogue.map(({ family, category }) => ({ family, category })),
  ];
}

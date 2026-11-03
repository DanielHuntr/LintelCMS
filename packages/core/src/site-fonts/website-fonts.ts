import {
  compileIncludedFontFaces,
  compileSiteFontFaces,
  familyValue,
  type FontCategory,
  fontCatalogue,
  type ResolvedSiteFont,
} from "@lintel/builder-model";

/**
 * The fonts part of the website's stylesheet: every included font and every site font as
 * `@font-face` rules (browsers fetch only what a page uses), then the theme's heading and
 * body choices, which replace the pairing's fonts when they name a font the site has.
 */
export function websiteFontsStylesheet(
  fonts: readonly ResolvedSiteFont[],
  theme: { headingFont: string | null; bodyFont: string | null },
): string {
  const available = availableFamilies(fonts);
  const choose = (family: string | null) =>
    family
      ? available.find((font) => font.family.toLowerCase() === family.toLowerCase())
      : undefined;
  const heading = choose(theme.headingFont);
  const body = choose(theme.bodyFont);
  const overrides = [
    ...(heading ? [`  --lintel-font-heading: ${familyValue(heading)};`] : []),
    ...(body ? [`  --lintel-font-body: ${familyValue(body)};`] : []),
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

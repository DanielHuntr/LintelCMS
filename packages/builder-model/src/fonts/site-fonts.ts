import { z } from "zod";
import {
  catalogueFontFaces,
  fallbackFamilies,
  type FontCategory,
  fontCatalogue,
  fontFaceRule,
  type FontFormat,
} from "./font-catalogue.js";
import { fontFamilyNameSchema } from "./page-fonts.js";

/**
 * The fonts a whole site can use, kept once per site rather than on each page: fonts the
 * maker uploaded, families from Google Fonts that Lintel downloaded and serves itself, and
 * families from an Adobe Fonts web project, which Adobe serves. Every page and the theme's
 * heading and body choices can use them.
 *
 * The server stores them (src/site-fonts in core) and hands renderers this resolved shape,
 * with each file's address already worked out; this file turns it into CSS.
 */

export const siteFontSources = ["upload", "google", "adobe"] as const;
export type SiteFontSource = (typeof siteFontSources)[number];

export const fontCategories = [
  "sans",
  "serif",
  "display",
  "script",
  "mono",
] as const satisfies readonly FontCategory[];

export const fontCategorySchema = z.enum(fontCategories, {
  error: "Choose what kind of font it is",
});

/** A weight as CSS writes it: "100" to "900". */
export const fontWeightSchema = z
  .string({ error: "A font weight is 100 to 900" })
  .regex(/^[1-9]00$/, { error: "A font weight is 100 to 900" });

export const fontStyleSchema = z.enum(["normal", "italic"], {
  error: "A font style is normal or italic",
});

/** "U+0000-00FF, U+0131": hex ranges only, so nothing else can slip into the stylesheet. */
export const unicodeRangeSchema = z
  .string()
  .max(2000)
  .regex(
    /^U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?(\s*,\s*U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?)*$/,
    {
      error: "That character range isn't one a stylesheet can use",
    },
  );

/** One file of a site font, with its address worked out by the server. */
export interface SiteFontFace {
  src: string;
  weight: string;
  style: "normal" | "italic";
  format: FontFormat;
  unicodeRange?: string;
}

/** What the builder's font list and the theme's choices need to know about a site font. */
export interface SiteFontChoice {
  family: string;
  category: FontCategory;
  source: SiteFontSource;
}

/** A site font ready to draw: its files (none for Adobe's, which Adobe's stylesheet brings). */
export interface ResolvedSiteFont extends SiteFontChoice {
  faces: SiteFontFace[];
}

const safeAddress = /^[^\s"'()\\;{}<>]+$/;

/**
 * The `@font-face` rules for a site's own fonts. Anything that could break out of the rule
 * (a family name with a quote, an address with a bracket) is left out rather than written.
 */
export function compileSiteFontFaces(fonts: readonly ResolvedSiteFont[]): string {
  return fonts
    .filter((font) => fontFamilyNameSchema.safeParse(font.family).success)
    .flatMap((font) =>
      font.faces
        .filter(
          (face) =>
            safeAddress.test(face.src) &&
            fontWeightSchema.safeParse(face.weight).success &&
            (face.unicodeRange === undefined ||
              unicodeRangeSchema.safeParse(face.unicodeRange).success),
        )
        .map((face) => fontFaceRule({ family: font.family, ...face })),
    )
    .join("\n\n");
}

/**
 * Every font that comes with Lintel, declared once for the whole site. Browsers only
 * download the files a page really uses, so declaring them all costs nothing and lets any
 * page pick any of them without adding it first.
 */
export function compileIncludedFontFaces(): string {
  return fontCatalogue.flatMap(catalogueFontFaces).map(fontFaceRule).join("\n\n");
}

/** What `font-family` is set to: the name, then a fallback of the same kind. */
export function familyValue(font: { family: string; category: FontCategory }): string {
  return `'${font.family}', ${fallbackFamilies[font.category]}`;
}

/**
 * An Adobe Fonts web project's id, as Adobe shows it under "Web projects": seven or so
 * lower-case letters and numbers, such as "abc1def". The embed link is built from it, so
 * nothing else can be put into the page.
 */
export const adobeProjectIdSchema = z
  .string({ error: "Paste your Adobe Fonts project ID" })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{5,12}$/, {
    error: "A project ID is 5 to 12 letters and numbers, like abc1def",
  });

/** The stylesheet Adobe asks sites to link to: it brings the project's fonts. */
export function adobeStylesheetUrl(projectId: string): string {
  return `https://use.typekit.net/${projectId}.css`;
}

/** Google Fonts' kinds of font, as Lintel names them. */
export function categoryFromGoogle(category: string): FontCategory {
  switch (category) {
    case "serif":
      return "serif";
    case "display":
      return "display";
    case "handwriting":
      return "script";
    case "monospace":
      return "mono";
    default:
      return "sans";
  }
}

const weightWords: ReadonlyArray<[RegExp, string]> = [
  [/(extra|ultra)[-\s]?light/i, "200"],
  [/(extra|ultra)[-\s]?bold/i, "800"],
  [/(semi|demi)[-\s]?bold/i, "600"],
  [/hairline|thin/i, "100"],
  [/light/i, "300"],
  [/medium/i, "500"],
  [/black|heavy/i, "900"],
  [/bold/i, "700"],
];

export interface FontFileGuess {
  family: string;
  weight: string;
  style: "normal" | "italic";
}

/**
 * A best guess at a font file's family, weight and style from its name alone, for when the
 * file itself doesn't say: "StudioSans-SemiBoldItalic.woff2" is Studio Sans, 600, italic.
 * The maker can change any of it.
 */
export function guessFontFromFileName(fileName: string): FontFileGuess {
  const base = fileName.replace(/\.[^.]+$/, "");
  const [familyPart = base, ...rest] = base.split(/[-_]/);
  const stylePart = rest.join(" ");
  const described = stylePart || familyPart;
  const weight = weightWords.find(([pattern]) => pattern.test(described))?.[1] ?? "400";
  const numeric = /\b([1-9]00)\b/.exec(described)?.[1];
  const family = (stylePart ? familyPart : familyPart.replace(/(Regular|Italic)$/i, ""))
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9 -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return {
    family: family || "My font",
    weight: numeric ?? weight,
    style: /italic|oblique/i.test(described) ? "italic" : "normal",
  };
}

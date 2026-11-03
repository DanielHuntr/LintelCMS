import { z } from "zod";
import { imageAddressSchema } from "../components/component-props.js";
import {
  catalogueFontFaces,
  fallbackFamilies,
  findCatalogueFont,
  fontFaceRule,
  type FontCategory,
  type FontFace,
  type FontFormat,
} from "./font-catalogue.js";

/**
 * The fonts a page uses besides the theme's, stored on the page itself (the page element's
 * `fonts` prop): families from the catalogue, by id, and fonts uploaded to the media library,
 * one file per weight and style. The page's stylesheet starts with an `@font-face` rule for
 * each file, with `font-display: swap` so text shows straight away in the fallback font, and
 * the website preloads each family's first file.
 *
 *   [{ "source": "catalogue", "id": "bebas-neue" },
 *    { "source": "upload", "family": "Studio Sans", "category": "sans",
 *      "files": [{ "src": "/media/studio-sans.woff2", "assetId": "a1",
 *                  "weight": "400", "style": "normal", "format": "woff2" }] }]
 */

export const fontFamilyNameSchema = z
  .string({ error: "A font needs a name" })
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/, {
    error: "A font name can have letters, numbers, spaces and hyphens",
  });

const uploadedFontFileSchema = z.object({
  src: imageAddressSchema
    .refine((address) => address !== "", { error: "A font needs a file" })
    .refine((address) => /^[^\s"'()\\;{}<>]+$/.test(address), {
      error: "A font file’s address can’t have spaces, quotes or brackets",
    }),
  assetId: z.string().max(100).nullable().default(null),
  weight: z
    .string()
    .regex(/^[1-9]00$/, { error: "A font weight is 100 to 900" })
    .default("400"),
  style: z.enum(["normal", "italic"]).default("normal"),
  format: z.enum(["woff2", "woff", "truetype", "opentype"]).default("woff2"),
});

export const pageFontSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("catalogue"),
    id: z.string().refine((id) => findCatalogueFont(id) !== undefined, {
      error: "That font isn’t one of the fonts that come with Lintel",
    }),
  }),
  z.object({
    source: z.literal("upload"),
    family: fontFamilyNameSchema,
    category: z.enum(["sans", "display", "serif", "script", "mono"]).default("sans"),
    files: z
      .array(uploadedFontFileSchema)
      .min(1, { error: "An uploaded font needs at least one file" })
      .max(12, { error: "A font can have at most 12 files" }),
  }),
]);

export type PageFont = z.output<typeof pageFontSchema>;

export const pageFontsSchema = z
  .array(pageFontSchema, { error: "A page’s fonts should be a list" })
  .max(12, { error: "A page can use at most 12 added fonts" })
  .default([]);

/** The family name, whichever kind of font it is. */
export function pageFontFamily(font: PageFont): string {
  return font.source === "upload" ? font.family : (findCatalogueFont(font.id)?.family ?? font.id);
}

export function pageFontCategory(font: PageFont): FontCategory {
  return font.source === "upload"
    ? font.category
    : (findCatalogueFont(font.id)?.category ?? "sans");
}

/** What `font-family` is set to for the font: its name, then a fallback of its kind. */
export function fontFamilyValue(font: PageFont): string {
  return `'${pageFontFamily(font)}', ${fallbackFamilies[pageFontCategory(font)]}`;
}

export function pageFontFaces(font: PageFont): FontFace[] {
  if (font.source === "catalogue") {
    const entry = findCatalogueFont(font.id);
    return entry ? catalogueFontFaces(entry) : [];
  }
  return font.files.map((file) => ({
    family: font.family,
    weight: file.weight,
    style: file.style,
    src: file.src,
    format: file.format satisfies FontFormat,
  }));
}

/**
 * The `@font-face` rules for a page's fonts, in the order they were added:
 *
 *   @font-face {
 *     font-family: 'Bebas Neue';
 *     src: url("/_lintel/fonts/bebas-neue-latin-400-normal.woff2") format("woff2");
 *     font-weight: 400;
 *     font-style: normal;
 *     font-display: swap;
 *   }
 */
export function compileFontFaces(fonts: readonly PageFont[]): string {
  return fonts.flatMap(pageFontFaces).map(fontFaceRule).join("\n\n");
}

/** The files worth preloading: each family's regular (or first) face, WOFF2 only. */
export function fontPreloads(fonts: readonly PageFont[]): string[] {
  return fonts.flatMap((font) => {
    const faces = pageFontFaces(font).filter((face) => face.format === "woff2");
    const regular =
      faces.find((face) => face.weight === "400" && face.style === "normal") ?? faces[0];
    return regular ? [regular.src] : [];
  });
}

/** Reads a page's fonts from the page element's props; anything unreadable counts as none. */
export function readPageFonts(pageProps: Record<string, unknown>): PageFont[] {
  const parsed = pageFontsSchema.safeParse(pageProps.fonts ?? []);
  return parsed.success ? parsed.data : [];
}

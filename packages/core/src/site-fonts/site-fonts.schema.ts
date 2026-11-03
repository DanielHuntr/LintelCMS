import {
  adobeProjectIdSchema,
  type FontCategory,
  fontCategorySchema,
  fontFamilyNameSchema,
  fontStyleSchema,
  fontWeightSchema,
  type SiteFontSource,
} from "@lintel/builder-model";
import { z } from "zod";
import { googleFontIdSchema } from "./google-fonts-client.js";

/** A family may have up to 18 files: nine weights, each upright and italic. */
export const MAX_FILES_PER_FONT = 18;
export const MAX_FONTS_PER_SITE = 40;

/** `POST /site-fonts/inspect`: files already in the media library, to read their names. */
export const inspectFontFilesRequestSchema = z.object({
  assetIds: z
    .array(z.uuid({ error: "That isn't a file in the media library" }))
    .min(1, { error: "Choose at least one font file" })
    .max(MAX_FILES_PER_FONT, { error: `Add at most ${MAX_FILES_PER_FONT} files at a time` }),
});

/** `POST /site-fonts/uploaded`: a family from files the maker uploaded. */
export const addUploadedFontRequestSchema = z.object({
  family: fontFamilyNameSchema,
  category: fontCategorySchema.default("sans"),
  files: z
    .array(
      z.object({
        assetId: z.uuid({ error: "That isn't a file in the media library" }),
        weight: fontWeightSchema.default("400"),
        style: fontStyleSchema.default("normal"),
      }),
    )
    .min(1, { error: "Add at least one font file" })
    .max(MAX_FILES_PER_FONT, { error: `A font can have at most ${MAX_FILES_PER_FONT} files` }),
  licenceConfirmed: z.literal(true, {
    error: "Please confirm your licence lets you use this font on a website",
  }),
});

export type AddUploadedFontRequest = z.output<typeof addUploadedFontRequestSchema>;

/** `POST /site-fonts/google`: a Google Fonts family, by its id, and the weights wanted. */
export const addGoogleFontRequestSchema = z.object({
  id: googleFontIdSchema,
  weights: z
    .array(fontWeightSchema)
    .min(1, { error: "Choose at least one weight" })
    .max(9, { error: "Choose at most nine weights" }),
  italic: z.boolean().default(false),
});

export type AddGoogleFontRequest = z.output<typeof addGoogleFontRequestSchema>;

/** `POST /site-fonts/adobe`: connects, or refreshes, an Adobe Fonts web project. */
export const connectAdobeProjectRequestSchema = z.object({ projectId: adobeProjectIdSchema });

/** `PATCH /site-fonts/:id`: what kind of font it is, for its fallback. */
export const updateSiteFontRequestSchema = z.object({ category: fontCategorySchema });

export const siteFontParamsSchema = z.object({
  id: z.uuid({ error: "That font isn't on this site" }),
});
export const googleFontParamsSchema = z.object({ id: googleFontIdSchema });
export const adobeProjectParamsSchema = z.object({ projectId: adobeProjectIdSchema });

/** `GET /site-fonts/google?search=&category=` */
export const searchGoogleFontsQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: fontCategorySchema.optional(),
});

export interface SiteFontFileResponse {
  assetId: string;
  url: string;
  weight: string;
  style: "normal" | "italic";
  format: string;
}

export interface SiteFontResponse {
  id: string;
  family: string;
  category: FontCategory;
  source: SiteFontSource;
  /** Google: the family's id. Adobe: the project's ID. */
  sourceId: string | null;
  /** Every file but the extra alphabets, one per weight and style. Empty for Adobe's. */
  files: SiteFontFileResponse[];
  weights: string[];
  hasItalic: boolean;
}

export interface SiteFontsResponse {
  fonts: SiteFontResponse[];
  adobeProjects: Array<{ projectId: string; stylesheetUrl: string; families: string[] }>;
}

/** What `POST /site-fonts/inspect` found in each file, to show before it is added. */
export interface InspectedFontFile {
  assetId: string;
  filename: string;
  family: string;
  weight: string;
  style: "normal" | "italic";
  /** True when the file named itself; false when this is a guess from its file name. */
  readFromFile: boolean;
}

export interface GoogleFontSummary {
  id: string;
  family: string;
  category: FontCategory;
  weights: string[];
  hasItalic: boolean;
}

export interface GoogleFontsSearchResponse {
  fonts: GoogleFontSummary[];
  /** How many matched, when more than shown. */
  total: number;
}

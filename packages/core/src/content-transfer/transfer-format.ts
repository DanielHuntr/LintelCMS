import { z } from "zod";
import { revisionKinds } from "../entries/entries.table.js";

/**
 * A Lintel export: a site's content in a form that can be read by people and by other
 * tools, and imported into any Lintel. Unlike a backup it leaves out users, sessions,
 * API tokens, webhooks and settings, and it is merged into a site rather than replacing it.
 *
 * It is one JSON document (`lintel-export.json`), alone or in a .zip with the media files
 * beside it under `media/`. Ids are kept, so importing the same export twice finds what the
 * first import made; content types, taxonomies, globals and menus are also matched by handle.
 */
export const EXPORT_FORMAT = "lintel-export";
export const EXPORT_FORMAT_VERSION = 1;
export const EXPORT_DOCUMENT = "lintel-export.json";

const jsonObject = z.record(z.string(), z.unknown());

export const exportedSiteSchema = z.object({
  handle: z.string(),
  name: z.string(),
  domain: z.string(),
  locale: z.string(),
  fallbackLocale: z.string().nullable(),
  locales: z.array(z.object({ code: z.string(), name: z.string() })),
});

export const exportedBlueprintSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  fields: z.array(jsonObject),
});

export const exportedCollectionSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  blueprint: z.string(),
  routePattern: z.string().nullable(),
  previewUrlPattern: z.string().nullable(),
  structure: z.enum(["tree", "dated", "flat"]),
});

export const exportedTermSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
});

export const exportedTaxonomySchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  terms: z.array(exportedTermSchema),
});

export const exportedGlobalSetSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  fields: z.array(jsonObject),
  values: z.array(z.object({ locale: z.string(), data: jsonObject })),
});

export const exportedMenuSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  maxDepth: z.number().int(),
  items: z.array(jsonObject),
});

export const exportedAssetSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt: z.string(),
  focalX: z.number(),
  focalY: z.number(),
  contentHash: z.string(),
  /** Where the file is in the .zip, or null in an export made without files. */
  file: z.string().nullable(),
});

export const exportedRevisionSchema = z.object({
  id: z.uuid(),
  kind: z.enum(revisionKinds),
  data: jsonObject,
  createdAt: z.string(),
});

export const exportedEntrySchema = z.object({
  id: z.uuid(),
  collection: z.string(),
  site: z.string(),
  locale: z.string(),
  originId: z.uuid().nullable(),
  parentId: z.uuid().nullable(),
  slug: z.string().min(1),
  status: z.enum(["draft", "published", "scheduled"]),
  publishedAt: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  data: jsonObject,
  publishedData: jsonObject.nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Only in exports made with revisions. */
  revisions: z.array(exportedRevisionSchema).optional(),
});

export const lintelExportSchema = z.object({
  format: z.literal(EXPORT_FORMAT, { error: "This isn't a Lintel export" }),
  formatVersion: z.number().int().positive(),
  exportedAt: z.string(),
  sites: z.array(exportedSiteSchema),
  blueprints: z.array(exportedBlueprintSchema),
  collections: z.array(exportedCollectionSchema),
  taxonomies: z.array(exportedTaxonomySchema),
  globals: z.array(exportedGlobalSetSchema),
  menus: z.array(exportedMenuSchema),
  media: z.array(exportedAssetSchema),
  entries: z.array(exportedEntrySchema),
});

export type LintelExport = z.infer<typeof lintelExportSchema>;
export type ExportedEntry = z.infer<typeof exportedEntrySchema>;
export type ExportedAsset = z.infer<typeof exportedAssetSchema>;
export type ExportedTaxonomy = z.infer<typeof exportedTaxonomySchema>;

/** What to do with something in the export that this site already has. */
export const conflictStrategies = ["skip", "overwrite"] as const;
export type ConflictStrategy = (typeof conflictStrategies)[number];

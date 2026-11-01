import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";

export const collectionStructures = ["tree", "dated", "flat"] as const;
export type CollectionStructure = (typeof collectionStructures)[number];

/** What a route pattern may contain besides fixed text. See src/delivery/entry-urls.ts. */
export const ROUTE_PLACEHOLDERS = ["{slug}", "{year}", "{month}", "{day}"] as const;

const structureSchema = z.enum(collectionStructures, {
  error: 'The structure should be "tree", "dated" or "flat"',
});

/**
 * Where an entry lives on the site, such as "/blog/{slug}". null means the collection's
 * entries have no page of their own (testimonials shown on other pages, say).
 */
const routePatternSchema = z
  .string({ error: "The route pattern should be text, like /blog/{slug}" })
  .trim()
  .startsWith("/", { error: "The route pattern should start with /, like /blog/{slug}" })
  .includes("{slug}", { error: "The route pattern needs {slug} in it, like /blog/{slug}" })
  .refine(usesOnlyKnownPlaceholders, {
    error: `The route pattern can use ${ROUTE_PLACEHOLDERS.join(", ")}`,
  })
  .nullable();

function usesOnlyKnownPlaceholders(pattern: string): boolean {
  const placeholders = pattern.match(/\{[^}]*\}/g) ?? [];
  return placeholders.every((placeholder) =>
    (ROUTE_PLACEHOLDERS as readonly string[]).includes(placeholder),
  );
}

/** The placeholders a preview address may use. See src/preview/preview-urls.ts. */
export const PREVIEW_PLACEHOLDERS = ["{url}", "{slug}", "{token}", "{collection}", "{id}"] as const;

/**
 * Where the website shows a draft, such as "https://example.com/api/preview?path={url}&token={token}".
 * null means no website is connected yet, and the admin uses its built-in preview.
 */
const previewUrlPatternSchema = z
  .string({ error: "The preview address should be text, like https://example.com/preview" })
  .trim()
  .max(500, { error: "The preview address can be at most 500 characters" })
  .regex(/^https?:\/\/[^\s]+$/i, {
    error: "The preview address should start with https:// (or http:// for a local site)",
  })
  .refine(usesOnlyPreviewPlaceholders, {
    error: `The preview address can use ${PREVIEW_PLACEHOLDERS.join(", ")}`,
  })
  .nullable();

function usesOnlyPreviewPlaceholders(pattern: string): boolean {
  const placeholders = pattern.match(/\{[^}]*\}/g) ?? [];
  return placeholders.every((placeholder) =>
    (PREVIEW_PLACEHOLDERS as readonly string[]).includes(placeholder),
  );
}

const collectionNameSchema = z
  .string({ error: "Please give the collection a name" })
  .trim()
  .min(1, { error: "Please give the collection a name" })
  .max(100, { error: "Names can be at most 100 characters" });

const blueprintHandleSchema = z
  .string({ error: "Please choose a content type" })
  .min(1, { error: "Please choose a content type" });

/**
 * Handles the delivery API (and the admin's Content section) use for other kinds of content,
 * so `/delivery/globals` can't mean a collection.
 */
export const RESERVED_COLLECTION_HANDLES = [
  "taxonomies",
  "globals",
  "navigation",
  "locales",
  // /delivery/forms/:handle serves forms (see src/forms).
  "forms",
  "shop",
];

/** `POST /collections`. Without a route pattern, entries live at /<handle>/{slug}. */
export const createCollectionRequestSchema = z.object({
  handle: handleSchema("Please give the collection a handle").refine(
    (handle) => !RESERVED_COLLECTION_HANDLES.includes(handle),
    { error: (issue) => `“${String(issue.input)}” is used by Lintel itself. Pick another handle.` },
  ),
  name: collectionNameSchema,
  blueprintHandle: blueprintHandleSchema,
  structure: structureSchema,
  routePattern: routePatternSchema.optional(),
  previewUrlPattern: previewUrlPatternSchema.optional(),
});

/** `PUT /collections/:handle`. Anything left out stays as it is; the handle can't change. */
export const updateCollectionRequestSchema = z.object({
  name: collectionNameSchema.optional(),
  blueprintHandle: blueprintHandleSchema.optional(),
  structure: structureSchema.optional(),
  routePattern: routePatternSchema.optional(),
  previewUrlPattern: previewUrlPatternSchema.optional(),
});

export const collectionHandleParamsSchema = z.object({ handle: z.string() });

/** A collection as the API returns it. */
export const collectionSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  blueprintHandle: z.string(),
  structure: structureSchema,
  routePattern: z.string().nullable(),
  previewUrlPattern: z.string().nullable(),
  entryCount: z.number().int(),
  updatedAt: z.iso.datetime(),
});

export type CreateCollectionRequest = z.infer<typeof createCollectionRequestSchema>;
export type UpdateCollectionRequest = z.infer<typeof updateCollectionRequestSchema>;
export type CollectionResponse = z.infer<typeof collectionSchema>;

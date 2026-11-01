import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";

const taxonomyNameSchema = z
  .string({ error: "Please give the taxonomy a name" })
  .trim()
  .min(1, { error: "Please give the taxonomy a name" })
  .max(100, { error: "Names can be at most 100 characters" });

/** Which site a taxonomy belongs to, by handle; null for one every site shares. */
const taxonomySiteSchema = z.string({ error: "The site should be a site's handle" }).nullable();

/** `POST /taxonomies`. Without a site, every site shares it. */
export const createTaxonomyRequestSchema = z.object({
  handle: handleSchema("Please give the taxonomy a handle"),
  name: taxonomyNameSchema,
  siteHandle: taxonomySiteSchema.default(null),
});

/** `PUT /taxonomies/:handle`. The handle can't change: fields refer to it. */
export const updateTaxonomyRequestSchema = z.object({
  name: taxonomyNameSchema,
  siteHandle: taxonomySiteSchema.optional(),
});

export const taxonomyHandleParamsSchema = z.object({ handle: z.string() });

const termTitleSchema = z
  .string({ error: "Please give the term a name" })
  .trim()
  .min(1, { error: "Please give the term a name" })
  .max(100, { error: "Names can be at most 100 characters" });

const termDescriptionSchema = z
  .string({ error: "The description should be text" })
  .trim()
  .max(1000, { error: "Descriptions can be at most 1000 characters" });

const termSlugSchema = z
  .string({ error: "The slug should be text" })
  .max(200, { error: "Slugs can be at most 200 characters" });

/** `POST /taxonomies/:handle/terms`. Without a slug, one is made from the title. */
export const createTermRequestSchema = z.object({
  title: termTitleSchema,
  slug: termSlugSchema.optional(),
  description: termDescriptionSchema.optional(),
});

/** `PATCH /terms/:id`. Anything left out stays as it is. */
export const updateTermRequestSchema = z.object({
  title: termTitleSchema.optional(),
  slug: termSlugSchema.optional(),
  description: termDescriptionSchema.optional(),
});

export const termIdParamsSchema = z.object({ id: z.uuid() });

export const termSlugParamsSchema = z.object({ handle: z.string(), slug: z.string() });

/** A taxonomy as the API returns it. */
export const taxonomySchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  /** The site it belongs to; null when every site shares it. */
  siteId: z.uuid().nullable(),
  termCount: z.number().int(),
  updatedAt: z.iso.datetime(),
});

/** A term as the API returns it. */
export const termSchema = z.object({
  id: z.uuid(),
  taxonomyHandle: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  updatedAt: z.iso.datetime(),
});

export type CreateTaxonomyRequest = z.infer<typeof createTaxonomyRequestSchema>;
export type UpdateTaxonomyRequest = z.infer<typeof updateTaxonomyRequestSchema>;
export type CreateTermRequest = z.infer<typeof createTermRequestSchema>;
export type UpdateTermRequest = z.infer<typeof updateTermRequestSchema>;
export type TaxonomyResponse = z.infer<typeof taxonomySchema>;
export type TermResponse = z.infer<typeof termSchema>;

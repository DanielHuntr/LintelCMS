import { z } from "zod";
import { seoDefaultsSchema } from "./seo-defaults.schema.js";

/** `PUT /seo/defaults` */
export const updateSeoDefaultsRequestSchema = seoDefaultsSchema.partial();

/** `PUT /seo/entries/:id`. Empty text means "use the site default". */
export const entrySeoRequestSchema = z.object({
  title: z
    .string({ error: "The SEO title should be text" })
    .trim()
    .max(200, { error: "SEO titles can be at most 200 characters" })
    .default(""),
  description: z
    .string({ error: "The description should be text" })
    .trim()
    .max(500, { error: "Descriptions can be at most 500 characters" })
    .default(""),
  socialImageId: z
    .uuid({ error: "The social image should be an asset id" })
    .nullable()
    .default(null),
  noindex: z.boolean({ error: "noindex should be true or false" }).default(false),
});

export const entrySeoSchema = z.object({
  title: z.string(),
  description: z.string(),
  socialImageId: z.uuid().nullable(),
  noindex: z.boolean(),
});

export const entrySeoParamsSchema = z.object({ id: z.uuid() });
export const deliveredEntrySeoParamsSchema = z.object({ collection: z.string(), slug: z.string() });

/**
 * An entry's SEO with the site defaults filled in, ready for a page's <head>:
 * `GET /delivery/:collection/:slug/seo`.
 */
export const deliveredEntrySeoSchema = z.object({
  title: z.string(),
  description: z.string(),
  /** The full address of the page, when the site address is set in SEO settings. */
  canonicalUrl: z.string().nullable(),
  image: z
    .object({
      url: z.string(),
      alt: z.string(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
    })
    .nullable(),
  /** True when search engines should leave the page out (`<meta name="robots" content="noindex">`). */
  noindex: z.boolean(),
});

export type UpdateSeoDefaultsRequest = z.output<typeof updateSeoDefaultsRequestSchema>;
export type EntrySeoRequest = z.output<typeof entrySeoRequestSchema>;
export type EntrySeo = z.infer<typeof entrySeoSchema>;
export type DeliveredEntrySeo = z.infer<typeof deliveredEntrySeoSchema>;

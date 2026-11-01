import { z } from "zod";

/** `GET /delivery/:collection` */
export const deliveryListQuerySchema = z.object({
  page: z.coerce.number({ error: "The page should be a number" }).int().min(1).default(1),
  perPage: z.coerce
    .number({ error: "perPage should be a number" })
    .int()
    .min(1, { error: "perPage should be at least 1" })
    .max(100, { error: "perPage can be at most 100" })
    .default(25),
  /** Which language to list. Defaults to the site's main language. */
  locale: emptyMeansMissing(z.string().optional()),
  /** With `term`: only entries that chose this term, such as `?taxonomy=tags&term=recipes`. */
  taxonomy: emptyMeansMissing(z.string().optional()),
  term: emptyMeansMissing(z.string().optional()),
});

/** `GET /delivery/:collection/:slug` */
export const deliveryEntryQuerySchema = z.object({
  locale: emptyMeansMissing(z.string().optional()),
});

function emptyMeansMissing<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

export const deliveryListParamsSchema = z.object({ collection: z.string() });
export const deliveryEntryParamsSchema = z.object({ collection: z.string(), slug: z.string() });

/**
 * One published entry, ready for a website. `data` has every field of the blueprint:
 * images become `{ id, url, alt, width, height, focalPoint }` and rich text becomes
 * `{ json, html }`. Empty fields are null.
 */
export const deliveredEntrySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  url: z.string().nullable(),
  locale: z.string(),
  publishedAt: z.iso.datetime().nullable(),
  data: z.record(z.string(), z.unknown()),
});

/**
 * A single entry also lists where it is published in the site's other languages, for
 * language switchers and `hreflang` links.
 */
export const deliveredEntryWithTranslationsSchema = deliveredEntrySchema.extend({
  translations: z.array(
    z.object({ locale: z.string(), slug: z.string(), url: z.string().nullable() }),
  ),
});

export const deliveredListSchema = z.object({
  items: z.array(deliveredEntrySchema),
  total: z.number().int(),
});

export type DeliveryListQuery = z.infer<typeof deliveryListQuerySchema>;
export type DeliveredEntry = z.infer<typeof deliveredEntrySchema>;
export type DeliveredEntryWithTranslations = z.infer<typeof deliveredEntryWithTranslationsSchema>;
export type DeliveredList = z.infer<typeof deliveredListSchema>;

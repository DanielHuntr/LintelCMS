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
});

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
  publishedAt: z.iso.datetime().nullable(),
  data: z.record(z.string(), z.unknown()),
});

export const deliveredListSchema = z.object({
  items: z.array(deliveredEntrySchema),
  total: z.number().int(),
});

export type DeliveryListQuery = z.infer<typeof deliveryListQuerySchema>;
export type DeliveredEntry = z.infer<typeof deliveredEntrySchema>;
export type DeliveredList = z.infer<typeof deliveredListSchema>;

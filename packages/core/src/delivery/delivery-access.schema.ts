import { z } from "zod";

/**
 * A website address allowed to call the content APIs from the browser, such as
 * "https://www.example.com". Only the origin is kept: "https://example.com/blog/" is
 * stored as "https://example.com", because that is all a browser sends.
 */
export const siteOriginSchema = z
  .string({ error: "Each website address should be text" })
  .trim()
  .refine(isWebOrigin, {
    error: "Website addresses should start with https:// or http://, like https://www.example.com",
  })
  .transform((value) => new URL(value).origin);

function isWebOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "";
  } catch {
    return false;
  }
}

/** Who may read published content: anyone, or only requests with a token. */
export const deliveryAccessSchema = z.object({
  /** When on, /delivery and /graphql answer 401 without a valid API token. */
  requireToken: z.boolean({ error: "requireToken should be true or false" }),
  /** Websites whose pages may call the content APIs from the browser (CORS). */
  allowedOrigins: z
    .array(siteOriginSchema, { error: "Please send a list of website addresses" })
    .max(50, { error: "You can list up to 50 website addresses" })
    .transform((origins) => [...new Set(origins)]),
});

/** `PUT /delivery-access`: anything left out stays as it is. */
export const updateDeliveryAccessRequestSchema = deliveryAccessSchema.partial();

export type DeliveryAccess = z.output<typeof deliveryAccessSchema>;
export type UpdateDeliveryAccessRequest = z.output<typeof updateDeliveryAccessRequestSchema>;

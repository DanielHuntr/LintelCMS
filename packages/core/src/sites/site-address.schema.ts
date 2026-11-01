import { z } from "zod";
import { optionalOrigin } from "../seo/seo-defaults.schema.js";

/** `PUT /site-address`. Empty disconnects the site; an address keeps only its origin. */
export const updateSiteAddressRequestSchema = z.object({ siteAddress: optionalOrigin });

export const siteAddressSchema = z.object({
  /** Such as "https://www.example.com", or "" when no website is connected yet. */
  siteAddress: z.string(),
});

export type UpdateSiteAddressRequest = z.infer<typeof updateSiteAddressRequestSchema>;
export type SiteAddressResponse = z.infer<typeof siteAddressSchema>;

import { z } from "zod";
import { normalizePathPrefix } from "../sites/site-addresses.js";
import { normalizeRootHostname } from "./root-addresses.js";

/** `PUT /content-tree/entries/:id/hostnames`. Both empty takes the page back to the default. */
export const saveRootHostnamesRequestSchema = z.object({
  hostname: z
    .string({ error: "The domain should be text, like shop.example.com" })
    .max(253, { error: "A domain can be at most 253 characters" })
    .default("")
    .transform((value, context) => {
      const hostname = normalizeRootHostname(value);
      if (hostname === null) {
        context.addIssue({
          code: "custom",
          message: "That isn't a domain. Type it like shop.example.com",
        });
        return z.NEVER;
      }
      return hostname;
    }),
  pathPrefix: z
    .string({ error: "The path should be text, like /shop" })
    .max(200, { error: "A path can be at most 200 characters" })
    .default("")
    .transform((value, context) => {
      const pathPrefix = normalizePathPrefix(value);
      if (pathPrefix === null) {
        context.addIssue({
          code: "custom",
          message: "Use lowercase letters, numbers and dashes in the path, like /shop",
        });
        return z.NEVER;
      }
      return pathPrefix;
    }),
});

export type SaveRootHostnamesRequest = z.output<typeof saveRootHostnamesRequestSchema>;

/** What "Hostnames" shows for a site start. */
export interface RootHostnames {
  entryId: string;
  /** Its own domain, or "" when it has none. */
  hostname: string;
  /** Its own path prefix, or "" when it has none. */
  pathPrefix: string;
  /** Has a domain or path of its own; otherwise it takes the default. */
  isAssigned: boolean;
  /** Is the site's "/", as the first site start without an address of its own. */
  isDefault: boolean;
  /** Where it answers now. */
  url: string;
}

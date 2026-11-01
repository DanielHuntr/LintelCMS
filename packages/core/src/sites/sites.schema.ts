import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import { localeCodeSchema } from "./locales.schema.js";
import { normalizeHostname, normalizePathPrefix } from "./site-addresses.js";

const siteNameSchema = z
  .string({ error: "Please give the site a name" })
  .trim()
  .min(1, { error: "Please give the site a name" })
  .max(100, { error: "Names can be at most 100 characters" });

/**
 * A domain the site answers on. A pasted address is tidied down to its domain
 * ("https://www.Acme.co.uk/about" becomes "www.acme.co.uk"); a port is kept, for local sites.
 */
const hostnameSchema = z
  .string({ error: "Domains should be text, like www.example.com" })
  .transform((value, context) => {
    const hostname = normalizeHostname(value);
    if (hostname === null) {
      context.issues.push({
        code: "custom",
        message: `“${value.trim()}” isn't a domain. Try one like www.example.com.`,
        input: value,
      });
      return z.NEVER;
    }
    return hostname;
  });

const hostnamesSchema = z
  .array(hostnameSchema, { error: "Domains should be a list" })
  .max(20, { error: "A site can have at most 20 domains" })
  .transform((hostnames) => [...new Set(hostnames)]);

/** "/fr" or "" for none. "fr/", "/FR" and "/fr/" all become "/fr". */
const pathPrefixSchema = z
  .string({ error: "The path should be text, like /fr" })
  .max(100, { error: "The path can be at most 100 characters" })
  .transform((value, context) => {
    const prefix = normalizePathPrefix(value);
    if (prefix === null) {
      context.issues.push({
        code: "custom",
        message: "The path uses lowercase letters, numbers and hyphens, like /fr or /en-gb",
        input: value,
      });
      return z.NEVER;
    }
    return prefix;
  });

/** The site's public address, kept as an origin: "https://acme.co.uk". Empty for none yet. */
const siteUrlSchema = z
  .string({ error: "The site address should be text" })
  .trim()
  .refine((value) => value === "" || isWebAddress(value), {
    error: "The site address should start with https://, like https://www.example.com",
  })
  .transform((value) => (value === "" ? "" : new URL(value).origin));

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export const siteBrandingSchema = z.object({
  logoAssetId: z.uuid({ error: "The logo should be an image from the media library" }).nullable(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, { error: "The colour should be a hex code, like #7539fd" })
    .transform((color) => color.toLowerCase())
    .nullable(),
});

/** `POST /sites`. Extra languages can be added now or later, in Settings → Languages. */
export const createSiteRequestSchema = z.object({
  handle: handleSchema("Please give the site a handle"),
  name: siteNameSchema,
  hostnames: hostnamesSchema.default([]),
  pathPrefix: pathPrefixSchema.default(""),
  siteUrl: siteUrlSchema.default(""),
  defaultLocale: localeCodeSchema,
  extraLocales: z.array(localeCodeSchema).max(50).default([]),
  branding: siteBrandingSchema.partial().optional(),
});

/** `PATCH /sites/:handle`. The handle can't change. The main language must be one of the site's. */
export const updateSiteRequestSchema = z.object({
  name: siteNameSchema.optional(),
  hostnames: hostnamesSchema.optional(),
  pathPrefix: pathPrefixSchema.optional(),
  siteUrl: siteUrlSchema.optional(),
  defaultLocale: localeCodeSchema.optional(),
  branding: siteBrandingSchema.partial().optional(),
});

export const siteParamsSchema = z.object({ handle: z.string() });

/** `?url=` for `GET /delivery/sites/match`: a full address on one of the sites. */
export const matchSiteQuerySchema = z.object({
  url: z.string({ error: "Send the page's address as ?url=" }).refine(isWebAddress, {
    error: "The address should start with https://, like https://www.example.com/about",
  }),
});

/** `PUT /sites/access/:roleHandle`: null opens the role to every site. */
export const roleSiteAccessRequestSchema = z.object({
  siteHandles: z
    .array(z.string(), { error: "Choose the sites as a list" })
    .min(1, { error: "Choose at least one site, or every site" })
    .nullable(),
});

export const roleParamsSchema = z.object({ roleHandle: z.string() });

/** A site as the admin API returns it. */
export const siteSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  hostnames: z.array(z.string()),
  pathPrefix: z.string(),
  siteUrl: z.string(),
  defaultLocale: z.string(),
  locales: z.array(z.object({ code: z.string(), name: z.string() })),
  branding: siteBrandingSchema,
  entryCount: z.number().int(),
});

/** A site as websites see it, from `GET /delivery/sites`. */
export const deliveredSiteSchema = siteSchema.pick({
  handle: true,
  name: true,
  isDefault: true,
  hostnames: true,
  pathPrefix: true,
  siteUrl: true,
  defaultLocale: true,
  locales: true,
  branding: true,
});

export type CreateSiteRequest = z.infer<typeof createSiteRequestSchema>;
export type UpdateSiteRequest = z.infer<typeof updateSiteRequestSchema>;
export type SiteResponse = z.infer<typeof siteSchema>;
export type DeliveredSite = z.infer<typeof deliveredSiteSchema>;

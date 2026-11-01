import { z } from "zod";

/**
 * Site-wide search engine settings from the SEO plugin, kept as one setting
 * (`seoDefaults`, see src/settings). Each entry can override the title, description and
 * image; anything it leaves empty falls back to these.
 */
export const TITLE_PLACEHOLDER = "{title}";

export const optionalOrigin = z
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

export const seoDefaultsSchema = z.object({
  /** Shown after page titles by the default template, and in social previews. */
  siteName: z.string().trim().max(100, { error: "The site name can be at most 100 characters" }),
  /** The public address of the website, for the sitemap and robots.txt. */
  siteUrl: optionalOrigin,
  /** How page titles are built: "{title} | {siteName}". */
  titleTemplate: z
    .string()
    .trim()
    .max(200, { error: "The title template can be at most 200 characters" })
    .refine((value) => value.includes(TITLE_PLACEHOLDER), {
      error: "The title template needs {title} in it, like “{title} | {siteName}”",
    }),
  /** Used by pages that don't have a description of their own. */
  defaultDescription: z
    .string()
    .trim()
    .max(300, { error: "The description can be at most 300 characters" }),
  /** The picture social networks show when a page has none of its own. */
  defaultSocialImageId: z.uuid({ error: "The social image should be an asset id" }).nullable(),
  /** Asks search engines not to list any page: for a site that isn't ready yet. */
  discourageSearchEngines: z.boolean(),
});

export type SeoDefaults = z.output<typeof seoDefaultsSchema>;

export const defaultSeoDefaults: SeoDefaults = {
  siteName: "",
  siteUrl: "",
  titleTemplate: "{title} | {siteName}",
  defaultDescription: "",
  defaultSocialImageId: null,
  discourageSearchEngines: false,
};

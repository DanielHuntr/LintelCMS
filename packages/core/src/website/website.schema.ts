import {
  colourSchemes,
  cornerStyles,
  fontPairingIds,
  type SiteTheme,
  spacingScales,
} from "@lintel/site-components";
import { z } from "zod";

/**
 * Settings, Site: which template the built-in website uses, its theme and logo. Kept as
 * one setting (`website`, see src/settings). Anything left null follows the template's own
 * default, and a null template is picked from the site type chosen during setup, so a new
 * site needs nothing saved. The site's address is the one `siteAddress` setting (see
 * src/sites); left empty, it is the built-in site's address.
 */

const hexColourSchema = z
  .string({ error: "Colours should be text, like #7539fd" })
  .trim()
  .regex(/^#[0-9a-f]{6}$/i, { error: "Colours should be written like #7539fd" })
  .transform((colour) => colour.toLowerCase());

const siteAddressSchema = z
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

/** A family name, as site fonts and the included fonts have them ("Studio Sans"). */
const themeFontSchema = z
  .string({ error: "Choose a font" })
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/, { error: "Choose one of the site's fonts" });

export const templateIdSchema = z
  .string({ error: "Please choose a template" })
  .regex(/^[a-z][a-z0-9-]*$/, { error: "That isn't one of the templates" });

/** Every key has a default, so a value saved by an older version still reads. */
export const websiteSettingsSchema = z.object({
  template: templateIdSchema.nullable().default(null),
  brandColour: hexColourSchema.nullable().default(null),
  accentColour: hexColourSchema.nullable().default(null),
  fontPairing: z
    .enum(fontPairingIds, { error: "Please choose a font pairing" })
    .nullable()
    .default(null),
  cornerStyle: z
    .enum(cornerStyles, { error: "Please choose a corner style" })
    .nullable()
    .default(null),
  spacing: z.enum(spacingScales, { error: "Please choose the spacing" }).nullable().default(null),
  colourScheme: z
    .enum(colourSchemes, { error: "Please choose light, dark or automatic" })
    .nullable()
    .default(null),
  logoAssetId: z
    .uuid({ error: "The logo should be an image from the media library" })
    .nullable()
    .default(null),
  /** A font family for headings, from the site's fonts or the included ones; null follows the pairing. */
  headingFont: themeFontSchema.nullable().default(null),
  /** The same for body text. */
  bodyFont: themeFontSchema.nullable().default(null),
});

export type WebsiteSettings = z.output<typeof websiteSettingsSchema>;

export const defaultWebsiteSettings: WebsiteSettings = websiteSettingsSchema.parse({});

/** `PUT /website`: any of the settings. Templates are checked against the installed list. */
export const updateWebsiteRequestSchema = z.object({
  template: templateIdSchema.optional(),
  brandColour: hexColourSchema.nullable().optional(),
  accentColour: hexColourSchema.nullable().optional(),
  fontPairing: z
    .enum(fontPairingIds, { error: "Please choose a font pairing" })
    .nullable()
    .optional(),
  cornerStyle: z
    .enum(cornerStyles, { error: "Please choose a corner style" })
    .nullable()
    .optional(),
  spacing: z.enum(spacingScales, { error: "Please choose the spacing" }).nullable().optional(),
  colourScheme: z
    .enum(colourSchemes, { error: "Please choose light, dark or automatic" })
    .nullable()
    .optional(),
  logoAssetId: z
    .uuid({ error: "The logo should be an image from the media library" })
    .nullable()
    .optional(),
  headingFont: themeFontSchema.nullable().optional(),
  bodyFont: themeFontSchema.nullable().optional(),
  /** Saved as the `siteAddress` setting. Empty means the built-in site's address. */
  siteAddress: siteAddressSchema.optional(),
});

export type UpdateWebsiteRequest = z.output<typeof updateWebsiteRequestSchema>;

/** `GET /website` and `PUT /website`: the settings with every default filled in. */
export interface WebsiteResponse {
  template: string;
  theme: SiteTheme;
  logoAssetId: string | null;
  /** The family headings and body text use instead of the pairing's; null follows the pairing. */
  headingFont: string | null;
  bodyFont: string | null;
  /** What was typed in Settings → Your website; empty uses the built-in site's. */
  siteAddress: string;
  /** Where the site is reached: the address above, or the built-in site's. Null if neither. */
  effectiveSiteAddress: string | null;
  /** The built-in site's own address, or null when this install doesn't serve one. */
  builtInSiteUrl: string | null;
  templates: Array<{ id: string; name: string; description: string; defaultTheme: SiteTheme }>;
  fontPairings: Array<{ id: string; name: string; description: string }>;
}

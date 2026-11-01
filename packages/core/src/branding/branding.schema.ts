import { z } from "zod";
import { type AccentShades, LINTEL_ACCENT_COLOUR, normaliseHexColour } from "./accent-colours.js";

/** Kinds of picture accepted for logos, the mark, the favicon and the sign-in background. */
export const brandingImageTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const;

/** About 512 KB of picture once base64 is decoded; logos and favicons are far smaller. */
const MAXIMUM_IMAGE_LENGTH = 700_000;

const DATA_URL = /^data:([a-z+./-]+);base64,([a-z0-9+/=]+)$/i;

/**
 * A picture, either uploaded (kept as a data URL) or at a web address the agency hosts.
 * Uploaded ones are served from /branding/images, so pages don't carry them inline.
 */
export const brandingImageSchema = z
  .string({ error: "Pictures should be an uploaded file or a web address" })
  .trim()
  .max(MAXIMUM_IMAGE_LENGTH, { error: "That picture is too big. Use one under 500 KB." })
  .refine(isBrandingImage, {
    error: "Use a PNG, JPEG, WebP, GIF, SVG or ICO picture, or a web address starting https://",
  });

const optionalText = (maximum: number, name: string) =>
  z
    .string({ error: `The ${name} should be text` })
    .trim()
    .max(maximum, { error: `The ${name} can be at most ${maximum} characters` })
    .transform((value) => (value === "" ? null : value))
    .nullable();

const webAddress = (name: string) =>
  z
    .string({ error: `The ${name} should be a web address` })
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || isWebAddress(value), {
      error: `The ${name} should start with https:// or http://`,
    })
    .nullable();

export const accentColourSchema = z
  .string({ error: "The accent colour should be a colour like #7539FD" })
  .transform((value, context) => {
    const colour = normaliseHexColour(value);
    if (!colour) {
      context.addIssue({ code: "custom", message: "Use a colour like #7539FD" });
      return z.NEVER;
    }
    return colour;
  });

/** Everything an agency can change about how the admin looks and what it links to. */
export const brandingSchema = z.object({
  /** Shown in the sidebar, the sign-in screen, browser tabs and emails. */
  productName: z
    .string({ error: "The product name should be text" })
    .trim()
    .min(1, { error: "Give the admin a name, such as your agency's" })
    .max(60, { error: "The product name can be at most 60 characters" }),
  /** The full logo for light backgrounds. Without it, the mark and name are shown. */
  logo: brandingImageSchema.nullable(),
  /** The logo for dark mode. Without it, `logo` is used in both. */
  logoDark: brandingImageSchema.nullable(),
  /** A small square mark, beside the name in the sidebar. */
  mark: brandingImageSchema.nullable(),
  favicon: brandingImageSchema.nullable(),
  accentColour: accentColourSchema,
  /** A sentence under the sign-in heading, such as "Need help? Call us on 0123 456 789". */
  signInMessage: optionalText(300, "sign-in message"),
  /** A picture behind the sign-in screen. */
  signInBackground: brandingImageSchema.nullable(),
  /** Where clients go for help, shown on the Help page. */
  supportUrl: webAddress("support link"),
  supportEmail: z
    .string({ error: "The support email should be an email address" })
    .trim()
    .transform((value) => (value === "" ? null : value.toLowerCase()))
    .refine((value) => value === null || z.email().safeParse(value).success, {
      error: "That doesn't look like an email address",
    })
    .nullable(),
  /** The agency's own documentation, linked instead of Lintel's when Lintel's help is hidden. */
  docsUrl: webAddress("documentation link"),
  /** Hides the "Built with Lintel" credit on the public website. */
  hideBuiltWithLintel: z.boolean({ error: "Hide Built with Lintel should be true or false" }),
  /** Hides Lintel's own help pages and docs links in the admin. */
  hideLintelHelp: z.boolean({ error: "Hide Lintel's help should be true or false" }),
});

export type Branding = z.output<typeof brandingSchema>;
export type BrandingImageField = "logo" | "logoDark" | "mark" | "favicon" | "signInBackground";

export const brandingImageFields: readonly BrandingImageField[] = [
  "logo",
  "logoDark",
  "mark",
  "favicon",
  "signInBackground",
];

/** Only the fields that differ from the deployment's defaults are saved. */
export const brandingOverridesSchema = brandingSchema.partial();
export type BrandingOverrides = z.output<typeof brandingOverridesSchema>;

export const lintelBranding: Branding = {
  productName: "Lintel",
  logo: null,
  logoDark: null,
  mark: null,
  favicon: null,
  accentColour: LINTEL_ACCENT_COLOUR,
  signInMessage: null,
  signInBackground: null,
  supportUrl: null,
  supportEmail: null,
  docsUrl: null,
  hideBuiltWithLintel: false,
  hideLintelHelp: false,
};

/** `GET /branding`: what every screen and the public website need. Pictures are URLs. */
export interface PublicBranding extends Branding {
  accent: AccentShades;
  /** True when nothing differs from Lintel's own look. */
  isLintelDefault: boolean;
}

/** `GET /branding/settings`: the Branding screen's form, and where its defaults came from. */
export interface BrandingSettings {
  branding: Branding;
  /** What "Reset" goes back to: Lintel's look, or the one this server was deployed with. */
  defaults: Branding;
  defaultsFromDeployment: boolean;
}

export function parseDataUrl(value: string): { type: string; bytes: Buffer } | null {
  const match = DATA_URL.exec(value);
  if (!match) return null;
  return { type: (match[1] ?? "").toLowerCase(), bytes: Buffer.from(match[2] ?? "", "base64") };
}

function isBrandingImage(value: string): boolean {
  if (value.startsWith("data:")) {
    const parsed = parseDataUrl(value);
    return parsed !== null && (brandingImageTypes as readonly string[]).includes(parsed.type);
  }
  return isWebAddress(value);
}

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "";
  } catch {
    return false;
  }
}

import { z } from "zod";
import { isPageLinkHref } from "../page-links/page-links.js";

/**
 * Prop schemas several components share. Messages are plain, because they reach editors
 * when a save is refused.
 */

/**
 * A link address: empty (no link yet), a web address, an email or phone link, a path on the
 * site, an anchor, or a page of the site chosen by its id (see page-links). `javascript:`
 * and other schemes can't be saved.
 */
export function isSafeLinkAddress(address: string): boolean {
  const trimmed = address.trim();
  return (
    trimmed === "" ||
    /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\?)/i.test(trimmed) ||
    isPageLinkHref(trimmed)
  );
}

export const linkAddressSchema = z
  .string({ error: "A link address should be text" })
  .trim()
  .max(2000, { error: "Link addresses can be at most 2000 characters" })
  .refine(isSafeLinkAddress, {
    error: "A link should start with https://, http://, mailto:, tel:, / or #",
  });

/** An image address: empty, a web address, or a path on the site. */
export function isSafeImageAddress(address: string): boolean {
  const trimmed = address.trim();
  return trimmed === "" || /^(https?:\/\/|\/(?!\/))/i.test(trimmed);
}

export const imageAddressSchema = z
  .string({ error: "An image address should be text" })
  .trim()
  .max(2000, { error: "Image addresses can be at most 2000 characters" })
  .refine(isSafeImageAddress, {
    error: "An image address should start with https://, http:// or /",
  });

export function plainText(maxLength: number, fallback = "") {
  return z
    .string({ error: "This should be text" })
    .max(maxLength, { error: `This can be at most ${maxLength} characters` })
    .default(fallback);
}

export const linkSchema = z.object({
  label: plainText(200),
  href: linkAddressSchema.default(""),
});

export type LinkProp = z.output<typeof linkSchema>;

/** A picture a code block marks as editable with `data-lintel-image`. */
export const codeImageSchema = z.object({
  src: imageAddressSchema.default(""),
  alt: plainText(500),
  assetId: z.string().max(100).nullable().default(null),
});

export type CodeImage = z.output<typeof codeImageSchema>;

/** A picture chosen in a list's item: where it is, what it shows, and its media library id. */
export const pictureSchema = z.object({
  src: imageAddressSchema.default(""),
  alt: plainText(500),
  assetId: z.string().max(100).nullable().default(null),
});

export type PictureProp = z.output<typeof pictureSchema>;

export const emptyPicture: PictureProp = { src: "", alt: "", assetId: null };

/** An icon's name in the bundled set ("star", "arrow-right"); empty for none. */
export const iconNameSchema = z
  .string({ error: "An icon should be named" })
  .regex(/^[a-z0-9-]{0,48}$/, { error: "An icon’s name should be like “arrow-right”" })
  .default("");

/** A whole number between `min` and `max`. */
export function wholeNumber(min: number, max: number, fallback: number) {
  const message = `This should be a whole number from ${min} to ${max}`;
  return z
    .number({ error: message })
    .int({ error: message })
    .min(min, { error: message })
    .max(max, { error: message })
    .default(fallback);
}

/** A list of items, each checked by `item`, with a plain message when there are too many. */
export function itemsOf<Item extends z.ZodType>(item: Item, maxItems: number, what: string) {
  return z
    .array(item, { error: `The ${what} should be a list` })
    .max(maxItems, { error: `There can be at most ${maxItems} ${what}` });
}

/** One of a few words, with the first as the default. */
export function oneOf<const Values extends readonly [string, ...string[]]>(
  values: Values,
  what: string,
) {
  return z
    .enum(values, { error: `${what} should be one of: ${values.join(", ")}` })
    .default(values[0]);
}

/**
 * An address an iframe may show: only https, and only from a host on `hosts` (or one of
 * their subdomains). Empty means "not chosen yet".
 */
export function isAllowedEmbedAddress(address: string, hosts: readonly string[]): boolean {
  const trimmed = address.trim();
  if (trimmed === "") return true;
  const hostname = /^https:\/\/([a-z0-9.-]+)(:\d+)?([/?#]\S*)?$/i.exec(trimmed)?.[1]?.toLowerCase();
  if (!hostname) return false;
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

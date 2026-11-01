import { z } from "zod";

/**
 * Prop schemas several components share. Messages are plain, because they reach editors
 * when a save is refused.
 */

/**
 * A link address: empty (no link yet), a web address, an email or phone link, a path on the
 * site, or an anchor. `javascript:` and other schemes can't be saved.
 */
export function isSafeLinkAddress(address: string): boolean {
  const trimmed = address.trim();
  return trimmed === "" || /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\?)/i.test(trimmed);
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

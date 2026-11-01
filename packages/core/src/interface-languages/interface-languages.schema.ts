import { z } from "zod";

/** The admin is written in English; every other language is a translation of it. */
export const SOURCE_INTERFACE_LANGUAGE = "en";

/**
 * A language tag such as "en", "fr-CA" or "ar". Stored in its canonical spelling
 * ("EN-gb" becomes "en-GB"). Which languages the admin has words for is the admin's
 * business: an unknown one falls back to English there, so the API only checks the shape.
 */
export const interfaceLanguageSchema = z
  .string({ error: "The language should be a language tag, such as en or fr-CA" })
  .trim()
  .transform((value, context) => {
    const canonical = canonicalLanguageTag(value);
    if (!canonical) {
      context.addIssue({
        code: "custom",
        message: `"${value}" isn't a language tag, such as en or fr-CA`,
      });
      return z.NEVER;
    }
    return canonical;
  });

/** `PUT /interface-language` and `PUT /interface-language/site-default`. Null clears the choice. */
export const chooseInterfaceLanguageRequestSchema = z.object({
  language: interfaceLanguageSchema.nullable(),
});

/** `GET /interface-language` */
export interface InterfaceLanguageResponse {
  /** What the signed-in person chose; null when signed out or when they haven't chosen. */
  personal: string | null;
  /** What everyone else sees: the site's choice, the deployment's, or English. */
  siteDefault: string;
  /** The language to show: `personal`, or else `siteDefault`. */
  active: string;
}

export function canonicalLanguageTag(value: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(value);
    return canonical ?? null;
  } catch {
    return null;
  }
}

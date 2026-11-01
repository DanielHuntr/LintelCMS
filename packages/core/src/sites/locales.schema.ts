import { z } from "zod";

/**
 * A language tag such as "fr-FR", tidied into its usual spelling ("FR-fr" becomes
 * "fr-FR"). Anything `Intl` doesn't recognise as a language tag is refused.
 */
export const localeCodeSchema = z
  .string({ error: "Please choose a language" })
  .trim()
  .min(1, { error: "Please choose a language" })
  .max(35, { error: "That language code is too long" })
  .transform((code, context) => {
    const canonical = canonicalLocale(code);
    if (canonical === null) {
      context.issues.push({
        code: "custom",
        message: `“${code}” isn't a language code. Try one like en-GB, fr or pt-BR.`,
        input: code,
      });
      return z.NEVER;
    }
    return canonical;
  });

function canonicalLocale(code: string): string | null {
  try {
    return Intl.getCanonicalLocales(code)[0] ?? null;
  } catch {
    return null;
  }
}

const localeNameSchema = z
  .string({ error: "Please give the language a name" })
  .trim()
  .min(1, { error: "Please give the language a name" })
  .max(100, { error: "Names can be at most 100 characters" });

/** `POST /locales`. Without a name, the language's English name is used ("French (France)"). */
export const addLocaleRequestSchema = z.object({
  code: localeCodeSchema,
  name: localeNameSchema.optional(),
});

/** `PATCH /locales/:code` */
export const renameLocaleRequestSchema = z.object({ name: localeNameSchema });

export const localeParamsSchema = z.object({ code: z.string() });

/** `?locale=` on admin and delivery requests. Empty means the site's default. */
export const localeQuerySchema = z.object({
  locale: z.preprocess((value) => (value === "" ? undefined : value), z.string().optional()),
});

/** A locale as the admin API returns it. */
export const localeSchema = z.object({
  code: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  /** How many entries are written in it, so the admin can warn before removing it. */
  entryCount: z.number().int(),
});

export const localeListSchema = z.object({
  defaultLocale: z.string(),
  locales: z.array(localeSchema),
});

export type AddLocaleRequest = z.infer<typeof addLocaleRequestSchema>;
export type RenameLocaleRequest = z.infer<typeof renameLocaleRequestSchema>;
export type LocaleResponse = z.infer<typeof localeSchema>;
export type LocaleListResponse = z.infer<typeof localeListSchema>;

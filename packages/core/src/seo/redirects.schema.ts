import { z } from "zod";

export const redirectStatuses = ["active", "suggested"] as const;
export const redirectSources = ["manual", "import", "automatic"] as const;

export type RedirectStatus = (typeof redirectStatuses)[number];
export type RedirectSource = (typeof redirectSources)[number];

/**
 * "/old-page", tidied: a full address loses its domain, the query and fragment go, and a
 * trailing slash is dropped, so "/about/" and "/about" are the same rule.
 *
 * Leading slashes (and backslashes, which browsers read as slashes) become one: "//evil.com"
 * is not a path but another website, so a redirect to it would send visitors off the site.
 * Tabs and line breaks go too, because browsers drop them from addresses ("/\t/evil.com").
 */
export function normaliseRedirectPath(value: string): string {
  const trimmed = value.replace(/[\t\n\r]/g, "").trim();
  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      path = new URL(trimmed).pathname;
    } catch {
      return trimmed;
    }
  }
  path = path.split(/[?#]/)[0] ?? "";
  path = `/${path.replace(/^[/\\]+/, "")}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export const fromPathSchema = z
  .string({ error: "Please enter the old address" })
  .trim()
  .min(1, { error: "Please enter the old address, like /old-page" })
  .max(2000, { error: "Addresses can be at most 2000 characters" })
  .transform(normaliseRedirectPath);

/** Where to send people: a path on the site, or a full address on another site. */
export const toPathSchema = z
  .string({ error: "Please enter the new address" })
  .trim()
  .min(1, { error: "Please enter the new address, like /new-page" })
  .max(2000, { error: "Addresses can be at most 2000 characters" })
  .refine((value) => value.startsWith("/") || /^https?:\/\/[^\s/]+/i.test(value), {
    error: "The new address should start with / or https://",
  })
  .transform((value) => (value.startsWith("/") ? normaliseRedirectPath(value) : value));

export const redirectStatusCodeSchema = z.union([z.literal(301), z.literal(302)], {
  error: "The type should be 301 (moved for good) or 302 (moved for now)",
});

/** `POST /seo/redirects` */
export const createRedirectRequestSchema = z.object({
  fromPath: fromPathSchema,
  toPath: toPathSchema,
  statusCode: redirectStatusCodeSchema.default(301),
});

/** `PATCH /seo/redirects/:id`. Sending `status: "active"` accepts a suggestion. */
export const updateRedirectRequestSchema = z.object({
  fromPath: fromPathSchema.optional(),
  toPath: toPathSchema.optional(),
  statusCode: redirectStatusCodeSchema.optional(),
  status: z.literal("active", { error: 'The status can only be set to "active"' }).optional(),
});

/** `POST /seo/redirects/import`: CSV text with "from,to" and an optional status code. */
export const importRedirectsRequestSchema = z.object({
  csv: z
    .string({ error: "Please send the CSV as text" })
    .max(1_000_000, { error: "The CSV can be at most 1 MB" }),
});

/**
 * `POST /seo/redirects/moved`: "Add redirects" after moving pages in the content tree, from
 * the old addresses the move answered with.
 */
export const movedPagesRedirectsRequestSchema = z.object({
  redirects: z
    .array(
      z.object({
        entryId: z.uuid({ error: "entryId should be an entry id" }),
        fromPath: fromPathSchema,
        toPath: toPathSchema,
      }),
    )
    .min(1, { error: "Send at least one moved page" })
    .max(5000, { error: "Send at most 5000 moved pages at once" }),
});

export const listRedirectsQuerySchema = z.object({
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(redirectStatuses, { error: 'The status should be "active" or "suggested"' }).optional(),
  ),
});

export const redirectIdParamsSchema = z.object({ id: z.uuid() });

export const redirectSchema = z.object({
  id: z.uuid(),
  fromPath: z.string(),
  toPath: z.string(),
  statusCode: z.number().int(),
  status: z.enum(redirectStatuses),
  source: z.enum(redirectSources),
  entryId: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
});

export const redirectListSchema = z.object({ redirects: z.array(redirectSchema) });

export const redirectImportResultSchema = z.object({
  added: z.number().int(),
  updated: z.number().int(),
  /** Lines that couldn't be used, with what was wrong, in plain English. */
  problems: z.array(z.object({ line: z.number().int(), message: z.string() })),
});

/** What websites read from `GET /delivery/seo-redirects`. */
export const deliveredRedirectListSchema = z.object({
  redirects: z.array(z.object({ from: z.string(), to: z.string(), statusCode: z.number().int() })),
});

export type CreateRedirectRequest = z.output<typeof createRedirectRequestSchema>;
export type UpdateRedirectRequest = z.output<typeof updateRedirectRequestSchema>;
export type RedirectResponse = z.infer<typeof redirectSchema>;
export type RedirectImportResult = z.infer<typeof redirectImportResultSchema>;
export type DeliveredRedirectList = z.infer<typeof deliveredRedirectListSchema>;

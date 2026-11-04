import { z } from "zod";
import { blueprintSchema } from "../blueprints/blueprints.schema.js";
import { entryStatuses, revisionKinds } from "./entries.table.js";

/** Values sent for an entry's fields, keyed by field handle. Checked against the blueprint. */
const entryDataSchema = z.record(z.string(), z.unknown(), {
  error: "Please send the field values as an object, keyed by field handle",
});

const slugInputSchema = z
  .string({ error: "The slug should be text" })
  .max(200, { error: "Slugs can be at most 200 characters" });

const parentIdSchema = z.uuid({ error: "The parent should be an entry id" }).nullable();

/** An empty query value (`?search=`) means the filter isn't used. */
function optionalQueryValue<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/** `GET /collections/:handle/entries` */
export const listEntriesQuerySchema = z.object({
  status: optionalQueryValue(
    z.enum(entryStatuses, { error: 'The status should be "draft", "published" or "scheduled"' }),
  ),
  search: optionalQueryValue(z.string().trim().max(200)),
  page: z.coerce.number({ error: "The page should be a number" }).int().min(1).default(1),
  perPage: z.coerce
    .number({ error: "perPage should be a number" })
    .int()
    .min(1, { error: "perPage should be at least 1" })
    .max(100, { error: "perPage can be at most 100" })
    .default(25),
  parentId: optionalQueryValue(z.uuid({ error: "parentId should be an entry id" })),
  /** Which language's entries to list. Defaults to the site's main language. */
  locale: optionalQueryValue(z.string().max(35)),
});

/** `POST /collections/:handle/entries`. Without a slug, one is made from the title. */
export const createEntryRequestSchema = z.object({
  data: entryDataSchema,
  slug: slugInputSchema.optional(),
  parentId: parentIdSchema.optional(),
  /** The language it's written in. Defaults to the site's main language. */
  locale: z.string({ error: "The locale should be a language code, like fr-FR" }).optional(),
});

/** `POST /entries/:id/copy-to-site`: start a copy of an entry on another site. */
export const copyEntryToSiteRequestSchema = z.object({
  site: z.string({ error: "Please choose a site to copy to" }).min(1, {
    error: "Please choose a site to copy to",
  }),
});

/** `POST /entries/:id/translations`: start a translation of an entry into another language. */
export const translateEntryRequestSchema = z.object({
  locale: z.string({ error: "Please choose a language to translate into" }),
  /** Also start translations of the pages above this one that have none. */
  withParents: z.boolean().default(false),
});

/**
 * `PATCH /entries/:id`. `data` is merged over the saved values, so sending one field
 * changes only that field; send null to clear one.
 */
export const updateEntryRequestSchema = z.object({
  data: entryDataSchema.optional(),
  slug: slugInputSchema.optional(),
  parentId: parentIdSchema.optional(),
  /**
   * Save version (Cmd/Ctrl+S): keep this save as a revision of its own. Left out, the save
   * joins the person's open revision, as autosaves do.
   */
  saveVersion: z.boolean().optional(),
});

/** `POST /entries/:id/schedule` */
export const scheduleEntryRequestSchema = z.object({
  publishAt: z.iso
    .datetime({
      offset: true,
      error: "publishAt should be a date and time, like 2026-11-01T09:00:00Z",
    })
    .transform((value) => new Date(value)),
});

/** Route params. An id that isn't a uuid can't belong to anything, so routes answer 404. */
export const entryIdParamsSchema = z.object({ id: z.uuid() });

export const collectionEntriesParamsSchema = z.object({ handle: z.string() });

export const revisionParamsSchema = z.object({ id: z.uuid(), revisionId: z.uuid() });

const personSchema = z.object({ id: z.uuid(), name: z.string() }).nullable();

/** An entry in a list. */
export const entrySummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(entryStatuses),
  parentId: z.uuid().nullable(),
  locale: z.string(),
  /** The entry this one is a translation of, or null for an original. */
  originId: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  scheduledFor: z.iso.datetime().nullable(),
  updatedBy: personSchema,
  /** The values of fields shown as columns in the list of entries, in the blueprint's order. */
  columns: z.array(z.object({ handle: z.string(), label: z.string(), value: z.unknown() })),
});

/** One entry with everything the editor needs to show it. */
export const entrySchema = entrySummarySchema.extend({
  collectionHandle: z.string(),
  data: z.record(z.string(), z.unknown()),
  blueprint: blueprintSchema,
  /** True when the saved values differ from the published ones still being served. */
  hasUnpublishedChanges: z.boolean(),
  /** The same entry in the site's other languages: its origin and the origin's translations. */
  translations: z.array(
    z.object({
      id: z.uuid(),
      locale: z.string(),
      title: z.string(),
      status: z.enum(entryStatuses),
    }),
  ),
  /** Who created it, for "their own content" permissions such as an Author's. */
  createdById: z.uuid().nullable(),
});

/**
 * `GET /entries/:id/live`: what the website shows now, for comparing with the saved values.
 * `data` is null while nothing is live.
 */
export const liveVersionSchema = z.object({
  publishedAt: z.iso.datetime().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
});

/** The calendar asks for a month at a time, with the days around it: never more than this. */
const MAX_SCHEDULE_DAYS = 62;

/** `GET /entries/scheduled?from=&to=`: what is due from `from` (included) until `to`. */
export const scheduledEntriesQuerySchema = z
  .object({
    from: z.iso
      .datetime({
        offset: true,
        error: "from should be a date and time, like 2026-11-01T00:00:00Z",
      })
      .transform((value) => new Date(value)),
    to: z.iso
      .datetime({ offset: true, error: "to should be a date and time, like 2026-12-01T00:00:00Z" })
      .transform((value) => new Date(value)),
  })
  .refine((range) => range.to > range.from, { error: "to should be after from" })
  .refine((range) => range.to.getTime() - range.from.getTime() <= MAX_SCHEDULE_DAYS * 86_400_000, {
    error: `Ask for at most ${MAX_SCHEDULE_DAYS} days at a time`,
  });

export const scheduledEntrySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  locale: z.string(),
  collectionHandle: z.string(),
  collectionName: z.string(),
  scheduledFor: z.iso.datetime(),
  /** Only "publish" for now: Lintel schedules publishing, not unpublishing. */
  action: z.enum(["publish"]),
});

export const scheduledEntriesResponseSchema = z.object({
  entries: z.array(scheduledEntrySchema),
});

export const entryListSchema = z.object({
  entries: z.array(entrySummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});

export const revisionSummarySchema = z.object({
  id: z.uuid(),
  /** What happened: edited, published, unpublished, scheduled or restored. */
  kind: z.enum(revisionKinds),
  createdAt: z.iso.datetime(),
  /** When it last changed. An "edited" revision keeps taking one person's autosaves. */
  updatedAt: z.iso.datetime(),
  /** For "restored": when the revision that was brought back was made. */
  restoredFromAt: z.iso.datetime().nullable(),
  author: personSchema,
});

export const revisionSchema = revisionSummarySchema.extend({
  data: z.record(z.string(), z.unknown()),
});

export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;
export type CreateEntryRequest = z.infer<typeof createEntryRequestSchema>;
export type TranslateEntryRequest = z.infer<typeof translateEntryRequestSchema>;
export type UpdateEntryRequest = z.infer<typeof updateEntryRequestSchema>;
export type EntrySummaryResponse = z.infer<typeof entrySummarySchema>;
export type EntryResponse = z.infer<typeof entrySchema>;
export type LiveVersion = z.infer<typeof liveVersionSchema>;
export type ScheduledEntriesQuery = z.infer<typeof scheduledEntriesQuerySchema>;
export type ScheduledEntriesResponse = z.infer<typeof scheduledEntriesResponseSchema>;
export type EntryTranslation = EntryResponse["translations"][number];
export type EntryListResponse = z.infer<typeof entryListSchema>;
export type Person = z.infer<typeof personSchema>;
export type RevisionSummaryResponse = z.infer<typeof revisionSummarySchema>;
export type RevisionResponse = z.infer<typeof revisionSchema>;

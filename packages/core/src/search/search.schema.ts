import { z } from "zod";
import { entryStatuses } from "../entries/entries.table.js";

/** `GET /search?q=` */
export const searchQuerySchema = z.object({
  q: z
    .string({ error: "Send what to search for as ?q=" })
    .trim()
    .max(200, { error: "Searches can be at most 200 characters" })
    .default(""),
  limit: z.coerce
    .number({ error: "limit should be a number" })
    .int()
    .min(1, { error: "limit should be at least 1" })
    .max(25, { error: "limit can be at most 25" })
    .default(8),
});

export const entrySearchResultSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(entryStatuses),
  collection: z.object({ handle: z.string(), name: z.string() }),
  updatedAt: z.iso.datetime(),
});

export const assetSearchResultSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  alt: z.string(),
  mimeType: z.string(),
  thumbnailUrl: z.string().nullable(),
});

/**
 * Results by kind, best match first. A kind the person may not see is left out entirely
 * (`null`), so the admin can tell "no matches" from "not yours to search".
 */
export const searchResultsSchema = z.object({
  query: z.string(),
  entries: z.array(entrySearchResultSchema).nullable(),
  assets: z.array(assetSearchResultSchema).nullable(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type EntrySearchResult = z.infer<typeof entrySearchResultSchema>;
export type AssetSearchResult = z.infer<typeof assetSearchResultSchema>;
export type SearchResults = z.infer<typeof searchResultsSchema>;

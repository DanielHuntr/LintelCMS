import { isDeepStrictEqual } from "node:util";
import { describeBlueprint } from "../blueprints/blueprints.service.js";
import type { EntrySummaryRow, EntryWithDetails } from "./entries.repository.js";
import type {
  EntryResponse,
  EntrySummaryResponse,
  EntryTranslation,
  Person,
} from "./entries.schema.js";

/** Turns stored rows into the shapes the API returns (see entries.schema.ts). */

export function describeEntrySummary(row: EntrySummaryRow): EntrySummaryResponse {
  return {
    id: row.id,
    title: row.title ?? "",
    slug: row.slug,
    status: row.status,
    parentId: row.parentId,
    locale: row.locale,
    originId: row.originId,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    updatedBy: describePerson(row.updatedById, row.updatedByName),
  };
}

export function describeEntry(
  { entry, collectionHandle, blueprint, updatedByName }: EntryWithDetails,
  translations: EntryTranslation[] = [],
): EntryResponse {
  const title = entry.data.title;
  return {
    ...describeEntrySummary({
      ...entry,
      title: typeof title === "string" ? title : null,
      updatedById: entry.updatedBy,
      updatedByName,
    }),
    collectionHandle,
    data: entry.data,
    blueprint: describeBlueprint(blueprint),
    hasUnpublishedChanges: hasUnpublishedChanges(entry),
    translations,
  };
}

/**
 * Compares values rather than timestamps, so saving without changing anything (or
 * restoring the published version) doesn't claim there is something new to publish.
 */
function hasUnpublishedChanges(entry: EntryWithDetails["entry"]): boolean {
  return entry.publishedData !== null && !isDeepStrictEqual(entry.data, entry.publishedData);
}

/** Someone's id and name, or null when there is nobody (or they have since been removed). */
export function describePerson(id: string | null, name: string | null): Person {
  return id !== null && name !== null ? { id, name } : null;
}

import { isDeepStrictEqual } from "node:util";
import { describeBlueprint } from "../blueprints/blueprints.service.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { EntrySummaryRow, EntryWithDetails } from "./entries.repository.js";
import type {
  EntryResponse,
  EntrySummaryResponse,
  EntryTranslation,
  Person,
} from "./entries.schema.js";

/** Turns stored rows into the shapes the API returns (see entries.schema.ts). */

/**
 * An entry in a list. `listColumns` are the blueprint's fields shown as columns ("Show as a
 * column in lists"); their values come along, with choices given by their labels.
 */
export function describeEntrySummary(
  row: Omit<EntrySummaryRow, "data"> & { data?: EntrySummaryRow["data"] },
  listColumns: readonly FieldDefinition[] = [],
): EntrySummaryResponse {
  return {
    columns: listColumns.map((field) => ({
      handle: field.handle,
      label: field.label,
      value: columnValue(field, row.data?.[field.handle] ?? null),
    })),
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

function columnValue(field: FieldDefinition, value: unknown): unknown {
  const choices = field.options.choices as { value: string; label: string }[] | undefined;
  if (!choices) return value;
  const label = (choice: unknown) =>
    choices.find((candidate) => candidate.value === choice)?.label ?? choice;
  return Array.isArray(value) ? value.map(label) : label(value);
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
    createdById: entry.createdBy,
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

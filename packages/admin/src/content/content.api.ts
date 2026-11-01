import { apiRequest } from "../api/client.js";
import type { EntryData } from "../fields/field.types.js";
import type { Collection, Entry, EntryPage, Revision } from "./content.types.js";
import { entriesListPath, type EntriesFilter } from "./entriesQuery.js";
import { slugFromTitle } from "./slug.js";

/** Calls to the content API's collection and entry routes. One function per route. */

export async function listCollections(): Promise<Collection[]> {
  const { collections } = await apiRequest<{ collections: Collection[] }>("/collections");
  return collections;
}

export function getCollection(handle: string): Promise<Collection> {
  return apiRequest<Collection>(`/collections/${encodeURIComponent(handle)}`);
}

export interface NewCollection {
  handle: string;
  name: string;
  blueprintHandle: string;
  structure: Collection["structure"];
  routePattern?: string;
}

export function createCollection(collection: NewCollection): Promise<Collection> {
  return apiRequest<Collection>("/collections", { method: "POST", body: collection });
}

export function listEntries(collectionHandle: string, filter: EntriesFilter): Promise<EntryPage> {
  return apiRequest<EntryPage>(entriesListPath(collectionHandle, filter));
}

export function getEntry(entryId: string): Promise<Entry> {
  return apiRequest<Entry>(`/entries/${entryId}`);
}

/** What the editor sends when it saves. */
export interface EntryChanges {
  data: EntryData;
  slug: string;
  parentId: string | null;
}

export function createEntry(
  collectionHandle: string,
  changes: EntryChanges,
  locale?: string,
): Promise<Entry> {
  return apiRequest<Entry>(`/collections/${encodeURIComponent(collectionHandle)}/entries`, {
    method: "POST",
    // The API generates a slug from the title when none is given, and takes no null parent.
    body: {
      data: changes.data,
      slug: slugForSaving(changes.slug),
      parentId: changes.parentId ?? undefined,
      locale,
    },
  });
}

/** Starts a draft translation of an entry into another of the site's languages. */
export function translateEntry(entryId: string, locale: string): Promise<Entry> {
  return apiRequest<Entry>(`/entries/${entryId}/translations`, {
    method: "POST",
    body: { locale },
  });
}

export function updateEntry(entryId: string, changes: EntryChanges): Promise<Entry> {
  return apiRequest<Entry>(`/entries/${entryId}`, {
    method: "PATCH",
    body: { data: changes.data, slug: slugForSaving(changes.slug), parentId: changes.parentId },
  });
}

/** A slug being typed can end in a hyphen; the saved one can't. Blank lets the API choose. */
function slugForSaving(slug: string): string | undefined {
  return slugFromTitle(slug) || undefined;
}

export function publishEntry(entryId: string): Promise<Entry> {
  return apiRequest<Entry>(`/entries/${entryId}/publish`, { method: "POST" });
}

export function unpublishEntry(entryId: string): Promise<Entry> {
  return apiRequest<Entry>(`/entries/${entryId}/unpublish`, { method: "POST" });
}

export function scheduleEntry(entryId: string, publishAt: string): Promise<Entry> {
  return apiRequest<Entry>(`/entries/${entryId}/schedule`, {
    method: "POST",
    body: { publishAt },
  });
}

export function deleteEntry(entryId: string): Promise<void> {
  return apiRequest<void>(`/entries/${entryId}`, { method: "DELETE" });
}

export interface EntryPosition {
  id: string;
  parentId: string | null;
}

export function reorderEntries(collectionHandle: string, order: EntryPosition[]): Promise<void> {
  return apiRequest<void>(`/collections/${encodeURIComponent(collectionHandle)}/entries/reorder`, {
    method: "POST",
    body: { order },
  });
}

export async function listRevisions(entryId: string): Promise<Revision[]> {
  const { revisions } = await apiRequest<{ revisions: Revision[] }>(
    `/entries/${entryId}/revisions`,
  );
  return revisions;
}

export function restoreRevision(entryId: string, revisionId: string): Promise<Entry> {
  return apiRequest<Entry>(`/entries/${entryId}/revisions/${revisionId}/restore`, {
    method: "POST",
  });
}

import type { DatabaseOrTransaction } from "../database/client.js";
import type { ContentReferences } from "../fieldtypes/content-references.js";
import { findTermIdsInTaxonomy } from "../taxonomies/terms.repository.js";
import { findExistingUserIds } from "../users/users.repository.js";
import {
  findEntryValuesMentioning,
  findExistingEntryIds,
  updateEntryRow,
} from "./entries.repository.js";
import type { EntryData } from "./entries.table.js";

/**
 * Entries point at other content through the `entries` and `terms` fieldtypes, which
 * store lists of ids. This file checks those ids when an entry is saved, and takes an id
 * out of every entry when what it points at is deleted, so a stale id never stops an
 * editor saving an unrelated change.
 */

export function createContentReferences(database: DatabaseOrTransaction): ContentReferences {
  return {
    async findMissingTermIds(taxonomyHandle, termIds) {
      const existing = new Set(await findTermIdsInTaxonomy(database, taxonomyHandle, termIds));
      return termIds.filter((termId) => !existing.has(termId));
    },
    async findMissingEntryIds(collectionHandles, entryIds) {
      const existing = new Set(await findExistingEntryIds(database, entryIds, collectionHandles));
      return entryIds.filter((entryId) => !existing.has(entryId));
    },
    async findMissingUserIds(userIds) {
      const existing = new Set(await findExistingUserIds(database, userIds));
      return userIds.filter((userId) => !existing.has(userId));
    },
  };
}

/**
 * Removes `id` from every list of ids in every entry's saved and published values. Only
 * lists change: a single value equal to the id (an image) is left for its own feature.
 */
export async function removeReferencesFromEntries(
  database: DatabaseOrTransaction,
  id: string,
): Promise<void> {
  const entries = await findEntryValuesMentioning(database, id);
  for (const entry of entries) {
    await updateEntryRow(database, entry.id, {
      data: withoutListedId(entry.data, id),
      publishedData: entry.publishedData && withoutListedId(entry.publishedData, id),
    });
  }
}

export function withoutListedId(data: EntryData, id: string): EntryData {
  return Object.fromEntries(
    Object.entries(data).map(([handle, value]) => [
      handle,
      Array.isArray(value) ? value.filter((item) => item !== id) : value,
    ]),
  );
}

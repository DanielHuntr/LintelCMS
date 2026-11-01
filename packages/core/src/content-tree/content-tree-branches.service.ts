import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { duplicateEntry } from "../entries/entry-duplication.service.js";
import { publishEntry, unpublishEntry } from "../entries/entry-publishing.service.js";
import type { EntryResponse } from "../entries/entries.schema.js";
import {
  createEntry,
  type EntryChangeContext,
  findEntry,
  findEntryOrFail,
} from "../entries/entries.service.js";
import { HttpError } from "../http/http-errors.js";
import { findNodeRows, listChildLinks } from "./content-tree.repository.js";
import type { BatchResult } from "./content-tree.schema.js";

/**
 * Acting on a whole branch of the tree: an entry and everything under it, in any collection.
 * Branches are walked a level at a time, so a deep tree costs one query per level.
 */

/** The entry and everything under it, each parent before its children. */
export async function listBranchIds(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<string[]> {
  const ids = [entryId];
  const seen = new Set(ids);
  let level = [entryId];
  while (level.length > 0) {
    const children = (await listChildLinks(database, level)).filter((child) => !seen.has(child.id));
    children.forEach((child) => seen.add(child.id));
    ids.push(...children.map((child) => child.id));
    level = children.map((child) => child.id);
  }
  return ids;
}

/** Asks the features that may refuse a publish (content approval) before it happens. */
export type PublishCheck = (entryId: string) => Promise<void>;

/**
 * Publishes the entries, one at a time, so one that isn't ready (a required field left
 * empty, or waiting for approval) is reported and the rest still go live. Entries already
 * live with nothing new are left alone.
 */
export async function publishEntries(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
  context: EntryChangeContext,
  mayPublish: PublishCheck,
): Promise<BatchResult> {
  const result: BatchResult = { changed: [], skipped: [] };
  const rows = new Map((await findNodeRows(database, entryIds)).map((row) => [row.id, row]));
  for (const entryId of entryIds) {
    const row = rows.get(entryId);
    if (!row || (row.status === "published" && !row.hasUnpublishedChanges)) {
      continue;
    }
    try {
      await mayPublish(entryId);
      await publishEntry(database, entryId, context);
      result.changed.push(entryId);
    } catch (error) {
      if (!(error instanceof HttpError)) {
        throw error;
      }
      result.skipped.push({ id: entryId, title: row.title ?? "", reason: error.message });
    }
  }
  return result;
}

/** Takes the entries off the site (and cancels their schedules); drafts are left alone. */
export async function unpublishEntries(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
  authorId: string | null,
): Promise<BatchResult> {
  const result: BatchResult = { changed: [], skipped: [] };
  const rows = await findNodeRows(database, entryIds);
  const notDrafts = new Set(rows.filter((row) => row.status !== "draft").map((row) => row.id));
  for (const entryId of entryIds) {
    if (notDrafts.has(entryId)) {
      await unpublishEntry(database, entryId, authorId);
      result.changed.push(entryId);
    }
  }
  return result;
}

/**
 * "Duplicate": a draft copy straight after the original, and with `includeDescendants`
 * a copy of everything under it too, in the same order. Copies under the first one keep
 * their titles; their slugs get a number when the original's is taken.
 */
export async function duplicateBranch(
  database: DatabaseOrTransaction,
  entryId: string,
  includeDescendants: boolean,
  context: EntryChangeContext,
): Promise<{ entry: EntryResponse; copied: number }> {
  const copy = await duplicateEntry(database, entryId, context);
  let copied = 1;
  if (includeDescendants) {
    let level = [{ originalId: entryId, copyId: copy.id }];
    while (level.length > 0) {
      const next: typeof level = [];
      for (const { originalId, copyId } of level) {
        for (const child of await listChildLinks(database, [originalId])) {
          const original = await findEntryOrFail(database, child.id);
          const collection = await findCollectionByIdOrFail(database, original.collectionId);
          const created = await createEntry(
            database,
            collection.handle,
            { data: original.data, parentId: copyId, locale: original.locale },
            context,
          );
          next.push({ originalId: child.id, copyId: created.id });
          copied += 1;
        }
      }
      level = next;
    }
  }
  return { entry: await findEntry(database, copy.id), copied };
}

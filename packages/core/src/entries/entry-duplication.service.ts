import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findSiteByIdOrFail } from "../sites/sites.service.js";
import {
  createEntry,
  type EntryChangeContext,
  findEntry,
  findEntryOrFail,
} from "./entries.service.js";
import { makeRoomAfter, updateEntryPosition } from "./entries.repository.js";
import type { EntryResponse } from "./entries.schema.js";

/** Added to the title of a copy, so the two are easy to tell apart in lists. */
const COPY_SUFFIX = " (copy)";

/**
 * "Duplicate entry": a new draft with the same values (the saved working copy, not the
 * published one), titled "… (copy)" with a slug of its own, under the same parent and
 * placed straight after the original. Nothing about the copy is live until it's published.
 */
export async function duplicateEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  context: EntryChangeContext,
): Promise<EntryResponse> {
  const original = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, original.collectionId);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const titleLimit = blueprint.fields.find((field) => field.handle === "title")?.options.maxLength;

  const copy = await createEntry(
    database,
    collection.handle,
    {
      data: { ...original.data, title: copyTitle(original.data.title, titleLimit) },
      parentId: original.parentId,
    },
    context,
    await findSiteByIdOrFail(database, original.siteId),
  );

  if (collection.structure !== "dated") {
    await database.transaction(async (transaction) => {
      await makeRoomAfter(transaction, collection.id, original.parentId, original.sortOrder);
      await updateEntryPosition(transaction, copy.id, {
        parentId: original.parentId,
        sortOrder: original.sortOrder + 1,
      });
    });
  }
  return findEntry(database, copy.id);
}

/** "About us" becomes "About us (copy)", shortened if the title field has a limit. */
export function copyTitle(title: unknown, maxLength: unknown): string {
  const original = typeof title === "string" ? title : "";
  const limit = typeof maxLength === "number" ? maxLength : Number.POSITIVE_INFINITY;
  const room = Math.max(0, limit - COPY_SUFFIX.length);
  return `${original.slice(0, room).trimEnd()}${COPY_SUFFIX}`.slice(0, limit);
}

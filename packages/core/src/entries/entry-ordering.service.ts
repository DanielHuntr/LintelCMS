import { findCollectionOrFail } from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { hasParentLoop } from "./entry-tree.js";
import {
  EntryNotInCollectionError,
  InvalidParentError,
  ReorderNotAllowedError,
} from "./entries.errors.js";
import { findEntryById, listEntryPositions, updateEntryPosition } from "./entries.repository.js";
import type { ReorderEntriesRequest } from "./entries.schema.js";

/**
 * Where entries sit: parents in a tree, and the hand-set order of tree and flat
 * collections. Dated collections are always newest first, so they have neither.
 */

/**
 * Checks that `parentId` can be the parent of `entryId` (or of a new entry, when
 * `entryId` is left out): the collection is a tree, the parent is in it (and in the same
 * language, when `locale` is given), and the move doesn't put an entry under itself or one
 * of its own children.
 */
export async function checkParent(
  database: DatabaseOrTransaction,
  collection: Collection,
  parentId: string | null,
  entryId?: string,
  locale?: string,
): Promise<void> {
  if (parentId === null) {
    return;
  }
  if (collection.structure !== "tree") {
    throw new InvalidParentError(
      `${collection.name} isn't a tree, so its entries can't have parents.`,
    );
  }
  if (parentId === entryId) {
    throw new InvalidParentError("An entry can't be its own parent.");
  }
  const parent = await findEntryById(database, parentId);
  if (!parent || parent.collectionId !== collection.id) {
    throw new InvalidParentError(`The parent has to be another entry in ${collection.name}.`);
  }
  if (locale !== undefined && parent.locale !== locale) {
    throw new InvalidParentError("The parent has to be written in the same language.");
  }
  if (entryId === undefined) {
    return;
  }

  const positions = await listEntryPositions(database, collection.id);
  const parentOf = new Map(positions.map((position) => [position.id, position.parentId]));
  parentOf.set(entryId, parentId);
  if (hasParentLoop(entryId, parentOf)) {
    throw new InvalidParentError("An entry can't be moved under one of its own children.");
  }
}

/**
 * Puts the listed entries in the order given, with the parents given. Each entry's place
 * is counted among the listed entries with the same parent, so sending a whole tree (or
 * all the children of one parent) gives exactly that order. Entries left out keep theirs.
 */
export async function reorderEntries(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  request: ReorderEntriesRequest,
): Promise<void> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  if (collection.structure === "dated") {
    throw new ReorderNotAllowedError(collection.name);
  }

  const positions = await listEntryPositions(database, collection.id);
  const parentOf = new Map(positions.map((position) => [position.id, position.parentId]));
  const listed = new Set<string>();
  for (const { id, parentId } of request.order) {
    if (!parentOf.has(id) || listed.has(id)) {
      throw new EntryNotInCollectionError(id, collection.name);
    }
    if (parentId !== null && collection.structure !== "tree") {
      throw new InvalidParentError(
        `${collection.name} isn't a tree, so its entries can't have parents.`,
      );
    }
    if (parentId !== null && !parentOf.has(parentId)) {
      throw new InvalidParentError(`The parent has to be another entry in ${collection.name}.`);
    }
    listed.add(id);
    parentOf.set(id, parentId);
  }
  if ([...listed].some((id) => hasParentLoop(id, parentOf))) {
    throw new InvalidParentError("An entry can't be moved under one of its own children.");
  }

  const nextPlaceByParent = new Map<string | null, number>();
  await database.transaction(async (transaction) => {
    for (const { id, parentId } of request.order) {
      const sortOrder = nextPlaceByParent.get(parentId) ?? 0;
      nextPlaceByParent.set(parentId, sortOrder + 1);
      await updateEntryPosition(transaction, id, { parentId, sortOrder });
    }
  });
}

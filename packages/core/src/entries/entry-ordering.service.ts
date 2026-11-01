import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { InvalidParentError, PlacementNotAllowedError } from "./entries.errors.js";
import { findAncestorIds, findEntryById } from "./entries.repository.js";

/**
 * Where entries sit: parents in a tree, and the hand-set order of tree and flat
 * collections. Dated collections are always newest first, so they have neither.
 */

/**
 * Checks that `parentId` can be the parent of `entryId` (or of a new entry, when
 * `entryId` is left out). At the top level, the collection has to allow that. Under a
 * parent, the collection has to be a tree, the parent's collection has to allow this kind
 * of child (pages allow pages, unless their content type says otherwise), the parent has to
 * be in the same language (when `locale` is given), and the move mustn't put an entry
 * under itself or one of its own children. Parents can be in another collection: a landing
 * page can sit under a page when Pages allows landing pages.
 */
export async function checkParent(
  database: DatabaseOrTransaction,
  collection: Collection,
  parentId: string | null,
  entryId?: string,
  locale?: string,
  siteId?: string,
): Promise<void> {
  if (parentId === null) {
    if (!collection.allowedAtRoot) {
      throw new PlacementNotAllowedError(
        `${collection.name} can't go at the top level. Put it under another page instead.`,
      );
    }
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
  if (!parent) {
    throw new InvalidParentError(`The parent has to be another entry in ${collection.name}.`);
  }
  if (siteId !== undefined && parent.siteId !== siteId) {
    throw new InvalidParentError("The parent has to be on the same site.");
  }
  const parentCollection =
    parent.collectionId === collection.id
      ? collection
      : await findCollectionByIdOrFail(database, parent.collectionId);
  if (!parentCollection.allowedChildren.includes(collection.handle)) {
    throw new PlacementNotAllowedError(
      `${collection.name} can't go under an entry in ${parentCollection.name}.`,
    );
  }
  if (locale !== undefined && parent.locale !== locale) {
    throw new InvalidParentError("The parent has to be written in the same language.");
  }
  if (entryId === undefined) {
    return;
  }
  const ancestors = await findAncestorIds(database, parentId);
  if (ancestors.includes(entryId)) {
    throw new InvalidParentError("An entry can't be moved under one of its own children.");
  }
}

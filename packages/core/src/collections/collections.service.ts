import {
  type BlueprintDefaults,
  ensureBlueprint,
  findBlueprintOrFail,
} from "../blueprints/blueprints.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { isUniqueViolation } from "../database/database-errors.js";
import { clearParentsInCollection } from "../entries/entries.repository.js";
import {
  CollectionHandleTakenError,
  CollectionNotEmptyError,
  CollectionNotFoundError,
} from "./collections.errors.js";
import {
  type CollectionWithDetails,
  deleteCollectionRow,
  findCollectionByHandle,
  findCollectionById,
  findCollectionWithDetails,
  insertCollection,
  insertCollectionIfMissing,
  listCollectionsWithDetails,
  updateCollectionRow,
} from "./collections.repository.js";
import type {
  CollectionResponse,
  CollectionStructure,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from "./collections.schema.js";
import { defaultAllowedChildren } from "./collections.schema.js";
import type { Collection } from "./collections.table.js";

/** Business rules for collections: groups of entries that share a blueprint. */

export function describeCollection(collection: CollectionWithDetails): CollectionResponse {
  return {
    id: collection.id,
    handle: collection.handle,
    name: collection.name,
    blueprintHandle: collection.blueprintHandle,
    structure: collection.structure,
    routePattern: collection.routePattern,
    previewUrlPattern: collection.previewUrlPattern,
    allowedAtRoot: collection.allowedAtRoot,
    allowedChildren: collection.allowedChildren,
    childrenAsCollection: collection.childrenAsCollection,
    listColumns: collection.listColumns,
    entryCount: collection.entryCount,
    updatedAt: collection.updatedAt.toISOString(),
  };
}

export async function listCollections(
  database: DatabaseOrTransaction,
): Promise<{ collections: CollectionResponse[] }> {
  const collections = await listCollectionsWithDetails(database, DEFAULT_TENANT_ID);
  return { collections: collections.map(describeCollection) };
}

export async function findCollection(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<CollectionResponse> {
  const collection = await findCollectionWithDetails(database, DEFAULT_TENANT_ID, handle);
  if (!collection) {
    throw new CollectionNotFoundError(handle);
  }
  return describeCollection(collection);
}

/** The stored collection, or a 404 that names the handle. */
export async function findCollectionOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<Collection> {
  const collection = await findCollectionByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!collection) {
    throw new CollectionNotFoundError(handle);
  }
  return collection;
}

/** The collection an entry belongs to. A missing one means the database was edited by hand. */
export async function findCollectionByIdOrFail(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<Collection> {
  const collection = await findCollectionById(database, collectionId);
  if (!collection) {
    throw new Error(`The collection ${collectionId} is missing.`);
  }
  return collection;
}

export async function createCollection(
  database: DatabaseOrTransaction,
  request: CreateCollectionRequest,
): Promise<CollectionResponse> {
  const blueprint = await findBlueprintOrFail(database, request.blueprintHandle);
  if (await findCollectionByHandle(database, DEFAULT_TENANT_ID, request.handle)) {
    throw new CollectionHandleTakenError(request.handle);
  }

  try {
    await insertCollection(database, {
      handle: request.handle,
      name: request.name,
      blueprintId: blueprint.id,
      structure: request.structure,
      routePattern:
        request.routePattern === undefined ? `/${request.handle}/{slug}` : request.routePattern,
      previewUrlPattern: request.previewUrlPattern ?? null,
      allowedAtRoot: request.allowedAtRoot ?? true,
      allowedChildren:
        request.allowedChildren ?? defaultAllowedChildren(request.handle, request.structure),
      childrenAsCollection: request.childrenAsCollection ?? false,
      listColumns: request.listColumns ?? [],
    });
  } catch (error) {
    // Someone else created the same handle between the check and the insert.
    if (isUniqueViolation(error)) {
      throw new CollectionHandleTakenError(request.handle);
    }
    throw error;
  }
  return findCollection(database, request.handle);
}

/**
 * Changes what was sent and leaves the rest. Moving a tree collection to another
 * structure flattens it: its entries keep their order but lose their parents, since only
 * trees have parents.
 */
export async function updateCollection(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateCollectionRequest,
): Promise<CollectionResponse> {
  const collection = await findCollectionOrFail(database, handle);
  const blueprint = request.blueprintHandle
    ? await findBlueprintOrFail(database, request.blueprintHandle)
    : undefined;

  await database.transaction(async (transaction) => {
    await updateCollectionRow(transaction, collection.id, {
      name: request.name,
      blueprintId: blueprint?.id,
      structure: request.structure,
      routePattern: request.routePattern,
      previewUrlPattern: request.previewUrlPattern,
      allowedAtRoot: request.allowedAtRoot,
      allowedChildren: request.allowedChildren,
      childrenAsCollection: request.childrenAsCollection,
      listColumns: request.listColumns,
    });
    if (collection.structure === "tree" && request.structure && request.structure !== "tree") {
      await clearParentsInCollection(transaction, collection.id);
    }
  });
  return findCollection(database, handle);
}

/** Refuses while the collection has entries, so deleting one never loses content silently. */
export async function deleteCollection(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<void> {
  const collection = await findCollectionWithDetails(database, DEFAULT_TENANT_ID, handle);
  if (!collection) {
    throw new CollectionNotFoundError(handle);
  }
  if (collection.entryCount > 0) {
    throw new CollectionNotEmptyError(collection.name, collection.entryCount);
  }
  await deleteCollectionRow(database, collection.id);
}

export interface CollectionDefaults {
  handle: string;
  name: string;
  structure: CollectionStructure;
  routePattern: string;
  blueprint: BlueprintDefaults;
}

/**
 * Makes sure a collection with this handle exists, creating it (and its blueprint, if
 * that is missing too) from `defaults`. Safe to call any number of times, and it never
 * changes a collection or blueprint that is already there.
 */
export async function ensureCollection(
  database: DatabaseOrTransaction,
  defaults: CollectionDefaults,
): Promise<void> {
  if (await findCollectionByHandle(database, DEFAULT_TENANT_ID, defaults.handle)) {
    return;
  }
  const blueprint = await ensureBlueprint(database, defaults.blueprint);
  await insertCollectionIfMissing(database, {
    handle: defaults.handle,
    name: defaults.name,
    blueprintId: blueprint.id,
    structure: defaults.structure,
    routePattern: defaults.routePattern,
    allowedChildren: defaultAllowedChildren(defaults.handle, defaults.structure),
  });
}

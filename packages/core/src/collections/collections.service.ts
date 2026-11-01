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
  CollectionHasSiteEntriesError,
  CollectionNotEmptyError,
  CollectionNotFoundError,
  CollectionNotOnSiteError,
} from "./collections.errors.js";
import {
  type CollectionWithDetails,
  countEntriesOutsideSite,
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
import type { Collection } from "./collections.table.js";
import { findOrCreateDefaultSite, findSiteOrFail, siteOrDefault } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";

/**
 * Business rules for collections: groups of entries that share a blueprint.
 *
 * With several sites, a collection is either per site (each site has its own entries, and
 * `siteIds` may limit which sites have it) or shared (every site shows the same entries,
 * kept with the default site). Lookups given a site only find the collections it has.
 */

/** Whether a site has this collection. */
export function isCollectionOnSite(
  collection: Pick<Collection, "siteScope" | "siteIds">,
  site: Pick<Site, "id">,
): boolean {
  return (
    collection.siteScope === "shared" ||
    collection.siteIds === null ||
    collection.siteIds.includes(site.id)
  );
}

/** The site a collection's entries are kept with, for a request about `site`. */
export async function entrySiteFor(
  database: DatabaseOrTransaction,
  collection: Pick<Collection, "siteScope">,
  site: Site | undefined,
): Promise<Site> {
  return collection.siteScope === "shared"
    ? findOrCreateDefaultSite(database)
    : siteOrDefault(database, site);
}

async function findSiteIdsForHandles(
  database: DatabaseOrTransaction,
  siteHandles: readonly string[] | null,
): Promise<string[] | null> {
  if (siteHandles === null) {
    return null;
  }
  const sites = await Promise.all(
    [...new Set(siteHandles)].map((handle) => findSiteOrFail(database, handle)),
  );
  return sites.map((site) => site.id);
}

export function describeCollection(collection: CollectionWithDetails): CollectionResponse {
  return {
    id: collection.id,
    handle: collection.handle,
    name: collection.name,
    blueprintHandle: collection.blueprintHandle,
    structure: collection.structure,
    routePattern: collection.routePattern,
    previewUrlPattern: collection.previewUrlPattern,
    siteScope: collection.siteScope,
    siteIds: collection.siteIds,
    entryCount: collection.entryCount,
    updatedAt: collection.updatedAt.toISOString(),
  };
}

/** Every collection, or with a site only those it has. */
export async function listCollections(
  database: DatabaseOrTransaction,
  site?: Site,
): Promise<{ collections: CollectionResponse[] }> {
  const collections = await listCollectionsWithDetails(database, DEFAULT_TENANT_ID);
  return {
    collections: collections
      .filter((collection) => site === undefined || isCollectionOnSite(collection, site))
      .map(describeCollection),
  };
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

/** The stored collection, or a 404 that names the handle (or the site that doesn't have it). */
export async function findCollectionOrFail(
  database: DatabaseOrTransaction,
  handle: string,
  site?: Site,
): Promise<Collection> {
  const collection = await findCollectionByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!collection) {
    throw new CollectionNotFoundError(handle);
  }
  if (site !== undefined && !isCollectionOnSite(collection, site)) {
    throw new CollectionNotOnSiteError(handle, site.name);
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
      siteScope: request.siteScope,
      siteIds: await findSiteIdsForHandles(database, request.siteHandles),
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
  if (request.siteScope === "shared" && collection.siteScope !== "shared") {
    const defaultSite = await findOrCreateDefaultSite(database);
    const elsewhere = await countEntriesOutsideSite(database, collection.id, defaultSite.id);
    if (elsewhere > 0) {
      throw new CollectionHasSiteEntriesError(collection.name, elsewhere);
    }
  }
  const siteIds =
    request.siteHandles === undefined
      ? undefined
      : await findSiteIdsForHandles(database, request.siteHandles);

  await database.transaction(async (transaction) => {
    await updateCollectionRow(transaction, collection.id, {
      name: request.name,
      blueprintId: blueprint?.id,
      structure: request.structure,
      routePattern: request.routePattern,
      previewUrlPattern: request.previewUrlPattern,
      siteScope: request.siteScope,
      siteIds,
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
  });
}

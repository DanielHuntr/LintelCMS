import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import {
  findCollectionByIdOrFail,
  findCollectionOrFail,
} from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { isUniqueViolation } from "../database/database-errors.js";
import { buildEntryDataValidator } from "../fieldtypes/entry-data-validator.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import { checkParent } from "./entry-ordering.service.js";
import { describeEntry } from "./entry-responses.js";
import { EntryNotFoundError } from "./entries.errors.js";
import {
  clearOriginReferences,
  deleteEntryRow,
  findEntriesMentioning,
  findEntryById,
  findEntryWithDetails,
  findNextSortOrder,
  findSlugsStartingWith,
  insertEntry,
  moveChildrenToParent,
  updateEntryRow,
} from "./entries.repository.js";
import type { CreateEntryRequest, EntryResponse, UpdateEntryRequest } from "./entries.schema.js";
import type { Entry, EntryData } from "./entries.table.js";
import { firstFreeSlug, slugify } from "./slugs.js";
import { insertRevision } from "./revisions.repository.js";

/**
 * Creating, saving and deleting entries. Publishing is in entry-publishing.service.ts,
 * ordering in entry-ordering.service.ts and revisions in revisions.service.ts.
 */

/** Who is making a change, and how to check the images they picked. */
export interface EntryChangeContext {
  authorId: string | null;
  assetExists: AssetExists;
}

const SLUG_INDEX = "entries_collection_site_slug_unique";

/** The entry as the API returns it, or a 404. */
export async function findEntry(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<EntryResponse> {
  const found = await findEntryWithDetails(database, entryId);
  if (!found) {
    throw new EntryNotFoundError();
  }
  return describeEntry(found);
}

/** The stored entry, or a 404. */
export async function findEntryOrFail(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<Entry> {
  const entry = await findEntryById(database, entryId);
  if (!entry) {
    throw new EntryNotFoundError();
  }
  return entry;
}

/** A new draft at the end of its siblings, with a slug made from the title if none was sent. */
export async function createEntry(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  request: CreateEntryRequest,
  context: EntryChangeContext,
): Promise<EntryResponse> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  const data = await validateForCollection(database, collection, request.data, context);
  const parentId = request.parentId ?? null;
  await checkParent(database, collection, parentId);
  const site = await findOrCreateDefaultSite(database);
  const scope = { collectionId: collection.id, siteId: site.id };
  const slug = await chooseSlug(database, scope, request.slug, data, collection.name);

  const entry = await withFriendlySlugConflict(collection.name, () =>
    database.transaction(async (transaction) => {
      const created = await insertEntry(transaction, {
        ...scope,
        slug,
        parentId,
        data,
        sortOrder: await findNextSortOrder(transaction, collection.id, parentId),
        createdBy: context.authorId,
        updatedBy: context.authorId,
      });
      await insertRevision(transaction, {
        entryId: created.id,
        authorId: context.authorId,
        action: "saved",
        data,
      });
      return created;
    }),
  );
  return findEntry(database, entry.id);
}

/**
 * Saves new values, slug or parent and records a "saved" revision. A published entry stays
 * live with its published values until it is published again.
 */
export async function saveEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  request: UpdateEntryRequest,
  context: EntryChangeContext,
): Promise<EntryResponse> {
  const entry = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const data = await validateForCollection(
    database,
    collection,
    { ...entry.data, ...request.data },
    context,
  );
  if (request.parentId !== undefined) {
    await checkParent(database, collection, request.parentId, entry.id);
  }
  const slug =
    request.slug === undefined
      ? entry.slug
      : await chooseSlug(
          database,
          { collectionId: collection.id, siteId: entry.siteId, exceptEntryId: entry.id },
          request.slug,
          data,
          collection.name,
        );

  await withFriendlySlugConflict(collection.name, () =>
    database.transaction(async (transaction) => {
      await updateEntryRow(transaction, entry.id, {
        data,
        slug,
        parentId: request.parentId === undefined ? entry.parentId : request.parentId,
        updatedBy: context.authorId,
      });
      await insertRevision(transaction, {
        entryId: entry.id,
        authorId: context.authorId,
        action: "saved",
        data,
      });
    }),
  );
  return findEntry(database, entry.id);
}

/** Deletes the entry and its revisions. Its child pages move up to its own parent. */
export async function deleteEntry(database: DatabaseOrTransaction, entryId: string): Promise<void> {
  const entry = await findEntryOrFail(database, entryId);
  await database.transaction(async (transaction) => {
    await moveChildrenToParent(transaction, entry.id, entry.parentId);
    await clearOriginReferences(transaction, entry.id);
    await deleteEntryRow(transaction, entry.id);
  });
}

/**
 * Entries that use an image (or anything else with this id), for the media library to
 * say what would break before an image is deleted.
 */
export async function findEntriesUsingAsset(
  database: DatabaseOrTransaction,
  assetId: string,
): Promise<{ entryId: string; title: string }[]> {
  const entries = await findEntriesMentioning(database, assetId);
  return entries.map((entry) => ({ entryId: entry.entryId, title: entry.title ?? "" }));
}

/** Checks values against the collection's blueprint; see entry-data-validator.ts. */
export async function validateForCollection(
  database: DatabaseOrTransaction,
  collection: Collection,
  data: EntryData,
  context: Pick<EntryChangeContext, "assetExists">,
): Promise<EntryData> {
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const validate = buildEntryDataValidator(blueprint.fields, { assetExists: context.assetExists });
  return validate(data);
}

/**
 * A slug the editor typed is tidied up and must be free; one made from the title gets a
 * number added until it is free, so creating "Hello" twice just works.
 */
async function chooseSlug(
  database: DatabaseOrTransaction,
  scope: { collectionId: string; siteId: string; exceptEntryId?: string },
  requested: string | undefined,
  data: EntryData,
  collectionName: string,
): Promise<string> {
  if (requested !== undefined) {
    const slug = slugify(requested);
    if (slug === "") {
      throw new InvalidFieldsError({ slug: "The slug needs at least one letter or number" });
    }
    const taken = await findSlugsStartingWith(database, scope, slug);
    if (taken.includes(slug)) {
      throw slugTakenError(collectionName);
    }
    return slug;
  }

  const base = slugify(typeof data.title === "string" ? data.title : "") || "entry";
  const taken = await findSlugsStartingWith(database, scope, base);
  return firstFreeSlug(base, new Set(taken));
}

/** Two saves racing for the same slug: the loser gets the same message as a taken slug. */
async function withFriendlySlugConflict<Result>(
  collectionName: string,
  write: () => Promise<Result>,
): Promise<Result> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error, SLUG_INDEX)) {
      throw slugTakenError(collectionName);
    }
    throw error;
  }
}

function slugTakenError(collectionName: string): InvalidFieldsError {
  return new InvalidFieldsError({
    slug: `Another entry in ${collectionName} already uses this slug`,
  });
}

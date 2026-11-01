import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import {
  entrySiteFor,
  findCollectionByIdOrFail,
  findCollectionOrFail,
} from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { isUniqueViolation } from "../database/database-errors.js";
import { buildEntryDataValidator } from "../fieldtypes/entry-data-validator.js";
import { removeReferencesFromGlobalValues } from "../globals/global-references.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { findPageCodeContext } from "../pages/page-code.service.js";
import { resolveLocale } from "../sites/locales.service.js";
import type { Site } from "../sites/sites.table.js";
import { checkParent } from "./entry-ordering.service.js";
import { createContentReferences, removeReferencesFromEntries } from "./entry-references.js";
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
  hasEntryWithValue,
  insertEntry,
  listTranslationFamily,
  moveChildrenToParent,
  type SlugScope,
  updateEntryRow,
} from "./entries.repository.js";
import type {
  CreateEntryRequest,
  EntryResponse,
  EntryTranslation,
  UpdateEntryRequest,
} from "./entries.schema.js";
import type { Entry, EntryData } from "./entries.table.js";
import { firstFreeSlug, slugify } from "./slugs.js";
import { recordEdit } from "./revision-log.js";

/**
 * Creating, saving and deleting entries. Publishing is in entry-publishing.service.ts,
 * ordering in entry-ordering.service.ts and revisions in revisions.service.ts.
 */

/** Who is making a change, and how to check the images they picked. */
export interface EntryChangeContext {
  authorId: string | null;
  assetExists: AssetExists;
  /** What the person making the change may do, for rules such as who may change page code. */
  permissions?: readonly string[];
}

const SLUG_INDEX = "entries_collection_site_locale_slug_unique";

/** The entry as the API returns it, or a 404. */
export async function findEntry(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<EntryResponse> {
  const found = await findEntryWithDetails(database, entryId);
  if (!found) {
    throw new EntryNotFoundError();
  }
  return describeEntry(found, await findTranslations(database, found.entry));
}

/** The entry in the site's other languages, through its origin. */
async function findTranslations(
  database: DatabaseOrTransaction,
  entry: Entry,
): Promise<EntryTranslation[]> {
  const family = await listTranslationFamily(database, entry.originId ?? entry.id);
  return family
    .filter((member) => member.id !== entry.id)
    .map((member) => ({ ...member, title: member.title ?? "" }));
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

/**
 * A new draft at the end of its siblings, with a slug made from the title if none was sent.
 * It belongs to the site given (the default when left out), or for a shared collection to
 * the default site, where shared entries are kept.
 */
export async function createEntry(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  request: CreateEntryRequest,
  context: EntryChangeContext,
  forSite?: Site,
): Promise<EntryResponse> {
  const collection = await findCollectionOrFail(database, collectionHandle, forSite);
  const entrySite = await entrySiteFor(database, collection, forSite);
  const { site, locale } = await resolveLocale(database, request.locale, entrySite);
  const data = await validateForCollection(database, collection, request.data, context, "saving", {
    previousData: {},
    entryId: null,
    locale,
  });
  const parentId = request.parentId ?? null;
  await checkParent(database, collection, parentId, undefined, locale, site.id);
  const scope = { collectionId: collection.id, siteId: site.id, locale };
  const slug = await chooseSlug(database, scope, request.slug, data, collection.name);

  const entry = await withFriendlySlugConflict(collection.name, () =>
    database.transaction(async (transaction) => {
      const created = await insertEntry(transaction, {
        collectionId: collection.id,
        siteId: site.id,
        locale,
        slug,
        parentId,
        data,
        sortOrder: await findNextSortOrder(transaction, collection.id, parentId),
        createdBy: context.authorId,
        updatedBy: context.authorId,
      });
      await recordEdit(transaction, {
        entryId: created.id,
        authorId: context.authorId,
        data,
        saveVersion: false,
      });
      return created;
    }),
  );
  return findEntry(database, entry.id);
}

/**
 * Saves new values, slug or parent. Autosaves by one person join their open "edited"
 * revision; Save version (`saveVersion`) keeps it as a version (see revision-log.ts). A published entry stays
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
    "saving",
    { previousData: entry.data, entryId: entry.id, locale: entry.locale },
  );
  // Only a move is checked, so an entry placed before its content type's rules changed can
  // still be saved where it is.
  if (request.parentId !== undefined && request.parentId !== entry.parentId) {
    await checkParent(database, collection, request.parentId, entry.id, entry.locale, entry.siteId);
  }
  const slug =
    request.slug === undefined
      ? entry.slug
      : await chooseSlug(
          database,
          {
            collectionId: collection.id,
            siteId: entry.siteId,
            locale: entry.locale,
            exceptEntryId: entry.id,
          },
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
      await recordEdit(transaction, {
        entryId: entry.id,
        authorId: context.authorId,
        data,
        saveVersion: request.saveVersion ?? false,
      });
    }),
  );
  return findEntry(database, entry.id);
}

/**
 * Deletes the entry and its revisions. Its child pages move up to its own parent, its
 * translations stay as entries of their own, and entries fields that chose it forget it.
 */
export async function deleteEntry(database: DatabaseOrTransaction, entryId: string): Promise<void> {
  const entry = await findEntryOrFail(database, entryId);
  await database.transaction(async (transaction) => {
    await moveChildrenToParent(transaction, entry.id, entry.parentId);
    await clearOriginReferences(transaction, entry.id);
    await deleteEntryRow(transaction, entry.id);
    await removeReferencesFromEntries(transaction, entry.id);
    await removeReferencesFromGlobalValues(transaction, entry.id);
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

/**
 * Checks values against the collection's blueprint; see entry-data-validator.ts. Saving
 * a draft lets required fields other than the title stay empty, so work in progress is
 * never lost; publishing and scheduling check them all (see `checkReadyToPublish`).
 */
export async function validateForCollection(
  database: DatabaseOrTransaction,
  collection: Collection,
  data: EntryData,
  context: Pick<EntryChangeContext, "assetExists" | "permissions">,
  when: "saving" | "publishing" = "saving",
  /**
   * Given when a person is changing the entry (creating or saving it), with what was stored
   * before, so rules about who may change what apply. Publishing and restoring leave it out.
   */
  personChange?: { previousData: EntryData; entryId: string | null; locale: string },
): Promise<EntryData> {
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const validate = buildEntryDataValidator(blueprint.fields, {
    previousData: personChange?.previousData,
    pageCode: personChange
      ? await findPageCodeContext(database, blueprint.fields, context.permissions)
      : undefined,
    assetExists: context.assetExists,
    references: createContentReferences(database),
    requiredFields: when === "saving" ? "allowEmpty" : "enforce",
    // The title names the entry in lists and makes its slug, so even a draft needs one.
    alwaysRequired: ["title"],
    // Fields marked unique are checked when a person saves; publishing a saved draft doesn't
    // change its values, so there is nothing new to compare.
    isValueUnique: personChange
      ? async (handle, value) =>
          !(await hasEntryWithValue(
            database,
            {
              collectionId: collection.id,
              locale: personChange.locale,
              exceptEntryId: personChange.entryId,
            },
            handle,
            value,
          ))
      : undefined,
  });
  return validate(data);
}

/**
 * A slug the editor typed is tidied up and must be free; one made from the title gets a
 * number added until it is free, so creating "Hello" twice just works.
 */
export async function chooseSlug(
  database: DatabaseOrTransaction,
  scope: SlugScope,
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
export async function withFriendlySlugConflict<Result>(
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

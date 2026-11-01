import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findLocaleOrFail } from "../sites/locales.service.js";
import { SameLocaleTranslationError, TranslationExistsError } from "./entries.errors.js";
import {
  findSlugsStartingWith,
  findNextSortOrder,
  insertEntry,
  listTranslationFamily,
} from "./entries.repository.js";
import type { EntryResponse, TranslateEntryRequest } from "./entries.schema.js";
import {
  type EntryChangeContext,
  findEntry,
  findEntryOrFail,
  withFriendlySlugConflict,
} from "./entries.service.js";
import type { Entry } from "./entries.table.js";
import { recordEdit } from "./revision-log.js";
import { firstFreeSlug } from "./slugs.js";

/**
 * Translations are entries of their own (their own values, slug, status and history)
 * linked to the entry they were translated from through `originId`. Every translation
 * points at the same origin, so an entry and its translations form one small family.
 * See docs/decisions/0007-translations-as-linked-entries.md.
 */

/**
 * Starts a draft translation into another of the site's languages, as a copy of this
 * entry's values, ready for someone to translate. It keeps the slug where that is free,
 * and in a page tree it goes under the translation of its origin's parent, if there is one.
 */
export async function translateEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  request: TranslateEntryRequest,
  context: Pick<EntryChangeContext, "authorId">,
): Promise<EntryResponse> {
  const entry = await findEntryOrFail(database, entryId);
  const { locale } = await findLocaleOrFail(database, request.locale);
  if (locale.code === entry.locale) {
    throw new SameLocaleTranslationError(locale.name);
  }
  const origin = entry.originId ? await findEntryOrFail(database, entry.originId) : entry;
  const family = await listTranslationFamily(database, origin.id);
  const existing = family.find((member) => member.locale === locale.code);
  if (existing) {
    throw new TranslationExistsError(locale.name, existing.id);
  }

  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const scope = { collectionId: collection.id, siteId: entry.siteId, locale: locale.code };
  const slug = firstFreeSlug(
    origin.slug,
    new Set(await findSlugsStartingWith(database, scope, origin.slug)),
  );
  const parentId = await findParentInLocale(database, origin, locale.code);

  const translation = await withFriendlySlugConflict(collection.name, () =>
    database.transaction(async (transaction) => {
      const created = await insertEntry(transaction, {
        ...scope,
        originId: origin.id,
        parentId,
        slug,
        data: entry.data,
        sortOrder: await findNextSortOrder(transaction, collection.id, parentId),
        createdBy: context.authorId,
        updatedBy: context.authorId,
      });
      await recordEdit(transaction, {
        entryId: created.id,
        authorId: context.authorId,
        data: entry.data,
        saveVersion: false,
      });
      return created;
    }),
  );
  return findEntry(database, translation.id);
}

/** The translation of the origin's parent page in this language, or null for the top level. */
async function findParentInLocale(
  database: DatabaseOrTransaction,
  origin: Entry,
  locale: string,
): Promise<string | null> {
  if (origin.parentId === null) {
    return null;
  }
  const parent = await findEntryOrFail(database, origin.parentId);
  const parentFamily = await listTranslationFamily(database, parent.originId ?? parent.id);
  return parentFamily.find((member) => member.locale === locale)?.id ?? null;
}

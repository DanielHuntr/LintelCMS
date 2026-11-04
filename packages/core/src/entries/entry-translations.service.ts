import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findLocaleOrFail } from "../sites/locales.service.js";
import { findSiteByIdOrFail } from "../sites/sites.service.js";
import {
  ParentsNotTranslatedError,
  SameLocaleTranslationError,
  TranslationExistsError,
} from "./entries.errors.js";
import {
  findFirstTopLevelEntry,
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
 * and in a page tree it goes under the translation of its origin's parent.
 *
 * A page whose parents have no translation would land at the top of that language's tree,
 * and the first page there answers at "/". So it is refused, naming the pages needed first,
 * unless `withParents` asks for those to be started too, from the top down.
 */
export async function translateEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  request: TranslateEntryRequest,
  context: Pick<EntryChangeContext, "authorId">,
): Promise<EntryResponse> {
  const entry = await findEntryOrFail(database, entryId);
  const site = await findSiteByIdOrFail(database, entry.siteId);
  const { locale } = await findLocaleOrFail(database, request.locale, site);
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
  const needed = await findPagesNeededFirst(database, origin, collection.structure, locale.code);
  if (needed.length > 0 && !request.withParents) {
    throw new ParentsNotTranslatedError(
      locale.name,
      needed.map((page) => ({ id: page.id, title: titleOf(page) })),
    );
  }
  for (const page of needed) {
    await startTranslation(
      database,
      page,
      page.originId ? await findEntryOrFail(database, page.originId) : page,
      locale.code,
      context,
    );
  }
  const translation = await startTranslation(database, entry, origin, locale.code, context);
  return findEntry(database, translation.id);
}

/** A draft in the language, copied from `entry`, in the family of `origin`. */
async function startTranslation(
  database: DatabaseOrTransaction,
  entry: Entry,
  origin: Entry,
  locale: string,
  context: Pick<EntryChangeContext, "authorId">,
): Promise<Entry> {
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const scope = { collectionId: collection.id, siteId: entry.siteId, locale };
  const slug = firstFreeSlug(
    origin.slug,
    new Set(await findSlugsStartingWith(database, scope, origin.slug)),
  );
  const parentId = await findParentInLocale(database, origin, locale);

  return withFriendlySlugConflict(collection.name, () =>
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
}

function titleOf(page: Entry): string {
  const title = page.data.title;
  return typeof title === "string" && title !== "" ? title : page.slug;
}

/** Whether the page has a version in the language. */
async function isTranslated(
  database: DatabaseOrTransaction,
  page: Entry,
  locale: string,
): Promise<boolean> {
  const family = await listTranslationFamily(database, page.originId ?? page.id);
  return family.some((member) => member.locale === locale);
}

/**
 * The pages to translate before this one, top of the tree first: its parents without a
 * version in the language, and the site's home page, so that a language's first page at the
 * top of the tree is always the translation of the home page.
 */
async function findPagesNeededFirst(
  database: DatabaseOrTransaction,
  origin: Entry,
  structure: string,
  locale: string,
): Promise<Entry[]> {
  if (structure !== "tree") return [];
  const needed: Entry[] = [];
  let top = origin;
  while (top.parentId !== null) {
    top = await findEntryOrFail(database, top.parentId);
    if (!(await isTranslated(database, top, locale))) needed.unshift(top);
  }
  const home = await findFirstTopLevelEntry(database, {
    collectionId: origin.collectionId,
    siteId: origin.siteId,
    locale: top.locale,
  });
  if (home && home.id !== top.id && !(await isTranslated(database, home, locale))) {
    needed.unshift(home);
  }
  return needed;
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

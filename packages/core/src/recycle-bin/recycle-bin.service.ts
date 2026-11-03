import { findCollectionById } from "../collections/collections.repository.js";
import { listSiteStarts } from "../content-roots/content-roots.service.js";
import { findAddressClash } from "../content-roots/root-addresses.js";
import { listBranchIds } from "../content-tree/content-tree-branches.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  clearOriginReferences,
  deleteEntryRow,
  findEntryById,
  findNextSortOrder,
  findSlugsStartingWith,
} from "../entries/entries.repository.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import type { Entry, RevisionKind } from "../entries/entries.table.js";
import { removeReferencesFromEntries } from "../entries/entry-references.js";
import { firstFreeSlug } from "../entries/slugs.js";
import { removeReferencesFromGlobalValues } from "../globals/global-references.js";
import { CollectionGoneError, RecycleBinItemNotFoundError } from "./recycle-bin.errors.js";
import {
  deleteAllRecycleBinItems,
  deleteRecycleBinItem,
  findExistingEntryIds,
  findExistingUserIds,
  findRecycleBinItem,
  insertEntryRow,
  insertRecycleBinItem,
  insertRootAddressRow,
  insertRevisionRows,
  insertSeoRows,
  listEntryRows,
  listRecycleBinRows,
  listRevisionRows,
  listRootAddressRows,
  listTranslationLinks,
  relinkTranslations,
  listSeoRows,
} from "./recycle-bin.repository.js";
import type { BinnedBranch, BinnedEntry, RecycleBinItem } from "./recycle-bin.table.js";

/**
 * The recycle bin. Deleting from the content tree keeps a copy of the entry and everything
 * under it (values, history, search settings) and then deletes them as "Delete" always has,
 * so the rest of Lintel never sees a binned entry. Restoring puts them back with the same
 * ids, under the same parent when it is still there, as drafts. See README.md for why.
 */

const LIST_LIMIT = 200;

/**
 * The sites someone may work on (`SignedIn.siteIds`), or null for every site. Items from
 * other sites are left out of the list and answer "not found", so their titles never show.
 */
export type SiteLimit = readonly string[] | null;

export interface RecycleBinListItem {
  id: string;
  entryId: string;
  title: string;
  collection: { handle: string; name: string };
  itemCount: number;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
}

export async function listRecycleBin(
  database: DatabaseOrTransaction,
  siteLimit: SiteLimit,
): Promise<{ items: RecycleBinListItem[] }> {
  const rows = await listRecycleBinRows(database, DEFAULT_TENANT_ID, LIST_LIMIT, siteLimit);
  return {
    items: rows.map(({ item, collectionHandle, collectionName, deletedByName }) => ({
      id: item.id,
      entryId: item.entryId,
      title: item.title,
      collection: { handle: collectionHandle, name: collectionName },
      itemCount: item.itemCount,
      deletedAt: item.deletedAt.toISOString(),
      deletedBy:
        item.deletedBy !== null && deletedByName !== null
          ? { id: item.deletedBy, name: deletedByName }
          : null,
    })),
  };
}

function binEntry(entry: Entry): BinnedEntry {
  return {
    id: entry.id,
    collectionId: entry.collectionId,
    siteId: entry.siteId,
    locale: entry.locale,
    originId: entry.originId,
    parentId: entry.parentId,
    slug: entry.slug,
    data: entry.data,
    sortOrder: entry.sortOrder,
    createdBy: entry.createdBy,
    updatedBy: entry.updatedBy,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

/**
 * Moves an entry and everything under it to the recycle bin. Answers the ids that went,
 * the entry first, so the caller can announce each one as deleted.
 */
export async function moveToRecycleBin(
  database: DatabaseOrTransaction,
  entryId: string,
  deletedBy: string | null,
): Promise<{ itemId: string; entryIds: string[] }> {
  const entry = await findEntryOrFail(database, entryId);
  const ids = await listBranchIds(database, entry.id);
  const rowsById = new Map((await listEntryRows(database, ids)).map((row) => [row.id, row]));
  // Parents before children, so restoring can put them back in this order.
  const entries = ids.flatMap((id) => rowsById.get(id) ?? []);
  const branch: BinnedBranch = {
    entries: entries.map(binEntry),
    revisions: (await listRevisionRows(database, ids)).map((revision) => ({
      id: revision.id,
      entryId: revision.entryId,
      authorId: revision.authorId,
      kind: revision.kind,
      data: revision.data,
      restoredFromAt: revision.restoredFromAt?.toISOString() ?? null,
      createdAt: revision.createdAt.toISOString(),
      updatedAt: revision.updatedAt.toISOString(),
    })),
    seo: (await listSeoRows(database, ids)).map((seo) => ({
      entryId: seo.entryId,
      title: seo.title,
      description: seo.description,
      socialImageId: seo.socialImageId,
      noindex: seo.noindex,
    })),
    // Binning unlinks translations of the entries that go, so they're noted for restoring.
    // They used to stay unlinked for good (LINTEL-DATA-012).
    translations: await listTranslationLinks(database, ids),
    hostnames: (await listRootAddressRows(database, ids)).map((address) => ({
      entryId: address.entryId,
      hostname: address.hostname,
      pathPrefix: address.pathPrefix,
    })),
  };
  const title = typeof entry.data.title === "string" ? entry.data.title : "";

  const item = await database.transaction(async (transaction) => {
    const inserted = await insertRecycleBinItem(transaction, {
      entryId: entry.id,
      collectionId: entry.collectionId,
      parentId: entry.parentId,
      title,
      itemCount: ids.length,
      branch,
      deletedBy,
    });
    // Children go before their parents, since a parent can't be deleted while it has any.
    for (const id of [...ids].reverse()) {
      await clearOriginReferences(transaction, id);
      await deleteEntryRow(transaction, id);
      await removeReferencesFromEntries(transaction, id);
      await removeReferencesFromGlobalValues(transaction, id);
    }
    return inserted;
  });
  return { itemId: item.id, entryIds: ids };
}

/**
 * Puts a binned entry and everything under it back. It goes under its old parent when that
 * is still there, else at the top of its collection. Everything comes back as a draft, so
 * nothing reappears on the site until someone publishes it, and a slug taken meanwhile gets
 * a number.
 */
export async function restoreFromRecycleBin(
  database: DatabaseOrTransaction,
  itemId: string,
  siteLimit: SiteLimit,
): Promise<{ entryId: string; parentId: string | null; restoredCount: number }> {
  const item = await findRecycleBinItem(database, DEFAULT_TENANT_ID, itemId);
  if (!item || !isOnSites(item, siteLimit)) {
    throw new RecycleBinItemNotFoundError();
  }
  const { entries, revisions, seo } = item.branch;
  for (const collectionId of new Set(entries.map((entry) => entry.collectionId))) {
    if (!(await findCollectionById(database, collectionId))) {
      throw new CollectionGoneError(item.title);
    }
  }

  const people = await findExistingUserIds(
    database,
    [
      ...entries.flatMap((entry) => [entry.createdBy, entry.updatedBy]),
      ...revisions.map((revision) => revision.authorId),
    ].filter((id): id is string => id !== null),
  );
  const someone = (id: string | null) => (id !== null && people.has(id) ? id : null);
  const restoredIds = new Set(entries.map((entry) => entry.id));
  const origins = await findExistingEntryIds(
    database,
    entries.flatMap((entry) => (entry.originId ? [entry.originId] : [])),
  );
  const parentIsBack = item.parentId !== null && (await findEntryById(database, item.parentId));
  const topParentId = parentIsBack ? item.parentId : null;

  await database.transaction(async (transaction) => {
    // Stored parents first: the branch was saved in that order.
    for (const entry of entries) {
      const isTop = entry.id === item.entryId;
      const parentId = isTop ? topParentId : entry.parentId;
      const scope = {
        collectionId: entry.collectionId,
        siteId: entry.siteId,
        locale: entry.locale,
      };
      const taken = await findSlugsStartingWith(transaction, scope, entry.slug);
      await insertEntryRow(transaction, {
        id: entry.id,
        collectionId: entry.collectionId,
        siteId: entry.siteId,
        locale: entry.locale,
        originId:
          entry.originId && (origins.has(entry.originId) || restoredIds.has(entry.originId))
            ? entry.originId
            : null,
        parentId,
        slug: firstFreeSlug(entry.slug, new Set(taken)),
        status: "draft",
        data: entry.data,
        sortOrder: isTop
          ? await findNextSortOrder(transaction, entry.collectionId, parentId)
          : entry.sortOrder,
        createdBy: someone(entry.createdBy),
        updatedBy: someone(entry.updatedBy),
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
      });
    }
    await insertRevisionRows(
      transaction,
      revisions.map((revision) => ({
        id: revision.id,
        entryId: revision.entryId,
        authorId: someone(revision.authorId),
        kind: revision.kind as RevisionKind,
        data: revision.data,
        isOpen: false,
        restoredFromAt: revision.restoredFromAt ? new Date(revision.restoredFromAt) : null,
        createdAt: new Date(revision.createdAt),
        updatedAt: new Date(revision.updatedAt),
      })),
    );
    await insertSeoRows(transaction, seo);
    await relinkTranslations(transaction, item.branch.translations ?? []);
    // A site start gets its own domain and path back, unless another took them meanwhile.
    for (const address of item.branch.hostnames ?? []) {
      const entry = entries.find((candidate) => candidate.id === address.entryId);
      const isAtTop = entry?.id === item.entryId ? topParentId === null : entry?.parentId === null;
      if (!entry || !isAtTop) {
        continue;
      }
      const others = (await listSiteStarts(transaction, entry.siteId, entry.locale)).filter(
        (start) => start.entryId !== entry.id && start.isAssigned,
      );
      if (!findAddressClash(address, others)) {
        await insertRootAddressRow(transaction, {
          tenantId: DEFAULT_TENANT_ID,
          entryId: entry.id,
          hostname: address.hostname,
          pathPrefix: address.pathPrefix,
        });
      }
    }
    await deleteRecycleBinItem(transaction, item.id);
  });
  return { entryId: item.entryId, parentId: topParentId, restoredCount: entries.length };
}

/** Deletes one binned item for good. */
export async function deleteFromRecycleBin(
  database: DatabaseOrTransaction,
  itemId: string,
  siteLimit: SiteLimit,
): Promise<void> {
  const item = await findRecycleBinItem(database, DEFAULT_TENANT_ID, itemId);
  if (!item || !isOnSites(item, siteLimit)) {
    throw new RecycleBinItemNotFoundError();
  }
  await deleteRecycleBinItem(database, item.id);
}

/** Empties the bin for good: every item on the sites someone may work on. */
export async function emptyRecycleBin(
  database: DatabaseOrTransaction,
  siteLimit: SiteLimit,
): Promise<{ deleted: number }> {
  return { deleted: await deleteAllRecycleBinItems(database, DEFAULT_TENANT_ID, siteLimit) };
}

function isOnSites(item: RecycleBinItem, siteLimit: SiteLimit): boolean {
  const siteId = item.branch.entries[0]?.siteId;
  return siteLimit === null || (siteId !== undefined && siteLimit.includes(siteId));
}

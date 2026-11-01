import {
  findCollectionByIdOrFail,
  findCollectionOrFail,
} from "../collections/collections.service.js";
import {
  type CollectionWithDetails,
  listCollectionsWithDetails,
} from "../collections/collections.repository.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { ReorderNotAllowedError } from "../entries/entries.errors.js";
import { findAncestorIds } from "../entries/entries.repository.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import { checkParent } from "../entries/entry-ordering.service.js";
import { findLiveAddresses, listSiteStarts } from "../content-roots/content-roots.service.js";
import { countRecycleBinItems } from "../recycle-bin/recycle-bin.repository.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import { listBranchIds } from "./content-tree-branches.service.js";
import { EntryNotAtThisPlaceError, SiteNotFoundError } from "./content-tree.errors.js";
import {
  countChildrenOf,
  countNodes,
  countTopLevelByCollection,
  findNodeRows,
  listNodeRows,
  listSiblingIds,
  listSites,
  type NodePlace,
  renumberSiblings,
  searchNodeRows,
  type TreeNodeRow,
} from "./content-tree.repository.js";
import type {
  AddressChange,
  AllowedType,
  MoveEntryRequest,
  PathStep,
  SortChildrenRequest,
  TreeChildrenQuery,
  TreeNode,
  TreeRoot,
  TreeRootsResponse,
} from "./content-tree.schema.js";

/**
 * The content tree: what the admin's Content section shows down its left side. Reading it a
 * level at a time, searching it, and moving and sorting entries in it. Publishing and
 * duplicating whole branches are in content-tree-branches.service.ts.
 */

const SEARCH_LIMIT = 50;

interface SiteAndLocale {
  site: { id: string; name: string; locale: string };
  locale: string;
}

/** The site asked for (the main one when none is), and the language: its own unless asked. */
async function resolveSiteAndLocale(
  database: DatabaseOrTransaction,
  siteId: string | undefined,
  locale: string | undefined,
): Promise<SiteAndLocale & { sites: SiteAndLocale["site"][] }> {
  const main = await findSiteWithLocales(database);
  const sites = await listSites(database, DEFAULT_TENANT_ID);
  const site = siteId === undefined ? main : sites.find((candidate) => candidate.id === siteId);
  if (!site) {
    throw new SiteNotFoundError();
  }
  const chosen = { id: site.id, name: site.name, locale: site.locale };
  return { sites, site: chosen, locale: locale ?? site.locale };
}

/** Dated and flat collections are lists; a tree is a list only when its content type says so. */
function showsChildrenAsCollection(collection: Collection | CollectionWithDetails): boolean {
  return collection.structure !== "tree" || collection.childrenAsCollection;
}

/** The sections at the top of the tree: one per collection allowed at the top level. */
export async function listTreeRoots(
  database: DatabaseOrTransaction,
  query: { siteId?: string; locale?: string },
): Promise<TreeRootsResponse> {
  const { sites, site, locale } = await resolveSiteAndLocale(database, query.siteId, query.locale);
  const collections = await listCollectionsWithDetails(database, DEFAULT_TENANT_ID);
  const counts = await countTopLevelByCollection(database, site.id, locale);
  const roots: TreeRoot[] = collections
    .filter((collection) => collection.allowedAtRoot)
    // Page trees first, as the site's own structure, then the rest by name.
    .sort(
      (first, second) =>
        Number(second.structure === "tree") - Number(first.structure === "tree") ||
        first.name.localeCompare(second.name),
    )
    .map((collection) => ({
      handle: collection.handle,
      name: collection.name,
      blueprintHandle: collection.blueprintHandle,
      structure: collection.structure,
      childCount: counts.get(collection.id) ?? 0,
      childrenAsCollection: showsChildrenAsCollection(collection),
    }));
  return {
    sites,
    site,
    locale,
    roots,
    siteStartCount: (await listSiteStarts(database, site.id, locale)).length,
    recycleBinCount: await countRecycleBinItems(database, DEFAULT_TENANT_ID),
  };
}

function describeNode(row: TreeNodeRow, childCount: number): TreeNode {
  return {
    id: row.id,
    title: row.title ?? "",
    slug: row.slug,
    status: row.status,
    hasUnpublishedChanges: row.hasUnpublishedChanges,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    parentId: row.parentId,
    locale: row.locale,
    collection: { handle: row.collectionHandle, name: row.collectionName },
    childCount,
    childrenAsCollection: row.childrenAsCollection,
    isSiteStart: row.isSiteStart,
  };
}

/** Rows as nodes, with how many children each has, counted in one query. */
export async function describeNodes(
  database: DatabaseOrTransaction,
  rows: readonly TreeNodeRow[],
): Promise<TreeNode[]> {
  const counts = await countChildrenOf(
    database,
    rows.map((row) => row.id),
  );
  return rows.map((row) => describeNode(row, counts.get(row.id) ?? 0));
}

/**
 * One level of the tree, a page at a time: the children of an entry (from any collection,
 * in the order set by hand), or the top level of one collection.
 */
export async function listTreeChildren(
  database: DatabaseOrTransaction,
  query: TreeChildrenQuery,
): Promise<{ items: TreeNode[]; total: number; offset: number; limit: number }> {
  let place: NodePlace;
  let order: "manual" | "dated" = "manual";
  if (query.parentId !== undefined) {
    await findEntryOrFail(database, query.parentId);
    place = { parentId: query.parentId };
  } else {
    const collection = await findCollectionOrFail(database, query.collection ?? "");
    const { site, locale } = await resolveSiteAndLocale(database, query.siteId, query.locale);
    place = { collectionId: collection.id, siteId: site.id, locale };
    order = collection.structure === "dated" ? "dated" : "manual";
  }
  const page = { limit: query.limit, offset: query.offset };
  const rows = await listNodeRows(database, place, order, page);
  return {
    items: await describeNodes(database, rows),
    total: await countNodes(database, place),
    ...page,
  };
}

/** Entries whose titles contain the search, for the filter at the top of the tree. */
export async function searchTree(
  database: DatabaseOrTransaction,
  query: { search: string; siteId?: string; locale?: string },
): Promise<{ items: TreeNode[] }> {
  const { site, locale } = await resolveSiteAndLocale(database, query.siteId, query.locale);
  const rows = await searchNodeRows(database, query.search, site.id, locale, SEARCH_LIMIT);
  return { items: await describeNodes(database, rows) };
}

/** The entries from the top of the tree down to this one, for breadcrumbs and opening the tree. */
export async function findEntryPath(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<{ path: PathStep[] }> {
  await findEntryOrFail(database, entryId);
  const ids = (await findAncestorIds(database, entryId)).reverse();
  const rows = new Map((await findNodeRows(database, ids)).map((row) => [row.id, row]));
  const path = ids.flatMap((id) => {
    const row = rows.get(id);
    return row
      ? [
          {
            id,
            title: row.title ?? "",
            collection: { handle: row.collectionHandle, name: row.collectionName },
          },
        ]
      : [];
  });
  return { path };
}

function describeType(collection: CollectionWithDetails): AllowedType {
  return {
    handle: collection.handle,
    name: collection.name,
    blueprintHandle: collection.blueprintHandle,
    structure: collection.structure,
  };
}

/**
 * What may be created at a place: under an entry, the tree collections its content type
 * allows; at a collection's top level, that collection when it allows the top level; with
 * neither, every collection that allows the top level (the Content landing's Create).
 */
export async function listAllowedTypes(
  database: DatabaseOrTransaction,
  query: { parentId?: string; collection?: string },
): Promise<{ types: AllowedType[] }> {
  const collections = await listCollectionsWithDetails(database, DEFAULT_TENANT_ID);
  if (query.parentId !== undefined) {
    const parent = await findEntryOrFail(database, query.parentId);
    const parentCollection = await findCollectionByIdOrFail(database, parent.collectionId);
    const allowed = new Set(parentCollection.allowedChildren);
    return {
      types: collections
        .filter((collection) => allowed.has(collection.handle) && collection.structure === "tree")
        .map(describeType),
    };
  }
  const atTop = collections.filter((collection) => collection.allowedAtRoot);
  if (query.collection !== undefined) {
    return {
      types: atTop.filter((collection) => collection.handle === query.collection).map(describeType),
    };
  }
  return { types: atTop.map(describeType) };
}

/** Where an entry's siblings are: under its parent, or the top of its own collection. */
function placeOf(entry: {
  parentId: string | null;
  collectionId: string;
  siteId: string;
  locale: string;
}): NodePlace {
  return entry.parentId === null
    ? { collectionId: entry.collectionId, siteId: entry.siteId, locale: entry.locale }
    : { parentId: entry.parentId };
}

/**
 * Puts an entry under a new parent (or at its collection's top level) at a place among its
 * new siblings, with the same rules as choosing a parent in the editor. Answers where it
 * was, so the admin can offer to undo, and the live pages whose addresses changed (moving to
 * or from the top, or between site starts), so it can offer redirects from the old ones.
 */
export async function moveEntry(
  database: DatabaseOrTransaction,
  request: MoveEntryRequest,
): Promise<{
  previous: { parentId: string | null; index: number };
  addressChanges: AddressChange[];
}> {
  const entry = await findEntryOrFail(database, request.entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  if (collection.structure === "dated") {
    throw new ReorderNotAllowedError(collection.name);
  }
  if (request.parentId !== entry.parentId) {
    await checkParent(database, collection, request.parentId, entry.id, entry.locale);
  }

  const previousPlace = placeOf(entry);
  const previousSiblings = await listSiblingIds(database, previousPlace);
  const previousIndex = Math.max(0, previousSiblings.indexOf(entry.id));
  const target = placeOf({ ...entry, parentId: request.parentId });
  const siblings = (await listSiblingIds(database, target)).filter((id) => id !== entry.id);
  siblings.splice(Math.min(request.index, siblings.length), 0, entry.id);

  // To or from the top, the order of site starts can change which one is "/", so all count.
  const touchesTop = entry.parentId === null || request.parentId === null;
  const affected = [
    ...new Set([
      ...(await listBranchIds(database, entry.id)),
      ...(touchesTop ? await listSiteStartBranches(database, entry.siteId, entry.locale) : []),
    ]),
  ];
  const before = await findLiveAddresses(database, affected);

  await database.transaction(async (transaction) => {
    await renumberSiblings(transaction, siblings, request.parentId);
    if (request.parentId !== entry.parentId) {
      const left = previousSiblings.filter((id) => id !== entry.id);
      await renumberSiblings(transaction, left, entry.parentId);
    }
  });

  const after = await findLiveAddresses(database, affected);
  const addressChanges = [...before].flatMap(([entryId, old]): AddressChange[] => {
    const now = after.get(entryId);
    return now && now.url !== old.url
      ? [{ entryId, title: now.title, from: old.url, to: now.url }]
      : [];
  });
  return { previous: { parentId: entry.parentId, index: previousIndex }, addressChanges };
}

/** Every entry under the site starts of one site and language, for comparing addresses. */
async function listSiteStartBranches(
  database: DatabaseOrTransaction,
  siteId: string,
  locale: string,
): Promise<string[]> {
  const starts = await listSiteStarts(database, siteId, locale);
  const branches = await Promise.all(starts.map((start) => listBranchIds(database, start.entryId)));
  return branches.flat();
}

/**
 * "Sort children": the entries at one place in the order given. Entries left out keep
 * their order after the listed ones, so a long list can be sorted from the top.
 */
export async function sortChildren(
  database: DatabaseOrTransaction,
  request: SortChildrenRequest,
): Promise<void> {
  let place: NodePlace;
  if (request.parentId !== null) {
    await findEntryOrFail(database, request.parentId);
    place = { parentId: request.parentId };
  } else {
    const collection = await findCollectionOrFail(database, request.collection ?? "");
    if (collection.structure === "dated") {
      throw new ReorderNotAllowedError(collection.name);
    }
    const { site, locale } = await resolveSiteAndLocale(database, request.siteId, request.locale);
    place = { collectionId: collection.id, siteId: site.id, locale };
  }
  const current = await listSiblingIds(database, place);
  const known = new Set(current);
  const listed = [...new Set(request.order)];
  const stranger = listed.find((id) => !known.has(id));
  if (stranger !== undefined) {
    throw new EntryNotAtThisPlaceError(stranger);
  }
  const rest = current.filter((id) => !listed.includes(id));
  await database.transaction((transaction) =>
    renumberSiblings(transaction, [...listed, ...rest], request.parentId),
  );
}

import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import { findRootPlaces, placeEntryUrl } from "../content-roots/content-roots.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { findAncestorIds } from "../entries/entries.repository.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import { findSiteByIdOrFail } from "../sites/sites.service.js";
import {
  countChildrenOf,
  findNodeRows,
  findNodesMentioning,
  findPersonNames,
} from "./content-tree.repository.js";
import type { TreeNode } from "./content-tree.schema.js";
import { describeNodes } from "./content-tree.service.js";

/** The most entries "Used by" lists; past that the count says how many more there are. */
const REFERENCES_LIMIT = 50;

type Person = { id: string; name: string } | null;

export interface EntryInfo {
  id: string;
  /** The entry's page on the site, or null when its collection has no pages. */
  url: string | null;
  /** Every address the page answers on; one for now, more once a site has several domains. */
  urls: string[];
  /** For a site start (a page at the top of a page tree): where it answers, and why. */
  siteStart: {
    isDefault: boolean;
    isAssigned: boolean;
    hostname: string;
    pathPrefix: string;
  } | null;
  collection: { handle: string; name: string; structure: string; routePattern: string | null };
  createdAt: string;
  createdBy: Person;
  updatedAt: string;
  updatedBy: Person;
  publishedAt: string | null;
  scheduledFor: string | null;
  /** Entries whose fields link to this one. */
  usedBy: TreeNode[];
  childCount: number;
  /** Its children are listed in the workspace rather than in the tree. */
  childrenAsCollection: boolean;
  /**
   * The pages above it that aren't live, from the top down. Publishing it alone would put
   * it on the site under a parent visitors can't see, so the admin offers to publish them too.
   */
  unpublishedAncestors: Array<{ id: string; title: string }>;
}

/** What the workspace's Info tab shows: where it lives, who made it, and what links to it. */
export async function findEntryInfo(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<EntryInfo> {
  const entry = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const people = await findPersonNames(
    database,
    [entry.createdBy, entry.updatedBy].filter((id): id is string => id !== null),
  );
  const person = (id: string | null): Person => {
    const name = id === null ? undefined : people.get(id);
    return id !== null && name !== undefined ? { id, name } : null;
  };
  const usedBy = await findNodesMentioning(database, entry.id, REFERENCES_LIMIT);
  const url = await placeEntryUrl(
    database,
    entry.id,
    buildEntryUrl(collection.routePattern, entry),
    { site: await findSiteByIdOrFail(database, entry.siteId) },
  );
  const place = (await findRootPlaces(database, [entry.id])).get(entry.id);
  return {
    id: entry.id,
    url,
    urls: url === null ? [] : [url],
    siteStart: place?.isRoot
      ? {
          isDefault: place.isDefault,
          isAssigned: place.isAssigned,
          hostname: place.hostname,
          pathPrefix: place.pathPrefix,
        }
      : null,
    collection: {
      handle: collection.handle,
      name: collection.name,
      structure: collection.structure,
      routePattern: collection.routePattern,
    },
    createdAt: entry.createdAt.toISOString(),
    createdBy: person(entry.createdBy),
    updatedAt: entry.updatedAt.toISOString(),
    updatedBy: person(entry.updatedBy),
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    scheduledFor: entry.scheduledFor?.toISOString() ?? null,
    usedBy: await describeNodes(database, usedBy),
    childCount: (await countChildrenOf(database, [entry.id])).get(entry.id) ?? 0,
    childrenAsCollection: collection.childrenAsCollection,
    unpublishedAncestors: await findUnpublishedAncestors(database, entry.id),
  };
}

async function findUnpublishedAncestors(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<Array<{ id: string; title: string }>> {
  // The path starts with the entry itself; its ancestors are the rest, nearest first.
  const ancestorIds = (await findAncestorIds(database, entryId)).slice(1).reverse();
  const rows = new Map((await findNodeRows(database, ancestorIds)).map((row) => [row.id, row]));
  return ancestorIds.flatMap((id) => {
    const row = rows.get(id);
    return row && row.status !== "published" ? [{ id, title: row.title ?? "" }] : [];
  });
}

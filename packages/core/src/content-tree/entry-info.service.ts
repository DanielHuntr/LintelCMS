import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import {
  countChildrenOf,
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
  return {
    id: entry.id,
    url: buildEntryUrl(collection.routePattern, entry),
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
  };
}

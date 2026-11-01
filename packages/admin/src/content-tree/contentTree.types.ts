import type { EntryStatus } from "../content/content.types.js";

/** One entry in the tree, as `GET /content-tree/children` returns it. */
export interface TreeNode {
  id: string;
  title: string;
  slug: string;
  status: EntryStatus;
  /** Saved since it was last published: the site still shows the older version. */
  hasUnpublishedChanges: boolean;
  scheduledFor: string | null;
  updatedAt: string;
  parentId: string | null;
  locale: string;
  collection: { handle: string; name: string };
  childCount: number;
  /** Its children are listed in the workspace rather than in the tree. */
  childrenAsCollection: boolean;
}

/** A top-level section of the tree: one collection. */
export interface TreeRoot {
  handle: string;
  name: string;
  blueprintHandle: string;
  structure: "tree" | "dated" | "flat";
  childCount: number;
  childrenAsCollection: boolean;
}

export interface TreeSite {
  id: string;
  name: string;
  locale: string;
}

export interface TreeRoots {
  sites: TreeSite[];
  site: TreeSite;
  locale: string;
  roots: TreeRoot[];
  recycleBinCount: number;
}

export interface TreeLevel {
  items: TreeNode[];
  total: number;
  offset: number;
  limit: number;
}

/** Where children come from: under one entry, or the top level of one collection. */
export type TreePlace = { parentId: string } | { collection: string };

export interface AllowedType {
  handle: string;
  name: string;
  blueprintHandle: string;
  structure: string;
}

export interface PathStep {
  id: string;
  title: string;
  collection: { handle: string; name: string };
}

/** What a publish, unpublish or bulk action did, and what it left out and why. */
export interface BatchResult {
  changed: string[];
  skipped: { id: string; title: string; reason: string }[];
}

export interface RecycleBinItem {
  id: string;
  entryId: string;
  title: string;
  collection: { handle: string; name: string };
  itemCount: number;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
}

export interface EntryInfo {
  id: string;
  url: string | null;
  collection: { handle: string; name: string; structure: string; routePattern: string | null };
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  usedBy: TreeNode[];
  childCount: number;
  childrenAsCollection: boolean;
}

export interface ListColumn {
  handle: string;
  label: string;
  type: string;
}

export interface CollectionItem extends TreeNode {
  values: Record<string, unknown>;
  updatedBy: string | null;
}

export interface CollectionItems {
  items: CollectionItem[];
  columns: ListColumn[];
  total: number;
  page: number;
  perPage: number;
  canSortByHand: boolean;
}

/** What the collection view asks for; it lives in the address so it survives a reload. */
export interface CollectionQuery {
  search?: string;
  status?: EntryStatus;
  sort?: string;
  direction?: "asc" | "desc";
  page?: number;
}

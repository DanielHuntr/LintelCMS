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
  /** At the top of a page tree: a site start, the site's "/" or a "/shop" of its own. */
  isSiteStart: boolean;
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
  /** Pages at the top of a page tree. None yet means the site has no home page. */
  siteStartCount: number;
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
  /** After a bulk delete: the recycle bin items made, for Undo. */
  recycleBinItemIds?: string[];
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
  /** Every address the page answers on. */
  urls: string[];
  /** For a page at the top of a page tree: where it answers. */
  siteStart: {
    isDefault: boolean;
    isAssigned: boolean;
    hostname: string;
    pathPrefix: string;
  } | null;
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

/** A live page whose address a move changed. */
export interface AddressChange {
  entryId: string;
  title: string;
  from: string;
  to: string;
}

export interface MoveResult {
  previous: { parentId: string | null; index: number };
  addressChanges: AddressChange[];
}

/** What "Hostnames" shows and saves for a page at the top of the tree. */
export interface RootHostnames {
  entryId: string;
  hostname: string;
  pathPrefix: string;
  /** Has a domain or path of its own. */
  isAssigned: boolean;
  /** Is the site's "/", as the first page at the top without one. */
  isDefault: boolean;
  url: string;
}

export interface ListColumn {
  handle: string;
  label: string;
  type: string;
}

export interface CollectionItem extends TreeNode {
  values: Record<string, unknown>;
  updatedBy: string | null;
  /** Where it answers on the site, or null for content without pages. */
  url: string | null;
}

/** What a bulk delete would take: the picked entries and how many sit under each. */
export interface BulkSummary {
  items: { id: string; title: string; descendantCount: number }[];
  totalCount: number;
}

export interface CollectionItems {
  items: CollectionItem[];
  columns: ListColumn[];
  total: number;
  page: number;
  perPage: number;
  canSortByHand: boolean;
  /** The content types found here, for the type filter. */
  types: { handle: string; name: string }[];
}

/** What the collection view asks for; it lives in the address so it survives a reload. */
export interface CollectionQuery {
  search?: string;
  status?: EntryStatus;
  sort?: string;
  direction?: "asc" | "desc";
  page?: number;
  /** One content type, by its collection's handle. */
  type?: string;
  /** Everything under the place, every level down, in the tree's order. */
  allLevels?: boolean;
}
